# Smart Identity & Access Management (IAM) System
### Academic Laboratory Project Report & Security Analysis

---

## 1. ABSTRACT & INTRODUCTION
In modern digital infrastructures, Identity and Access Management (IAM) serves as the primary boundary layer for securing assets, cataloguing credentials, and enforcing the principle of least privilege. This project demonstrates a prototype **Smart IAM System** designed to showcase critical defensive cybersecurity concepts:
- **Authentication Resilience & Hashing Standards**
- **Lockout Mitigation against Brute-Force Tactics (3-Strike Rule)**
- **Role-Based Access Control (RBAC) Governance Workflows**
- **Sovereign System Auditing (SIEM Compliance Tracing)**

Developed in **Python & Flask** utilizing a lightweight local **SQLite3 Database**, the application remains highly performant, modular, and easy to inspect.

---

## 2. SYSTEM ARCHITECTURE & PARADIGM
The system follows a classic Model-View-Controller (MVC) architecture styled with modern Bootstrap responsive grids:
- **Database Layer (SQLite)**: File-backed persistent storage containing `Users`, `AccessRequests`, and `AuditLogs` relations.
- **Server Controller Layer (Flask Python Backend)**: Manages route structures, enforces role logic, monitors authentication sessions, writes system audits, and executes security policies.
- **View Presentation Layer (HTML / Jinja2 / Bootstrap CSS)**: Premium, cyber-themed responsive interface showcasing live logs terminals, interactive action panels, and authorization counters.

---

## 3. DATABASE SCHEMA DESIGN
The database model contains three primary physical tables initialized automatically on server boot:

### 3.1. Users Table
Saves credential signatures, RBAC permissions, and authentication lockout state metadata.
```sql
CREATE TABLE Users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Employee',
    failed_attempts INTEGER DEFAULT 0,
    locked INTEGER DEFAULT 0
);
```

### 3.2. AccessRequests Table
Saves worklist tickets for employees seeking elevated clearances.
```sql
CREATE TABLE AccessRequests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    resource_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    request_date TEXT NOT NULL
);
```

### 3.3. AuditLogs Table
Maintains historical, sequential tracking of critical security handshakes.
```sql
CREATE TABLE AuditLogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    action TEXT NOT NULL,
    timestamp TEXT NOT NULL
);
```

---

## 4. DEFENSIVE CYBERSECURITY CONCEPTS IMPLEMENTED

### 4.1. Cryptographic Hashing Protection
Raw text passwords are never stored in plain text. When an operator registers, the backend passes the passcode through Werkzeug's secure standard hash algorithm blocks `pbkdf2:sha256` or Node equivalents. This shields user logs from rainbow-table lookups or direct file compromises.

### 4.2. Password Strength Policy Enforcement
Password registry mandates require at least **8 characters**. Submissions failing this length trigger immediate rejection alerts to safeguard dictionary-based intrusions.

### 4.3. Brute-Force Rate Limiting (Account Lockout Policy)
Any operator attempting three consecutive failed authentication checks is isolated:
1. `failed_attempts` increments on each mismatch.
2. At the 3rd fail, `locked` triggers `1`.
3. Subsequent login routines verify `locked == 1` and terminate instantly prior to cryptographic verification, mitigating intensive brute force tools.
4. Accounts are only re-enabled after an Administrator activates a manual unlock action database mutation.

### 4.4. Role-Based Access Control (RBAC) Limits
- **Employee**: Can view their dashboard, file authorization requests, and review their history.
- **Manager**: Can monitor full employee files lists, and approve/reject pending resource requests.
- **Admin**: Immutable root operator with oversight to reallocate roles, review logs, and dismiss lockouts.

---

## 5. EXPERIMENTAL TEST CASES MATRIX

| Case ID | Security Test Target | Simulated Input Actions | Anticipated Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :---: |
| **TC-01** | Standard Login Flow | Login: `admin` / Password: `Admin@123` | Session activated; dashboard loads. | **PASS** |
| **TC-02** | Password Policy Enforce | Register user with password length `7` | Blocks registration with "Must be 8+ chars" error. | **PASS** |
| **TC-03** | Auto Account Lockout | Login three times utilizing bad passcodes | Stripped access; database locks; login reports locked state. | **PASS** |
| **TC-04** | Admin Unlock Overrides | Login as admin; click "Dismiss Lockout" | Strikes counter resets; operator successfully rejoins. | **PASS** |
| **TC-05** | RBAC Isolation Verification | Login as `employee`; visit `/admin` route | Redirected to dashboard with immediate Access Denied alerts. | **PASS** |

---

## 6. PROJECT CONCLUSION
This laboratory experiment successfully models a highly secure, easy-to-read Identity and Access Management System. By coupling responsive interactive user views with secure server middleware checks, the system establishes a clean balance of operational transparency, secure data storage, and strict policy enforcement suitable for professional grading and academic review.
