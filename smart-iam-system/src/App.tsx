/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Shield, 
  ShieldAlert, 
  Lock, 
  Unlock, 
  User, 
  UserPlus, 
  Power, 
  Terminal, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Hourglass, 
  Send, 
  Fingerprint, 
  Activity, 
  Users, 
  Eye, 
  Settings, 
  RefreshCw,
  AlertTriangle,
  Info
} from "lucide-react";
import { User as UserType, AccessRequest, AuditLog } from "./types";

export default function App() {
  // Navigation: "login" | "register" | "dashboard" | "admin"
  const [currentView, setCurrentView] = useState<"login" | "register" | "dashboard" | "admin">("login");
  
  // Auth state
  const [token, setToken] = useState<string | null>(localStorage.getItem("iam_session_token"));
  const [currentUser, setCurrentUser] = useState<{ username: string; email: string; role: "Admin" | "Manager" | "Employee" } | null>(null);
  
  // Forms state
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRole, setRegRole] = useState<"Admin" | "Manager" | "Employee">("Employee");
  const [resourceTarget, setResourceTarget] = useState("");
  
  // Metrics & Board Data state
  const [requestsList, setRequestsList] = useState<AccessRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [usersList, setUsersList] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [utcTime, setUtcTime] = useState("");

  // Refs
  const terminalLogsBottomRef = useRef<HTMLDivElement>(null);

  // Helper clock ticker
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setUtcTime(now.toISOString().replace("T", " ").substring(0, 19) + " UTC");
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Set alert messages timed clear-outs
  const triggerError = (msg: string) => {
    setErrorMessage(msg);
    setSuccessMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const triggerSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setErrorMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Fetch current user details on boot or token changes
  const fetchCurrentUser = async (authToken: string) => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: {
          "Authorization": `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data);
        setCurrentView("dashboard");
      } else {
        // Token expired/invalid
        handleLogout();
      }
    } catch (e) {
      handleLogout();
    }
  };

  useEffect(() => {
    if (token) {
      fetchCurrentUser(token);
    }
  }, [token]);

  // General loader for dashboard components tables
  const reloadDashboardData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      // 1. Fetch access requests
      const reqsRes = await fetch("/api/requests", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (reqsRes.ok) {
        const reqs = await reqsRes.json();
        setRequestsList(reqs);
      }

      // 2. Fetch Audit Trace Logs
      const logsRes = await fetch("/api/audit-logs", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (logsRes.ok) {
        const logs = await logsRes.json();
        setAuditLogs(logs);
      }

      // 3. Fetch full users directory if Admin
      if (currentUser?.role === "Admin") {
        const usersRes = await fetch("/api/users", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (usersRes.ok) {
          const usrList = await usersRes.json();
          setUsersList(usrList);
        }
      }
    } catch (e) {
      console.error("Failed to sync dashboard states", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      reloadDashboardData();
    }
  }, [currentUser]);

  // Scroll to bottom of terminal when logs render
  useEffect(() => {
    if (terminalLogsBottomRef.current) {
      terminalLogsBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [auditLogs]);

  // Auth: Submit login credentials
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername || !loginPassword) {
      triggerError("Operator inputs are blank.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("iam_session_token", data.token);
        setToken(data.token);
        setCurrentUser(data.user);
        setLoginUsername("");
        setLoginPassword("");
        triggerSuccess(`Credentials approved: Authorized key operator ${data.user.username}`);
      } else {
        triggerError(data.error || "Authentication rejected.");
      }
    } catch (err) {
      triggerError("Network gateway sync failure.");
    } finally {
      setLoading(false);
    }
  };

  // Auth: Submit enrollment registry
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regUsername || !regEmail || !regPassword || !regRole) {
      triggerError("Enrollment fields are blank.");
      return;
    }

    if (regPassword.length < 8) {
      triggerError("Security Alert: Password must be at least 8 characters long to resolve cryptography.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: regUsername,
          email: regEmail,
          password: regPassword,
          role: regRole
        })
      });
      const data = await res.json();
      if (res.ok) {
        triggerSuccess("Operator identity enrolled successfully! Ready to authenticate secure key.");
        setRegUsername("");
        setRegEmail("");
        setRegPassword("");
        setCurrentView("login");
      } else {
        triggerError(data.error || "Registration rejected.");
      }
    } catch (err) {
      triggerError("System database failure during registry.");
    } finally {
      setLoading(false);
    }
  };

  // Auth: Sign out operator
  const handleLogout = async () => {
    if (token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` }
        });
      } catch (e) {}
    }
    localStorage.removeItem("iam_session_token");
    setToken(null);
    setCurrentUser(null);
    setRequestsList([]);
    setAuditLogs([]);
    setUsersList([]);
    setCurrentView("login");
    triggerSuccess("Operator off-duty channel closed. Session context flushed.");
  };

  // Access Requests: Request scope submission (Employee role)
  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resourceTarget.trim()) {
      triggerError("Resource clearance target is blank.");
      return;
    }
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ resource_name: resourceTarget })
      });
      if (res.ok) {
        setResourceTarget("");
        triggerSuccess(`Clearance access ticket registered for target: ${resourceTarget}`);
        reloadDashboardData();
      } else {
        const err = await res.json();
        triggerError(err.error || "Request failed.");
      }
    } catch (e) {
      triggerError("Failed to trace clearance ticket to local server.");
    }
  };

  // Access Requests: Approve/Reject action cards (Manager or Admin role)
  const handleRequestAction = async (requestId: string, action: "Approved" | "Rejected") => {
    try {
      const res = await fetch("/api/requests/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ requestId, action })
      });
      if (res.ok) {
        triggerSuccess(`Ticket authorized action applied: ${action}`);
        reloadDashboardData();
      } else {
        const err = await res.json();
        triggerError(err.error || "Approval override denied.");
      }
    } catch (e) {
      triggerError("Connection failure during governance override.");
    }
  };

  // Admin: Clear login account lockout (Admin only)
  const handleUnlockUser = async (targetUsername: string) => {
    try {
      const res = await fetch("/api/users/unlock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ targetUsername })
      });
      if (res.ok) {
        triggerSuccess(`Identity lockout overrides applied successfully: ${targetUsername} is unlocked.`);
        reloadDashboardData();
      } else {
        const err = await res.json();
        triggerError(err.error || "Override command failed.");
      }
    } catch (e) {
      triggerError("Database write error resetting firewalls.");
    }
  };

  // Admin: Alter User privileges role structure (Admin only)
  const handleRoleChange = async (targetUsername: string, newRole: "Admin" | "Manager" | "Employee") => {
    try {
      const res = await fetch("/api/users/role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ targetUsername, newRole })
      });
      if (res.ok) {
        triggerSuccess(`RBAC Policy revised: ${targetUsername} updated to ${newRole}`);
        reloadDashboardData();
      } else {
        const err = await res.json();
        triggerError(err.error || "Role reallocation failed.");
      }
    } catch (e) {
      triggerError("Connection failure updating authorization tables.");
    }
  };

  // Helper counter calculations
  const pendingRequests = requestsList.filter(r => r.status === "Pending").length;
  const approvedRequests = requestsList.filter(r => r.status === "Approved").length;
  const deniedRequests = requestsList.filter(r => r.status === "Rejected").length;

  return (
    <div id="iam_system_interface" className="min-h-screen bg-[#020617] text-slate-200 font-sans antialiased text-sm flex flex-col md:flex-row overflow-x-hidden md:overflow-hidden">
      {currentUser ? (
        // LOGGED-IN: SLEEK LAYOUT WITH SIDEBAR + RIGHT WRAPPER CONTENT AREA
        <div className="flex h-screen w-full bg-[#020617] text-slate-200 font-sans overflow-hidden">
          
          {/* Sidebar Left */}
          <aside className="w-64 bg-[#0f172a] border-r border-slate-800 hidden md:flex flex-col shrink-0">
            {/* Brand Title block */}
            <div className="p-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <h1 className="font-bold text-lg tracking-tight text-white select-none cursor-pointer" onClick={() => setCurrentView("dashboard")}>SmartIAM</h1>
              </div>
            </div>

            {/* Nav Menu */}
            <nav className="flex-1 p-4 space-y-2">
              <button
                id="nav_dash_btn"
                onClick={() => setCurrentView("dashboard")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-l-2 transition-all text-left font-medium ${
                  currentView === "dashboard"
                    ? "bg-indigo-500/10 text-indigo-400 border-indigo-500"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200 border-transparent"
                }`}
              >
                <Activity className="w-5 h-5 shrink-0" />
                <span>Dashboard</span>
              </button>

              {currentUser.role === "Admin" && (
                <button
                  id="nav_admin_btn"
                  onClick={() => setCurrentView("admin")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-l-2 transition-all text-left font-medium ${
                    currentView === "admin"
                      ? "bg-indigo-500/10 text-rose-455 border-[#f43f5e] text-rose-400"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200 border-transparent"
                  }`}
                >
                  <Users className="w-5 h-5 shrink-0" />
                  <span>User Directory</span>
                </button>
              )}
            </nav>

            {/* Profile Panel Bottom */}
            <div className="p-4 mt-auto border-t border-slate-800 bg-[#0a0f1d]">
              <div className="flex items-center gap-3 p-3 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-350 ring-2 ring-slate-800 uppercase">
                  {currentUser.username.substring(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{currentUser.username}</p>
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">{currentUser.role}</p>
                </div>
              </div>
            </div>
          </aside>

          {/* Right Main Panel */}
          <main className="flex-1 flex flex-col h-full overflow-y-auto bg-[#020617]">
            {/* Header block */}
            <header className="h-16 bg-[#0f172a] border-b border-slate-800 flex items-center justify-between px-6 md:px-8 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 font-medium">System Status:</span>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> SECURE
                </span>
                <span className="hidden sm:inline-block ml-3 px-1.5 py-0.5 rounded text-[10px] uppercase font-mono tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Live Iframe Environment
                </span>
              </div>

              {/* Navigation Options for Mobile View */}
              <div className="flex items-center gap-4">
                <div className="md:hidden flex items-center gap-2">
                  <button 
                    onClick={() => setCurrentView("dashboard")} 
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded ${currentView === "dashboard" ? "bg-indigo-500/15 text-indigo-400" : "text-slate-400"}`}
                  >
                    Dash
                  </button>
                  {currentUser.role === "Admin" && (
                    <button 
                      onClick={() => setCurrentView("admin")} 
                      className={`px-2.5 py-1.5 text-xs font-semibold rounded ${currentView === "admin" ? "bg-indigo-500/15 text-indigo-400" : "text-slate-400"}`}
                    >
                      Admin
                    </button>
                  )}
                </div>

                <div className="h-4 w-[1px] bg-slate-800 hidden md:block"></div>

                <button 
                  id="nav_logout_btn"
                  onClick={handleLogout}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-sm font-semibold rounded-lg hover:bg-slate-700 transition-colors border border-slate-700 hover:text-white cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            </header>

            {/* Central content container */}
            <div className="p-6 md:p-8 flex-1 flex flex-col gap-8">
              
              {/* Notifications / Alerts banner wrapper */}
              {successMessage && (
                <div id="iam_success_banner" className="flex items-start gap-3 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-emerald-200 animate-fadeIn shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs">
                    <strong className="font-bold">SYSTEM AUDIT VERIFICATION SUCCESS:</strong> {successMessage}
                  </div>
                  <button onClick={() => setSuccessMessage(null)} className="text-slate-400 hover:text-white font-semibold text-xs ml-2 cursor-pointer">✕</button>
                </div>
              )}

              {errorMessage && (
                <div id="iam_error_banner" className="flex items-start gap-3 p-4 rounded-lg bg-red-500/5 border border-red-500/20 text-red-200 animate-fadeIn shrink-0">
                  <ShieldAlert className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs">
                    <strong className="font-bold">SECURITY GATEWAY ALERT:</strong> {errorMessage}
                  </div>
                  <button onClick={() => setErrorMessage(null)} className="text-slate-400 hover:text-white font-semibold text-xs ml-2 cursor-pointer">✕</button>
                </div>
              )}

              {/* ------------------ INNER SUBVIEW: SECURITY DASHBOARD ------------------ */}
              {currentView === "dashboard" && (
                <div className="space-y-6">
                  {/* Securized Welcome Bar */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-4 border-b border-slate-800">
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight text-white mb-1 flex items-center gap-2">
                        <Activity className="h-6 w-6 text-indigo-400" /> SECURE CONTROL WORKSPACE
                      </h2>
                      <p className="text-slate-400 text-xs">Governing active operational requests, security locks policies, and full threat telemetry.</p>
                    </div>
                    
                    <div className="flex flex-col text-left md:text-right">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">SYSTEM MONITOR SECURE UTC TIME</span>
                      <span className="font-mono text-sm text-[#00e1d9] font-semibold">{utcTime || "SYNCING..."}</span>
                    </div>
                  </div>

                  {/* Sleek dashboard stat cards list */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total Managed Requests</p>
                          <p className="text-3xl font-bold text-white mt-1">{requestsList.length}</p>
                        </div>
                        <div className="h-10 w-10 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg flex items-center justify-center">
                          <Send className="h-5 w-5" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg animate-pulseSlow">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Pending Threat Reviews</p>
                          <p className="text-3xl font-bold text-amber-400 mt-1">{pendingRequests}</p>
                        </div>
                        <div className="h-10 w-10 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-lg flex items-center justify-center">
                          <Hourglass className="h-5 w-5" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Approved Active Grants</p>
                          <p className="text-3xl font-bold text-emerald-400 mt-1">{approvedRequests}</p>
                        </div>
                        <div className="h-10 w-10 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg flex items-center justify-center">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Columns Grid split */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column interactive components */}
                    <div className="lg:col-span-7 space-y-6">
                      
                      {/* Submodule: Employee Resource submission */}
                      {currentUser.role === "Employee" && (
                        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                          <div className="bg-[#0f172a] px-6 py-4 border-b border-slate-800 flex items-center gap-2">
                            <Send className="h-4 w-4 text-indigo-400" />
                            <h5 className="font-bold text-white mb-0 uppercase tracking-wide">REQUEST SYSTEM WORKSPACE RESOURCE ACCESS</h5>
                          </div>
                          <form onSubmit={handleRequestSubmit} className="p-6 space-y-4">
                            <div>
                              <label className="block text-xs font-semibold text-indigo-400 mb-2 uppercase">RESOURCE TARGET CLEARANCE SCOPE</label>
                              <input 
                                id="employee_res_target_input"
                                type="text"
                                required
                                value={resourceTarget}
                                onChange={(e) => setResourceTarget(e.target.value)}
                                placeholder="E.g., AWS S3 Logs Bucket, Corporate Financial spreadsheet"
                                className="w-full bg-[#020617] border border-slate-800 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition text-xs"
                              />
                              <span className="block text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                                Note: All requests trigger an immutable cryptographic log inside our database and must be approved by the designated Manager.
                              </span>
                            </div>
                            <button 
                              id="employee_res_submit_btn"
                              type="submit"
                              className="w-full py-2.5 px-4 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer flex justify-center items-center gap-2 shadow-lg shadow-indigo-500/20"
                            >
                              <Send className="h-4 w-4" /> SUBMIT AUTHORIZATION FORM
                            </button>
                          </form>
                        </div>
                      )}

                      {/* Submodule: Manager Action Worklist approvals */}
                      {(currentUser.role === "Manager" || currentUser.role === "Admin") && (
                        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                          <div className="bg-[#0f172a] px-6 py-4 border-b border-slate-800 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Lock className="h-4 w-4 text-indigo-400" />
                              <h5 className="font-bold text-white mb-0 uppercase tracking-wide">PENDING CLEARANCE TICKETS WORKLIST</h5>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 font-semibold uppercase border border-amber-500/20">
                              Authorization Action Required
                            </span>
                          </div>

                          <div className="p-0 overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="text-[10px] uppercase tracking-widest text-slate-500 border-b border-slate-800 bg-[#0f172a]">
                                  <th className="px-6 py-4 font-bold">REQUE_STER</th>
                                  <th className="px-6 py-4 font-bold">RESOURCE Clearance Target</th>
                                  <th className="px-6 py-4 font-bold">Submission Date</th>
                                  <th className="px-6 py-4 font-bold text-right">SYSTEM DECISION</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/50">
                                {requestsList.filter(r => r.status === "Pending").length > 0 ? (
                                  requestsList.filter(r => r.status === "Pending").map((req) => (
                                    <tr key={req.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 text-xs">
                                      <td className="px-6 py-4 font-bold text-white">@{req.username}</td>
                                      <td className="px-6 py-4 font-mono text-slate-300"><code>{req.resource_name}</code></td>
                                      <td className="px-6 py-4 text-slate-400 font-mono text-[11px]">{new Date(req.request_date).toLocaleString()}</td>
                                      <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                          <button 
                                            id={`approve_btn_${req.id}`}
                                            onClick={() => handleRequestAction(req.id, "Approved")}
                                            className="px-2.5 py-1.5 rounded bg-emerald-400/10 hover:bg-emerald-450/20 border border-emerald-400/20 text-emerald-400 font-medium text-[11px] transition cursor-pointer"
                                          >
                                            GRANT ACCESS
                                          </button>
                                          <button 
                                            id={`reject_btn_${req.id}`}
                                            onClick={() => handleRequestAction(req.id, "Rejected")}
                                            className="px-2.5 py-1.5 rounded bg-rose-400/10 hover:bg-rose-450/20 border border-rose-400/20 text-rose-400 font-medium text-[11px] transition cursor-pointer"
                                          >
                                            DENY
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={4} className="p-6 text-center text-slate-500 text-xs">
                                      <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-60" />
                                      Dynamic security status: Zero pending access request review items.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Submodule: Historic Action logs list */}
                      <div className="bg-[#0f172a]/50 border border-slate-800 rounded-xl overflow-hidden shadow-lg animate-fadeIn">
                        <div className="bg-[#0f172a] px-6 py-4 border-b border-slate-800 flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Settings className="h-4 w-4 text-slate-400" />
                            <h5 className="font-bold text-white mb-0 uppercase tracking-wide">HISTORIC ACTION CONSOLE LOGS</h5>
                          </div>
                          <button 
                            onClick={reloadDashboardData}
                            className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 hover:underline text-[10px] transition cursor-pointer bg-indigo-500/10 px-2.5 py-1 rounded border border-indigo-500/20 font-bold uppercase tracking-tight"
                          >
                            <RefreshCw className="h-3 w-3" /> RELOAD FEED
                          </button>
                        </div>

                        <div className="p-0 overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="text-[10px] uppercase tracking-widest text-slate-500 border-b border-slate-800 bg-[#0f172a]">
                                <th className="px-6 py-4 font-bold">TICKET ID</th>
                                {currentUser.role !== "Employee" && <th className="px-6 py-4 font-bold">OPERATOR ID</th>}
                                <th className="px-6 py-4 font-bold">RESOURCE ATTEMPT_ TARGET</th>
                                <th className="px-6 py-4 font-bold">SUBMISSION TIME</th>
                                <th className="px-6 py-4 font-bold text-right">STATUS CODE</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                              {requestsList.length > 0 ? (
                                requestsList.map((req) => (
                                  <tr key={req.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 text-xs">
                                    <td className="px-6 py-4 font-mono text-[10px] text-slate-400">#REQ-{req.id.substring(4, 8) || req.id}</td>
                                    {currentUser.role !== "Employee" && <td className="px-6 py-4 text-white font-semibold">@{req.username}</td>}
                                    <td className="px-6 py-4 text-slate-300"><strong>{req.resource_name}</strong></td>
                                    <td className="px-6 py-4 text-slate-400 font-mono text-[11px]">{new Date(req.request_date).toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right">
                                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold border ${
                                        req.status === "Approved" ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20" :
                                        req.status === "Rejected" ? "bg-rose-400/10 text-rose-400 border-rose-400/20" :
                                        "bg-amber-400/10 text-amber-400 border-amber-400/20"
                                      }`}>
                                        {req.status === "Approved" && <CheckCircle2 className="h-3 w-3 text-emerald-450" />}
                                        {req.status === "Rejected" && <XCircle className="h-3 w-3 text-rose-450" />}
                                        {req.status === "Pending" && <Hourglass className="h-3 w-3 text-amber-450" />}
                                        {req.status.toUpperCase()}
                                      </span>
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={currentUser.role === "Employee" ? 4 : 5} className="p-6 text-center text-slate-500 text-xs">
                                    Identity log registers empty. Submit clearance ticket form to register events.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                    </div>

                    {/* Right column: Live Telemetry logs file audit table */}
                    <div className="lg:col-span-5 space-y-6">
                      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg h-full flex flex-col">
                        <div className="bg-[#0f172a] px-6 py-4 border-b border-slate-800 flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Terminal className="h-4 w-4 text-indigo-400 animate-pulse" />
                            <h5 className="font-bold text-white mb-0 uppercase tracking-wide">LIVE THREAT TELEMETRY FEED</h5>
                          </div>
                          <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping"></span>
                        </div>

                        <div className="p-5 bg-[#020617]/90 flex-1 flex flex-col justify-between font-mono text-[11px] min-h-[400px]">
                          <div>
                            <p className="text-slate-500 leading-normal border-b border-slate-800 pb-2.5 mb-3.5 text-[10px]">
                              Sequential actions mirrored live inside local database audit trails. Only Admin and Manager can monitor.
                            </p>

                            <div className="max-h-[360px] overflow-y-auto space-y-2.5 pr-2">
                              {auditLogs.length > 0 ? (
                                auditLogs.map((log) => (
                                  <div key={log.id} className="border-b border-slate-800/30 pb-2 leading-relaxed">
                                    <span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{" "}
                                    <span className="text-rose-400 font-semibold">@{log.username}</span>:{" "}
                                    <span className="text-emerald-400">{log.action}</span>
                                  </div>
                                ))
                              ) : (
                                <div className="text-slate-600 text-center py-6">Telemetry feeds idle. Waiting configuration...</div>
                              )}
                              <div ref={terminalLogsBottomRef}></div>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-800 mt-4 text-right text-[10px] text-slate-500 flex justify-between items-center">
                            <span>TRACE PORT: 3000</span>
                            <span>System DB Thread State: <span className="text-emerald-450 font-bold">MUTEX ACTIVE</span></span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------ INNER SUBVIEW: ROOTS ADMINISTRATIVE DIRECTORY ------------------ */}
              {currentView === "admin" && currentUser?.role === "Admin" && (
                <div className="space-y-6 animate-fadeIn">
                  
                  {/* Title Bar layout */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-4 border-b border-slate-800">
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight text-white mb-1 flex items-center gap-2">
                        <Users className="h-6 w-6 text-rose-500" /> PRIVILEGES DIRECTORY BOARD
                      </h2>
                      <p className="text-slate-400 text-xs">Administrative level commands vault. Revise roles, unlock security firewall blocks, and inspect full tables in real-time.</p>
                    </div>
                    <button 
                      onClick={() => setCurrentView("dashboard")}
                      className="border border-slate-700 text-xs hover:bg-slate-800 font-semibold uppercase px-4 py-2 cursor-pointer rounded-lg text-slate-300 bg-slate-900 transition flex items-center gap-2"
                    >
                      Return Control Desk
                    </button>
                  </div>

                  {/* Users Admin Table */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                    <div className="bg-[#0f172a] px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-gradient-to-r from-[#0f172a] to-[#1e1b4b]/20">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-indigo-400" />
                        <h5 className="font-bold text-white mb-0 uppercase tracking-widest text-xs">ENROLLED SECURE SYSTEM OPERATORS</h5>
                      </div>
                      <span className="px-2.5 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold uppercase">
                        Privileged Root Access
                      </span>
                    </div>

                    <div className="p-0 overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-widest text-slate-500 border-b border-slate-800 bg-[#0f172a]">
                            <th className="px-6 py-4 font-bold">OPERATOR ID</th>
                            <th className="px-6 py-4 font-bold">SECURE COMMUNICATION</th>
                            <th className="px-6 py-4 font-bold">CLEARANCE CATEGORY</th>
                            <th className="px-6 py-4 font-bold">FIREWALL STRIKES</th>
                            <th className="px-6 py-4 font-bold">SECTOR STATE</th>
                            <th className="px-6 py-4 font-bold">REALLOCATE CLEARANCE (RBAC)</th>
                            <th className="px-6 py-4 font-bold text-right">OVERRIDE INTERVENE</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {usersList.length > 0 ? (
                            usersList.map((usr) => (
                              <tr key={usr.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 text-xs">
                                <td className="px-6 py-4 font-bold text-white">@{usr.username}</td>
                                <td className="px-6 py-4 font-mono text-[11px] text-slate-400">{usr.email}</td>
                                <td className="px-6 py-4">
                                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                    usr.role === "Admin" ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                                    usr.role === "Manager" ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" :
                                    "bg-slate-800/55 text-slate-400 border-slate-700/60"
                                  }`}>
                                    {usr.role.toUpperCase()}
                                  </span>
                                </td>
                                <td className="px-6 py-4 font-mono text-slate-400">{usr.failed_attempts}/3 Active Strikes</td>
                                <td className="px-6 py-4">
                                  {usr.locked ? (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.75 text-[10px] font-bold uppercase rounded bg-rose-500/10 border border-rose-500/20 text-rose-450 shadow-[0_0_10px_rgba(244,63,94,0.15)]">
                                      <Lock className="h-3 w-3 shrink-0" /> ACCOUNT LOCKED
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.75 text-[10px] font-bold uppercase rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-450">
                                      <Unlock className="h-3 w-3 shrink-0" /> SECURE ACTIVE
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  {usr.username !== "admin" ? (
                                    <div className="flex items-center gap-2">
                                      <select 
                                        id={`rbac_select_${usr.username}`}
                                        value={usr.role}
                                        onChange={(e) => handleRoleChange(usr.username, e.target.value as any)}
                                        className="bg-[#020617] border border-slate-800 text-white rounded text-[11px] p-1 px-1.5 focus:outline-none focus:border-indigo-500 transition"
                                      >
                                        <option value="Employee">Employee</option>
                                        <option value="Manager">Manager</option>
                                        <option value="Admin">Admin</option>
                                      </select>
                                    </div>
                                  ) : (
                                    <span className="text-slate-500 italic text-[11px]">System Sovereign Operator</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  {usr.locked ? (
                                    <button 
                                      id={`unlock_btn_${usr.username}`}
                                      onClick={() => handleUnlockUser(usr.username)}
                                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-wider transition duration-150 cursor-pointer shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 ml-auto rounded"
                                    >
                                      <Unlock className="h-3 w-3" /> Dismiss Locks
                                    </button>
                                  ) : (
                                    <span className="text-slate-500 font-mono text-[11px]">— No Override Needed</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={7} className="p-6 text-center text-slate-500">Querying security operator directory...</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Decisional Policy indicators */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 animate-fadeIn">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
                      <div className="flex gap-4 items-start">
                        <div className="h-10 w-10 shrink-0 bg-rose-500/10 text-rose-450 border border-rose-500/20 flex items-center justify-center rounded-lg mt-0.5">
                          <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div>
                          <h6 className="font-bold text-white mb-1 uppercase tracking-wide text-xs">Lockout Threshold Policy (Strike 3)</h6>
                          <p className="text-slate-400 text-xs leading-relaxed">
                            To safeguard against active network breaches, any digital identifier register tracking 3 failed consecutive login strikes is automatically isolated (status locked). Clear lockouts above to test passwords.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
                      <div className="flex gap-4 items-start">
                        <div className="h-10 w-10 shrink-0 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center rounded-lg mt-0.5">
                          <Settings className="h-5 w-5" />
                        </div>
                        <div>
                          <h6 className="font-bold text-white mb-1 uppercase tracking-wide text-xs">Role Based Decisional Bounds</h6>
                          <p className="text-slate-400 text-xs leading-relaxed">
                            Admin operators can change and revoke privileges at will. Changes take effect on the very next query trigger session handshake instantly.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              )}

            </div>

            {/* Footer Workspace Block */}
            <footer className="border-t border-slate-800 bg-[#0f172a] text-center py-6 text-xs text-slate-500 space-y-1">
              <p className="m-0">SmartIAM — Constructed on modern full-stack Express & React/TypeScript.</p>
              <p className="m-0 text-[11px] text-slate-600">College Security Laboratory Demonstration Module — SQLite Structure Replicated Securely</p>
            </footer>
          </main>

        </div>
      ) : (
        // NOT LOGGED-IN: SLEEK LOG-IN / REGISTER CARD FRONT DESK
        <div className="min-h-screen w-full flex flex-col justify-between bg-[#020617] text-slate-200">
          
          {/* Header */}
          <header className="h-16 border-b border-slate-800 bg-[#0f172a] flex items-center justify-between px-6 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-lg tracking-tight text-white select-none">SmartIAM</span>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentView("login")}
                className={`px-3 py-1.5 rounded text-xs font-semibold tracking-wider transition uppercase ${currentView === "login" ? "text-indigo-450 text-indigo-400" : "text-slate-400 hover:text-slate-200"}`}
              >
                GATEWAY LOG-IN
              </button>
              <button 
                onClick={() => setCurrentView("register")}
                className={`px-3 py-1.5 rounded text-xs font-semibold tracking-wider transition uppercase ${currentView === "register" ? "text-indigo-450 text-indigo-400" : "text-slate-400 hover:text-slate-200"}`}
              >
                REGISTER ACCOUNT
              </button>
            </div>
          </header>

          {/* Central Workspace block */}
          <div className="flex-1 flex flex-col justify-center items-center py-10 px-4">
            <div className="w-full max-w-md">
              
              {/* Notifications / Alerts banner block */}
              {successMessage && (
                <div id="iam_success_banner" className="mb-6 flex items-start gap-3 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-emerald-200 animate-fadeIn">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs">
                    <strong className="font-bold">SYSTEM AUDIT VERIFICATION SUCCESS:</strong> {successMessage}
                  </div>
                  <button onClick={() => setSuccessMessage(null)} className="text-slate-400 hover:text-white font-semibold text-xs ml-2 cursor-pointer">✕</button>
                </div>
              )}

              {errorMessage && (
                <div id="iam_error_banner" className="mb-6 flex items-start gap-3 p-4 rounded-lg bg-red-500/5 border border-red-500/20 text-red-200 animate-fadeIn">
                  <ShieldAlert className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs">
                    <strong className="font-bold">SECURITY GATEWAY ALERT:</strong> {errorMessage}
                  </div>
                  <button onClick={() => setErrorMessage(null)} className="text-slate-400 hover:text-white font-semibold text-xs ml-2 cursor-pointer">✕</button>
                </div>
              )}

              {/* VIEW: LOGIN */}
              {currentView === "login" && (
                <div>
                  <div className="text-center mb-6">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 mb-4 shadow-lg shadow-indigo-500/15">
                      <Fingerprint className="h-7 w-7" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white mb-1 uppercase">Sovereign Entrance</h1>
                    <p className="text-xs text-slate-400 uppercase tracking-widest">Digital Authentication Gateway</p>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                    <div className="px-6 py-4 bg-[#0f172a] border-b border-slate-800 flex justify-between items-center">
                      <span className="text-xs font-semibold text-indigo-400 tracking-wider">GATEWAY LOG-IN CONSOLE</span>
                      <span className="px-2 py-0.5 rounded text-[9px] bg-slate-800/40 border border-slate-800 text-slate-400 uppercase font-bold">SSL PROTOCOL</span>
                    </div>

                    <form onSubmit={handleLogin} className="p-6 space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase">OPERATOR SECURE USERNAME</label>
                        <input 
                          id="login_username_input"
                          type="text"
                          value={loginUsername}
                          onChange={(e) => setLoginUsername(e.target.value)}
                          required
                          placeholder="Enter username (e.g., admin, employee)"
                          className="w-full bg-[#020617] border border-slate-800 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase">DIGITAL SIGNATURE PASSWORD</label>
                        <input 
                          id="login_password_input"
                          type="password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          required
                          placeholder="Enter login password"
                          className="w-full bg-[#020617] border border-slate-800 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition text-xs"
                        />
                      </div>

                      <button 
                        id="login_submit_btn"
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 px-4 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider transition duration-150 disabled:opacity-50 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 cursor-pointer mt-2"
                      >
                        {loading ? "Authenticating Secure Keys..." : "Verify Identity Signature"}
                      </button>
                    </form>

                    <div className="px-6 py-5 bg-[#0f172a]/50 border-t border-slate-800 text-center text-xs text-slate-500">
                      <span className="block mb-2 font-mono text-[9px] uppercase tracking-widest text-slate-400">AUTHORIZED TESTING CREDENTIALS</span>
                      <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-300 py-2 border-y border-slate-800 mb-3 bg-[#020617] rounded">
                        <div><strong>admin</strong><br />Admin@123</div>
                        <div><strong>manager</strong><br />Manager@123</div>
                        <div><strong>employee</strong><br />Employee@123</div>
                      </div>
                      Don&apos;t have an registered identity?{" "}
                      <button 
                        onClick={() => setCurrentView("register")}
                        className="text-indigo-400 hover:underline hover:text-indigo-305 font-semibold cursor-pointer"
                      >
                        Onboard new operator
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW: REGISTER */}
              {currentView === "register" && (
                <div>
                  <div className="text-center mb-6">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 mb-4 shadow-lg shadow-indigo-500/15">
                      <UserPlus className="h-7 w-7" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white mb-1 uppercase">Operator Registry</h1>
                    <p className="text-xs text-slate-400 uppercase tracking-widest">Enlist Clearance Operator</p>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-fadeIn">
                    <div className="px-6 py-4 bg-[#0f172a] border-b border-slate-800 flex justify-between items-center">
                      <span className="text-xs font-semibold text-indigo-400 tracking-wider">ONBOARD IDENTITY VAULT</span>
                      <span className="px-2 py-0.5 rounded text-[9px] bg-slate-800/40 border border-slate-800 text-slate-400 uppercase font-bold">SECURE GATE</span>
                    </div>

                    <form onSubmit={handleRegister} className="p-6 space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase">CHOOSE OPERATOR USERNAME</label>
                        <input 
                          id="register_username_input"
                          type="text"
                          required
                          value={regUsername}
                          onChange={(e) => setRegUsername(e.target.value)}
                          placeholder="Enter username (lower case without spaces)"
                          className="w-full bg-[#020617] border border-slate-800 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase">SECURE CORPORATE EMAIL</label>
                        <input 
                          id="register_email_input"
                          type="email"
                          required
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          placeholder="E.g., alice@corporate.security"
                          className="w-full bg-[#020617] border border-slate-800 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase">CHOOSE COMPLIANT PASSWORD</label>
                        <input 
                          id="register_password_input"
                          type="password"
                          required
                          minLength={8}
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          placeholder="Must be at least 8 characters long"
                          className="w-full bg-[#020617] border border-slate-800 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition text-xs"
                        />
                        <span className="block text-[10px] text-slate-550 mt-1.5 flex items-center gap-1 text-slate-500">
                          <Info className="h-3 w-3 text-indigo-400 shrinkage-0" /> Passwords strictly require <strong>8+ characters</strong> for hash compliance.
                        </span>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase">ASSIGN SECURITY CLEARED ROLE</label>
                        <select
                          id="register_role_select"
                          value={regRole}
                          onChange={(e) => setRegRole(e.target.value as any)}
                          className="w-full bg-[#020617] border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition text-xs"
                        >
                          <option value="Employee">Employee (Submit Access Requests Catalogue)</option>
                          <option value="Manager">Manager (Approve & Reject Workspace Scopes)</option>
                          <option value="Admin">Admin (Full Overrides & Identity Governance)</option>
                        </select>
                      </div>

                      <button 
                        id="register_submit_btn"
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 px-4 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider transition duration-150 disabled:opacity-50 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 cursor-pointer mt-2"
                      >
                        {loading ? "Registering Clearance Identity..." : "Enroll Operator Profile"}
                      </button>
                    </form>

                    <div className="px-6 py-4 bg-[#0f172a] border-t border-slate-800 text-center text-xs text-slate-500">
                      Already registered clearance keys?{" "}
                      <button 
                        onClick={() => setCurrentView("login")}
                        className="text-indigo-400 hover:underline hover:text-indigo-350 font-semibold cursor-pointer"
                      >
                        Go to security login
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Footer */}
          <footer className="border-t border-slate-850 bg-[#0f172a] text-center py-6 text-xs text-slate-500 space-y-1">
            <p className="m-0">SmartIAM — Constructed on modern full-stack Express & React/TypeScript.</p>
            <p className="m-0 text-[11px] text-slate-600">College Security Laboratory Demonstration Module — SQLite Structure Replicated Securely</p>
          </footer>

        </div>
      )}
    </div>
  );
}
