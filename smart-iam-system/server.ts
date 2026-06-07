/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";

const DB_FILE = path.join(process.cwd(), "database.json");

// Helper: Hash password reliably with built-in crypto
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// Simulated SQLite Schemas in database.json
interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  role: "Admin" | "Manager" | "Employee";
  failed_attempts: number;
  locked: boolean;
}

interface AccessRequest {
  id: string;
  username: string;
  resource_name: string;
  status: "Pending" | "Approved" | "Rejected";
  request_date: string;
}

interface AuditLog {
  id: string;
  username: string;
  action: string;
  timestamp: string;
}

interface DBState {
  users: User[];
  requests: AccessRequest[];
  logs: AuditLog[];
}

// Initialize database
function initDatabase() {
  if (!fs.existsSync(DB_FILE)) {
    const defaultState: DBState = {
      users: [
        {
          id: "u1_admin",
          username: "admin",
          email: "admin@iam.security",
          password_hash: hashPassword("Admin@123"),
          role: "Admin",
          failed_attempts: 0,
          locked: false,
        },
        {
          id: "u2_manager",
          username: "manager",
          email: "manager@iam.security",
          password_hash: hashPassword("Manager@123"),
          role: "Manager",
          failed_attempts: 0,
          locked: false,
        },
        {
          id: "u3_employee",
          username: "employee",
          email: "employee@iam.security",
          password_hash: hashPassword("Employee@123"),
          role: "Employee",
          failed_attempts: 0,
          locked: false,
        }
      ],
      requests: [
        {
          id: "r1",
          username: "employee",
          resource_name: "Financial Assets Directory",
          status: "Pending",
          request_date: new Date().toISOString(),
        },
        {
          id: "r2",
          username: "employee",
          resource_name: "Customer Database Production",
          status: "Approved",
          request_date: new Date(Date.now() - 3600000).toISOString(),
        }
      ],
      logs: [
        {
          id: "l1",
          username: "SYSTEM",
          action: "Database Initialized and Seeded with Defaults",
          timestamp: new Date().toISOString(),
        }
      ]
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultState, null, 2));
  }
}

// Load and Save helpers
function loadDB(): DBState {
  initDatabase();
  try {
    const data = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Failed to read database.json, resetting...", err);
    return { users: [], requests: [], logs: [] };
  }
}

function saveDB(state: DBState) {
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2));
}

// Log actions helper
function writeAuditLog(username: string, action: string) {
  const db = loadDB();
  const newLog: AuditLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    username,
    action,
    timestamp: new Date().toISOString(),
  };
  db.logs.unshift(newLog); // Put new logs at front
  saveDB(db);
}

