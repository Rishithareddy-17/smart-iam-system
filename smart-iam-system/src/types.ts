/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: string;
  username: string;
  email: string;
  role: "Admin" | "Manager" | "Employee";
  failed_attempts: number;
  locked: boolean;
}

export interface AccessRequest {
  id: string;
  username: string;
  resource_name: string;
  status: "Pending" | "Approved" | "Rejected";
  request_date: string;
}

export interface AuditLog {
  id: string;
  username: string;
  action: string;
  timestamp: string;
}

export interface AuthSession {
  token: string | null;
  user: {
    username: string;
    email: string;
    role: "Admin" | "Manager" | "Employee";
  } | null;
}
