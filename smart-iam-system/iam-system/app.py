# -*- coding: utf-8 -*-
"""
Smart Identity & Access Management (IAM) System
-----------------------------------------------
A lightweight, complete Python Flask & SQLite security management simulator.
Implements:
- Hashed Password Storage
- Password Strength Enforcement (>= 8 chars)
- Account Lockout Policy (Lock after 3 failed logins)
- Role Based Access Control (Admin, Manager, Employee)
- Audit Logging & Access Request Governance Workflow
"""

import os
import sqlite3
from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for, session, flash
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = "SECURITY_IAM_SUPER_SECRET_KEY_12345"
DATABASE_PATH = os.path.join(os.path.dirname(__file__), "database.db")


# -------------------------------------------------------------
# DATABASE SETUP & UTILITIES
# -------------------------------------------------------------

def get_db_connection():
    """Establishes connection to the SQLite database."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row  # Access query results like custom dictionaries
    return conn


def init_db():
    """Creates database tables and inserts default credentials if not existing."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS Users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'Employee',
        failed_attempts INTEGER DEFAULT 0,
        locked INTEGER DEFAULT 0
    )
    """)

    # 2. Access Requests Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS AccessRequests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        resource_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Pending',
        request_date TEXT NOT NULL
    )
    """)

    # 3. Audit Logs Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS AuditLogs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        action TEXT NOT NULL,
        timestamp TEXT NOT NULL
    )
    """)

    conn.commit()

    # Seed initial Admin user if table is empty
    cursor.execute("SELECT * FROM Users WHERE role = 'Admin'")
    admin_exists = cursor.fetchone()

    if not admin_exists:
        admin_pass_hash = generate_password_hash("Admin@123")
        try:
            cursor.execute("""
                INSERT INTO Users (username, email, password_hash, role, failed_attempts, locked)
                VALUES (?, ?, ?, ?, ?, ?)
            """, ("admin", "admin@iam.system", admin_pass_hash, "Admin", 0, 0))
            
            # Seed starting Manager and Employee for testing Convenience
            manager_pass_hash = generate_password_hash("Manager@123")
            employee_pass_hash = generate_password_hash("Employee@123")
            
            cursor.execute("""
                INSERT INTO Users (username, email, password_hash, role, failed_attempts, locked)
                VALUES (?, ?, ?, ?, ?, ?)
            """, ("manager", "manager@iam.system", manager_pass_hash, "Manager", 0, 0))

            cursor.execute("""
                INSERT INTO Users (username, email, password_hash, role, failed_attempts, locked)
                VALUES (?, ?, ?, ?, ?, ?)
            """, ("employee", "employee@iam.system", employee_pass_hash, "Employee", 0, 0))

            # Insert inaugural Audit Log
            cursor.execute("""
                INSERT INTO AuditLogs (username, action, timestamp)
                VALUES (?, ?, ?)
            """, ("SYSTEM", "Database Initialized and Default Roles Seeded", datetime.now().strftime("%Y-%m-%d %H:%M:%S")))

            conn.commit()
            print("[INFO] SQLite Initial Seed Successful!")
        except sqlite3.IntegrityError:
            pass

    conn.close()


def log_action(username, action):
    """Inserts a new event trace inside the AuditLogs database table."""
    conn = get_db_connection()
    conn.execute("""
        INSERT INTO AuditLogs (username, action, timestamp)
        VALUES (?, ?, ?)
    """, (username, action, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    conn.commit()
    conn.close()


# -------------------------------------------------------------
# CORE MIDDLEWARE & WRAPPERS
# -------------------------------------------------------------

def login_required(f):
    """Enforces authentication presence before accessing routes."""
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "username" not in session:
            flash("Please sign in to access the security console.", "danger")
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated_function


# -------------------------------------------------------------
# APPLICATION ROUTING (ROUTES)
# -------------------------------------------------------------

@app.route("/")
def index():
    """Bridges entrypoint directly into Login panel."""
    if "username" in session:
        return redirect(url_for("dashboard"))
    return redirect(url_for("login"))


@app.route("/login", methods=["GET", "POST"])
def login():
    """Handles User Authentication, Login Strikes counting, and Lockouts."""
    if "username" in session:
        return redirect(url_for("dashboard"))

    if request.method == "POST":
        username = request.form.get("username").strip()
        password = request.form.get("password")

        if not username or not password:
            flash("All authorization inputs are required.", "danger")
            return render_template("login.html")

        conn = get_db_connection()
        user = conn.execute("SELECT * FROM Users WHERE username = ?", (username,)).fetchone()

        if not user:
            log_action(username, "Login Failure (User profile mismatch)")
            flash("Invalid digital signature credentials.", "danger")
            conn.close()
            return render_template("login.html")

        # 1. Check account lockout policy first
        if user["locked"] == 1:
            log_action(username, "Login Terminated (Account currently locked)")
            flash("Security Policy Alert: Your account is locked due to 3 failed login attempts. Contact Admin.", "danger")
            conn.close()
            return render_template("login.html")

        # 2. Check Password Match
        if check_password_hash(user["password_hash"], password):
            # Success: Reset strikes counter
            conn.execute("UPDATE Users SET failed_attempts = 0 WHERE id = ?", (user["id"],))
            conn.commit()
            conn.close()

            # Set Session
            session["user_id"] = user["id"]
            session["username"] = user["username"]
            session["role"] = user["role"]
            session["email"] = user["email"]

            log_action(user["username"], "Login Success")
            flash(f"Welcome back, Secure Key Operator: {user['username']} ({user['role']})", "success")
            return redirect(url_for("dashboard"))
        else:
            # Failure: Increment failed attempts strike card
            strikes = user["failed_attempts"] + 1
            is_lockout = False
            if strikes >= 3:
                conn.execute("UPDATE Users SET failed_attempts = ?, locked = 1 WHERE id = ?", (strikes, user["id"]))
                is_lockout = True
            else:
                conn.execute("UPDATE Users SET failed_attempts = ? WHERE id = ?", (strikes, user["id"]))
            
            conn.commit()
            conn.close()

            if is_lockout:
                log_action(user["username"], "Account LOCKOUT: 3 threshold strikes violated")
                flash("ALERT: Too many invalid attempts. Your account has been LOCKED for safety reasons.", "danger")
            else:
                log_action(user["username"], f"Login Failure strike registered ({strikes}/3)")
                remaining = 3 - strikes
                flash(f"Invalid Password credentials. {remaining} authorization attempts remain.", "warning")

    return render_template("login.html")


@app.route("/register", methods=["GET", "POST"])
def register():
    """Handles registry onboarding with strict 8-character password audit tests."""
    if request.method == "POST":
        username = request.form.get("username").strip()
        email = request.form.get("email").strip()
        password = request.form.get("password")
        role = request.form.get("role")

        # Validation: check empty values
        if not username or not email or not password or not role:
            flash("All credentials mapping fields require parameter values.", "danger")
            return render_template("register.html")

        # Validation: password length must satisfy 8 characters standard
        if len(password) < 8:
            flash("Security Policy Violation: Password must be at least 8 characters long.", "danger")
            return render_template("register.html")

        conn = get_db_connection()
        
        # Verify unique username
        existing_user = conn.execute("SELECT * FROM Users WHERE username = ?", (username,)).fetchone()
        if existing_user:
            flash("Registration Failed: Username identity is already taken.", "danger")
            conn.close()
            return render_template("register.html")

        # Register User
        password_hash = generate_password_hash(password)
        try:
            conn.execute("""
                INSERT INTO Users (username, email, password_hash, role, failed_attempts, locked)
                VALUES (?, ?, ?, ?, 0, 0)
            """, (username, email, password_hash, role))
            conn.commit()
            conn.close()

            log_action(username, f"User Registration Onboard success as Role: {role}")
            flash("Registration successful! You can now authenticate with the identity vault.", "success")
            return redirect(url_for("login"))
        except Exception as e:
            flash(f"Data Write Failure: {str(e)}", "danger")
            conn.close()

    return render_template("register.html")


@app.route("/dashboard")
@login_required
def dashboard():
    """Renders customized workspace with statistics and metrics based on Role-Based access levels."""
    username = session["username"]
    role = session["role"]

    conn = get_db_connection()

    # Base Metrics calculation
    # Total, pending, approved requests counts
    if role in ["Admin", "Manager"]:
        total_q = conn.execute("SELECT COUNT(*) as cnt FROM AccessRequests").fetchone()
        pending_q = conn.execute("SELECT COUNT(*) as cnt FROM AccessRequests WHERE status = 'Pending'").fetchone()
        approved_q = conn.execute("SELECT COUNT(*) as cnt FROM AccessRequests WHERE status = 'Approved'").fetchone()
    else:
        total_q = conn.execute("SELECT COUNT(*) as cnt FROM AccessRequests WHERE username = ?", (username,)).fetchone()
        pending_q = conn.execute("SELECT COUNT(*) as cnt FROM AccessRequests WHERE username = ? AND status = 'Pending'", (username,)).fetchone()
        approved_q = conn.execute("SELECT COUNT(*) as cnt FROM AccessRequests WHERE username = ? AND status = 'Approved'", (username,)).fetchone()

    total_requests = total_q["cnt"]
    pending_requests = pending_q["cnt"]
    approved_requests = approved_q["cnt"]

    # Retrieve audit history
    audit_logs = conn.execute("SELECT * FROM AuditLogs ORDER BY id DESC LIMIT 8").fetchall()

    # Retrieve employee requests (for current employee viewer)
    my_requests = []
    if role == "Employee":
        my_requests = conn.execute("SELECT * FROM AccessRequests WHERE username = ? ORDER BY id DESC", (username,)).fetchall()

    # Retrieve pending request authorization rows for Manager/Admin review
    manager_pending = []
    if role in ["Manager", "Admin"]:
        manager_pending = conn.execute("SELECT * FROM AccessRequests WHERE status = 'Pending' ORDER BY id DESC").fetchall()

    conn.close()

    return render_template(
        "dashboard.html",
        username=username,
        role=role,
        total_requests=total_requests,
        pending_requests=pending_requests,
        approved_requests=approved_requests,
        audit_logs=audit_logs,
        my_requests=my_requests,
        manager_pending=manager_pending
    )


@app.route("/submit-request", methods=["POST"])
@login_required
def submit_request():
    """Fallows employees to request resource authorizations."""
    if session["role"] != "Employee":
        flash("Authorization Level Denied: Only employees can request resource scopes.", "danger")
        return redirect(url_for("dashboard"))

    resource_name = request.form.get("resource_name").strip()
    if not resource_name:
        flash("Must specify a valid network vault/resource target.", "danger")
        return redirect(url_for("dashboard"))

    username = session["username"]
    conn = get_db_connection()
    conn.execute("""
        INSERT INTO AccessRequests (username, resource_name, status, request_date)
        VALUES (?, ?, 'Pending', ?)
    """, (username, resource_name, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    conn.commit()
    conn.close()

    log_action(username, f"Requested authorization scope access to target: {resource_name}")
    flash(f"Access request catalogued securely for: {resource_name}", "info")
    return redirect(url_for("dashboard"))


@app.route("/approve-request/<int:request_id>", methods=["POST"])
@login_required
def approve_request(request_id):
    """Enables Managers & Admins to approve access requests."""
    role = session["role"]
    if role not in ["Manager", "Admin"]:
        flash("Access Denied: Only Managers can authorize or sign requests.", "danger")
        return redirect(url_for("dashboard"))

    conn = get_db_connection()
    req_item = conn.execute("SELECT * FROM AccessRequests WHERE id = ?", (request_id,)).fetchone()

    if not req_item:
        flash("Target authorization ticket index does not exist.", "danger")
        conn.close()
        return redirect(url_for("dashboard"))

    conn.execute("UPDATE AccessRequests SET status = 'Approved' WHERE id = ?", (request_id,))
    conn.commit()
    conn.close()

    log_action(session["username"], f"Access Approval for employee {req_item['username']} to: {req_item['resource_name']}")
    flash(f"Access granted securely for user: {req_item['username']}", "success")
    return redirect(url_for("dashboard"))


@app.route("/reject-request/<int:request_id>", methods=["POST"])
@login_required
def reject_request(request_id):
    """Enables Managers & Admins to reject access requests."""
    role = session["role"]
    if role not in ["Manager", "Admin"]:
        flash("Access Denied: Rejection privileges restricted to Managers.", "danger")
        return redirect(url_for("dashboard"))

    conn = get_db_connection()
    req_item = conn.execute("SELECT * FROM AccessRequests WHERE id = ?", (request_id,)).fetchone()

    if not req_item:
        flash("Target authorization ticket index does not exist.", "danger")
        conn.close()
        return redirect(url_for("dashboard"))

    conn.execute("UPDATE AccessRequests SET status = 'Rejected' WHERE id = ?", (request_id,))
    conn.commit()
    conn.close()

    log_action(session["username"], f"Access Rejection for employee {req_item['username']} on resource: {req_item['resource_name']}")
    flash(f"Access scope rejected for user: {req_item['username']}", "warning")
    return redirect(url_for("dashboard"))


@app.route("/admin")
@login_required
def admin():
    """Governs role levels assignment, displays directory, monitors full logs."""
    if session["role"] != "Admin":
        flash("Intruder Alert: Elevated directory console restricted to Admin Operators.", "danger")
        return redirect(url_for("dashboard"))

    conn = get_db_connection()
    all_users = conn.execute("SELECT * FROM Users ORDER BY username ASC").fetchall()
    all_requests = conn.execute("SELECT * FROM AccessRequests ORDER BY id DESC").fetchall()
    full_audit_logs = conn.execute("SELECT * FROM AuditLogs ORDER BY id DESC").fetchall()
    conn.close()

    return render_template(
        "admin.html",
        users=all_users,
        all_requests=all_requests,
        audit_logs=full_audit_logs
    )


@app.route("/admin/change-role", methods=["POST"])
@login_required
def change_role():
    """Handles Role-Based change adjustments, log activity registers."""
    if session["role"] != "Admin":
        flash("Authorization Error: Admin level signature requested.", "danger")
        return redirect(url_for("dashboard"))

    target_user_id = request.form.get("user_id")
    new_role = request.form.get("role")

    if not target_user_id or not new_role:
        flash("Invalid targeting credentials configuration.", "danger")
        return redirect(url_for("admin"))

    if new_role not in ["Admin", "Manager", "Employee"]:
        flash("Invalid role parameter scope.", "danger")
        return redirect(url_for("admin"))

    conn = get_db_connection()
    target_user = conn.execute("SELECT * FROM Users WHERE id = ?", (target_user_id,)).fetchone()

    if not target_user:
        flash("Identity credentials not found inside local system.", "danger")
        conn.close()
        return redirect(url_for("admin"))

    if target_user["username"] == "admin":
        flash("[POLICY PREVENTED] Cannot rewrite primary sovereign Administrator.", "danger")
        conn.close()
        return redirect(url_for("admin"))

    conn.execute("UPDATE Users SET role = ? WHERE id = ?", (new_role, target_user_id))
    conn.commit()
    conn.close()

    log_action(session["username"], f"Role Change targeting {target_user['username']} from {target_user['role']} to {new_role}")
    flash(f"Updated role permission identity for: {target_user['username']} to: {new_role}", "success")
    return redirect(url_for("admin"))


@app.route("/admin/unlock-user/<int:user_id>", methods=["POST"])
@login_required
def unlock_user_post(user_id):
    """Allows Administrator to unlock accounts locked due to too many failed login attempts."""
    if session["role"] != "Admin":
        flash("Authorization Error: Admin level required.", "danger")
        return redirect(url_for("dashboard"))

    conn = get_db_connection()
    target_user = conn.execute("SELECT * FROM Users WHERE id = ?", (user_id,)).fetchone()

    if not target_user:
        flash("User profile mismatch.", "danger")
        conn.close()
        return redirect(url_for("admin"))

    conn.execute("UPDATE Users SET failed_attempts = 0, locked = 0 WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()

    log_action(session["username"], f"Unlocked account for user identification: {target_user['username']}")
    flash(f"Account for {target_user['username']} successfully unlocked and strike counter reset.", "success")
    return redirect(url_for("admin"))


@app.route("/logout")
def logout():
    """Clears digital keys session credentials context."""
    if "username" in session:
        log_action(session["username"], "User Sign Out Successful")
        session.clear()
        flash("Identity vault session closed successfully. Operator off-duty.", "info")
    return redirect(url_for("login"))


# -------------------------------------------------------------
# BOOT EXECUTION CONTEXT
# -------------------------------------------------------------

if __name__ == "__main__":
    # Ensure tables are built
    init_db()
    # Run server locally on 5000 for standard testing
    app.run(host="127.0.0.1", port=5000, debug=True)