async function startServer() {
  initDatabase();
  const app = express();
  app.use(express.json());

  // Simple Session Store helper (client-token system)
  // In a multi-user visual environment, setting authorization cookies is incredibly clean
  const sessions = new Map<string, string>(); // Token -> Username

  // Middleware to resolve logged in user
  app.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const username = sessions.get(token);
      if (username) {
        (req as any).username = username;
      }
    }
    next();
  });

  // API Check Health
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Auth: Fetch Current user information
  app.get("/api/auth/me", (req, res) => {
    const username = (req as any).username;
    if (!username) {
      return res.status(401).json({ error: "Not logged in" });
    }
    const db = loadDB();
    const user = db.users.find(u => u.username === username);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({
      username: user.username,
      email: user.email,
      role: user.role,
      locked: user.locked,
    });
  });

  // Auth: User Login (with 3-strike policy)
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    const db = loadDB();
    const normalizedUsername = username.trim().toLowerCase();
    const user = db.users.find(u => u.username.toLowerCase() === normalizedUsername);

    if (!user) {
      // Create a spoofed failed log to block brute-force user-enumeration analytics
      writeAuditLog(username, "Login Failure (User does not exist)");
      return res.status(401).json({ error: "Invalid username or password" });
    }

    if (user.locked) {
      writeAuditLog(user.username, "Login Failure (Account already locked)");
      return res.status(403).json({ error: "Account locked due to 3 failed login attempts. Please contact Administrator." });
    }

    const clientHash = hashPassword(password);
    if (user.password_hash === clientHash) {
      // Success
      user.failed_attempts = 0;
      saveDB(db);

      const token = crypto.randomUUID();
      sessions.set(token, user.username);
      writeAuditLog(user.username, "Login Success");

      res.json({
        token,
        user: {
          username: user.username,
          email: user.email,
          role: user.role,
        }
      });
    } else {
      // Failure
      user.failed_attempts += 1;
      let isLoggedWithLockout = false;

      if (user.failed_attempts >= 3) {
        user.locked = true;
        isLoggedWithLockout = true;
      }
      saveDB(db);

      if (isLoggedWithLockout) {
        writeAuditLog(user.username, "Login Failure (Account Locked out after 3 failed attempts)");
        res.status(403).json({
          error: "Account locked due to 3 failed login attempts. Please contact Administrator."
        });
      } else {
        const remaining = 3 - user.failed_attempts;
        writeAuditLog(user.username, `Login Failure (Attempt ${user.failed_attempts}/3)`);
        res.status(401).json({
          error: `Invalid credentials. ${remaining} attempts remaining before account lockout.`
        });
      }
    }
  });

  // Auth: Clear lockout status (Admin privilege)
  app.post("/api/users/unlock", (req, res) => {
    const requesterName = (req as any).username;
    if (!requesterName) {
      return res.status(401).json({ error: "Unauthorized access" });
    }

    const db = loadDB();
    const requester = db.users.find(u => u.username === requesterName);
    if (!requester || requester.role !== "Admin") {
      return res.status(403).json({ error: "Only Admin can unlock users" });
    }

    const { targetUsername } = req.body;
    const targetUser = db.users.find(u => u.username === targetUsername);
    if (!targetUser) {
      return res.status(404).json({ error: "Target user not found" });
    }

    targetUser.locked = false;
    targetUser.failed_attempts = 0;
    saveDB(db);

    writeAuditLog(requester.username, `Unlocked account for user: ${targetUsername}`);
    res.json({ success: true, message: `Account for ${targetUsername} successfully unlocked` });
  });

  // Auth: User Registration
  app.post("/api/auth/register", (req, res) => {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password || !role) {
      return res.status(400).json({ error: "All registration fields are required" });
    }

    // Password validation: minimum 8 characters
    if (password.length < 8) {
      return res.status(400).json({ error: "Security Policy Violation: Password must be at least 8 characters long." });
    }

    const db = loadDB();
    const cleanUsername = username.trim();
    if (db.users.find(u => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
      return res.status(400).json({ error: "Registration failed: Username already registered in system." });
    }

    if (db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase())) {
      return res.status(400).json({ error: "Registration failed: Email already registered in system." });
    }

    const newUser: User = {
      id: `u_${Date.now()}`,
      username: cleanUsername,
      email: email.trim().toLowerCase(),
      password_hash: hashPassword(password),
      role: role as any,
      failed_attempts: 0,
      locked: false,
    };

    db.users.push(newUser);
    saveDB(db);

    writeAuditLog(cleanUsername, `User Registered successfully with role: ${role}`);
    res.status(201).json({ success: true, message: "User registered successfully" });
  });

  // Auth: Logout
  app.post("/api/auth/logout", (req, res) => {
    const username = (req as any).username;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      sessions.delete(token);
    }
    if (username) {
      writeAuditLog(username, "User Logged Out");
    }
    res.json({ success: true });
  });

  // Admin API: List all users
  app.get("/api/users", (req, res) => {
    const username = (req as any).username;
    if (!username) {
      return res.status(401).json({ error: "Not logged in" });
    }
    const db = loadDB();
    const user = db.users.find(u => u.username === username);
    if (!user || user.role !== "Admin") {
      return res.status(403).json({ error: "Admin rights required" });
    }

    // Map out password hash for system security response
    const safeUsers = db.users.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      failed_attempts: u.failed_attempts,
      locked: u.locked,
    }));
    res.json(safeUsers);
  });

  // Admin API: Change user role
  app.post("/api/users/role", (req, res) => {
    const username = (req as any).username;
    if (!username) {
      return res.status(401).json({ error: "Not logged in" });
    }
    const db = loadDB();
    const requester = db.users.find(u => u.username === username);
    if (!requester || requester.role !== "Admin") {
      return res.status(403).json({ error: "Admin rights required" });
    }

    const { targetUsername, newRole } = req.body;
    if (!targetUsername || !newRole) {
      return res.status(400).json({ error: "Target username and role required" });
    }

    if (!["Admin", "Manager", "Employee"].includes(newRole)) {
      return res.status(400).json({ error: "Invalid role specified" });
    }

    if (targetUsername === "admin") {
      return res.status(400).json({ error: "Cannot modify default primary Admin role" });
    }

    const targetUser = db.users.find(u => u.username === targetUsername);
    if (!targetUser) {
      return res.status(404).json({ error: "Target user not found" });
    }

    const oldRole = targetUser.role;
    targetUser.role = newRole as any;
    saveDB(db);

    writeAuditLog(username, `Role Change for ${targetUsername} from ${oldRole} to ${newRole}`);
    res.json({ success: true, message: `Role changed successfully for ${targetUsername}` });
  });

  // Request API: List requests
  app.get("/api/requests", (req, res) => {
    const username = (req as any).username;
    if (!username) {
      return res.status(401).json({ error: "Unauthorized access" });
    }
    const db = loadDB();
    const user = db.users.find(u => u.username === username);
    if (!user) {
      return res.status(404).json({ error: "Invalid user session" });
    }

    if (user.role === "Admin" || user.role === "Manager") {
      // Admins and Managers see all requests
      res.json(db.requests);
    } else {
      // Employees see only their own requests
      const filtered = db.requests.filter(r => r.username === username);
      res.json(filtered);
    }
  });

  // Request API: Submit access request (Employee role)
  app.post("/api/requests", (req, res) => {
    const username = (req as any).username;
    if (!username) {
      return res.status(401).json({ error: "Unauthorized session" });
    }

    const { resource_name } = req.body;
    if (!resource_name || resource_name.trim() === "") {
      return res.status(400).json({ error: "Resource name is required" });
    }

    const db = loadDB();
    const newRequest: AccessRequest = {
      id: `req_${Date.now()}`,
      username,
      resource_name: resource_name.trim(),
      status: "Pending",
      request_date: new Date().toISOString(),
    };

    db.requests.unshift(newRequest);
    saveDB(db);

    writeAuditLog(username, `Submitted access request to resource: ${resource_name}`);
    res.status(201).json(newRequest);
  });

  // Request API: Approve / Reject (Manager or Admin)
  app.post("/api/requests/action", (req, res) => {
    const username = (req as any).username;
    if (!username) {
      return res.status(401).json({ error: "Unauthorized key" });
    }

    const db = loadDB();
    const user = db.users.find(u => u.username === username);
    if (!user || (user.role !== "Manager" && user.role !== "Admin")) {
      return res.status(403).json({ error: "Access Denied: Approvals restricted to Managers or Admins" });
    }

    const { requestId, action } = req.body; // action = "Approved" or "Rejected"
    if (!requestId || !action || !["Approved", "Rejected"].includes(action)) {
      return res.status(400).json({ error: "Invalid parameters" });
    }

    const request = db.requests.find(r => r.id === requestId);
    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (request.status !== "Pending") {
      return res.status(400).json({ error: "Can only decide on Pending requests" });
    }

    request.status = action as any;
    saveDB(db);

    const logAction = action === "Approved" ? "Access Approval" : "Access Rejection";
    writeAuditLog(username, `${logAction} for employee: ${request.username} on resource: ${request.resource_name}`);

    res.json({ success: true, request });
  });

  // Audit Log API: List logs
  app.get("/api/audit-logs", (req, res) => {
    const username = (req as any).username;
    if (!username) {
      return res.status(401).json({ error: "Unauthorized session" });
    }
    const db = loadDB();
    // Audit logs are visible to everyone logged in for demonstration purposes, or limited to Admin/Manager
    res.json(db.logs);
  });

  // Support Vite dev environment or production serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Smart IAM System backend running on http://localhost:${PORT}`);
  });
}

startServer();
