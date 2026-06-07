# Smart Identity & Access Management (IAM) System
### Academic College Security Laboratory Project Demonstration

A lightweight, high-fidelity security gateway simulator designed for college reviews, academic defenses, and cyber-security demonstrations. It implements robust **Role-Based Access Control (RBAC)**, custom-hashed credentials, a **3-Strike Account Lockout Policy**, and a real-time sequential **Audit Logs Table** written to an active SQLite local database.

---

## 🚀 Quick Setup Instructions

Make sure you have **python 3.8+** installed on your system.

### 1. Extract and Navigate
Open your computer terminal or command prompt inside the project folder:
```bash
cd iam-system
```

### 2. Install Package Dependencies
Install Flask and standard packages from the configurations file:
```bash
pip install -r requirements.txt
```

### 3. Start the IAM Application Server
Execute the central boot script:
```bash
python app.py
```

### 4. Open in Browser
Once running, the terminal will indicate server activation. Paste the following URL into your web browser address bar:
```
http://127.0.0.1:5000/
```

---

## 🔒 Default Test Credentials
The database automatically initializes and pre-seeds itself with compliant test accounts on the first execution:

| Role Level | Username | Password (Access Code) | Privileges |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `Admin@123` | Users Privileges, Change Roles, Lockout Overrides / Unlocks, Master Reports |
| **Manager** | `manager` | `Manager@123` | View All Requests, Grant approvals, Reject access |
| **Employee** | `employee` | `Employee@123` | Submit resource clearance forms, inspect own tickets |

*You can write custom usernames and passcodes through the "Onboard New Identity" module on the login gateway.*

---

## 🛠️ Security Policies Implemented

1. **Password Enforcement Policy**: Passwords must satisfy a length check of **at least 8 characters** on registration.
2. **Password Cryptographic Hashing**: Cleartext passwords are never stored. App hashes them using standard cryptographic secure SHA-256 blocks inside the local database.
3. **Firewall Lockout Policy (Strike Counting)**: If an operator triggers **3 unsuccessful login attempts**, the database table `locked` register state flags as true. The operator is denied accesses until a Super-Admin operator applies a "Dismiss Lockout / Unlock Administrator Account" trigger inside the Admin section.
4. **Access Request Workflow**: Employees submit targeted scope requests. Managers/Admins authorize or reject.
5. **Universal Audit Logging Tracker**: Every critical authentication event (successes, registry errors, locked prompts, role changes, grants, rejections) gets tracked with timestamp and username metadata in the local `AuditLogs` SQLite database.
