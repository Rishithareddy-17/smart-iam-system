Smart IAM System
Overview
Smart IAM System is a web-based Identity and Access Management (IAM) application developed using Flask and SQLite. It helps organizations manage user identities, authentication, role-based access control (RBAC), access requests, and security audit logs.

This project demonstrates core cybersecurity concepts used in enterprise IAM solutions and is designed for academic and learning purposes.

Features
User Registration and Login

Secure Password Hashing

Role-Based Access Control (RBAC)

Admin

Manager

Employee

Access Request Management

Approval/Rejection Workflow

Account Lockout after Multiple Failed Login Attempts

Audit Logging

Security Dashboard

User Role Management

Technology Stack
Python

Flask

SQLite

HTML

CSS

Bootstrap

Project Structure
iam-system/
│
├── app.py
├── database.db
├── requirements.txt
├── templates/
│   ├── login.html
│   ├── register.html
│   ├── dashboard.html
│   └── admin.html
│
└── static/
    └── style.css
User Roles
Admin
View all users

Change user roles

View access requests

Monitor audit logs

Manager
Review access requests

Approve or reject requests

Employee
Submit access requests

View request status

Security Features
Password Hashing

Role-Based Authorization

Account Lockout after 3 Failed Login Attempts

Audit Trail for Security Events

Session-Based Authentication

Database Tables
Users
id

username

email

password_hash

role

failed_attempts

locked

AccessRequests
id

username

resource_name

status

request_date

AuditLogs
id

username

action

timestamp

Default Admin Account
Username: admin
Password: Admin@123
Role: Admin
Installation
Clone Repository
git clone https://github.com/your-username/smart-iam-system.git
cd smart-iam-system
Install Dependencies
pip install -r requirements.txt
Run Application
python app.py
Dashboard
The dashboard provides:

Logged-in User Information

User Role Details

Total Access Requests

Pending Requests

Approved Requests

Recent Audit Logs

Learning Outcomes
Identity and Access Management (IAM)

Authentication and Authorization

Role-Based Access Control (RBAC)

Secure Password Storage

Access Governance

Audit and Compliance Tracking

Future Enhancements
Multi-Factor Authentication (MFA)

Email Notifications

Password Reset Functionality

Advanced Reporting

Cloud Database Integration

Project Purpose
This project was developed as a cybersecurity-focused academic project to demonstrate practical implementation of Identity and Access Management concepts commonly used in enterprise environments.

Author: S.Rishithareddy
Project: Smart Identity & Access Management (IAM) System
Domain: Cybersecurity / Identity & Access Management (IAM)
