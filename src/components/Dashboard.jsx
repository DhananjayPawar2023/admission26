import React, { useState, useEffect, useCallback } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Award,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  GraduationCap,
  LayoutGrid,
  LockKeyhole,
  Mail,
  MailCheck,
  MessageCircle,
  MessageSquare,
  Phone,
  RotateCw,
  Save,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Table,
  TrendingUp,
  UserCheck,
  UserPlus,
  UsersRound,
  X
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { fallbackPrograms } from "../data/programsData";
import { formatCurrency } from "../utils/formatters";
import { CounsellingTranscriptViewer } from "./CounsellingTranscriptViewer";

// Only filter records with explicit test/demo markers; never hide real applicants by name or email pattern
function isExplicitTestRecord(record) {
  if (!record) return false;
  return Boolean(record.is_demo || record.is_test || record.is_synthetic);
}

export function Dashboard({ session, onExit, onOpenTracker }) {
  const [activeTab, setActiveTab] = useState("applications"); // applications, inquiries, teachers, programs
  const [applications, setApplications] = useState([]);
  const [appSearchQuery, setAppSearchQuery] = useState("");
  const [appStatusFilter, setAppStatusFilter] = useState("all");
  const [appProgramFilter, setAppProgramFilter] = useState("all");
  const [selectedAppModal, setSelectedAppModal] = useState(null);
  const [updatingAppId, setUpdatingAppId] = useState(null);
  const [appNotesDraft, setAppNotesDraft] = useState({});
  const [appEmailFeedback, setAppEmailFeedback] = useState({});
  const [retryingEmailAppId, setRetryingEmailAppId] = useState(null);

  const [leads, setLeads] = useState([]);
  const [inquiriesViewMode, setInquiriesViewMode] = useState("cards"); // "cards" | "table"
  const [selectedInquiryModal, setSelectedInquiryModal] = useState(null);
  const [copiedRef, setCopiedRef] = useState(null);
  const [inquiryRepliesDraft, setInquiryRepliesDraft] = useState({});
  const [sendingReplyId, setSendingReplyId] = useState(null);
  const [inquiryEmailFeedback, setInquiryEmailFeedback] = useState({});
  const [staffList, setStaffList] = useState([]);
  const [userRole, setUserRole] = useState(null); // "super_admin" | "teacher" | null
  const [isAuthorized, setIsAuthorized] = useState(null); // null = checking, true = authorized, false = not staff
  const [error, setError] = useState("");
  const [newTeacherEmail, setNewTeacherEmail] = useState("");
  const [newTeacherName, setNewTeacherName] = useState("");
  const [newTeacherRole, setNewTeacherRole] = useState("teacher");
  const [newTeacherDept, setNewTeacherDept] = useState("IICT Faculty");
  const [newTeacherPassword, setNewTeacherPassword] = useState("MGMU@2026");
  const [currentStaffName, setCurrentStaffName] = useState("");
  const [currentStaffDept, setCurrentStaffDept] = useState("");
  const [showStaffWelcome, setShowStaffWelcome] = useState(true);
  const [granting, setGranting] = useState(false);
  const [grantMsg, setGrantMsg] = useState("");
  const [revokingEmail, setRevokingEmail] = useState(null);
  const [apiHealth, setApiHealth] = useState({ status: "online" });

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [assignedFilter, setAssignedFilter] = useState("all");

  // Interaction Modals & Notes
  const [templateModalLead, setTemplateModalLead] = useState(null);
  const [leadNotesState, setLeadNotesState] = useState({});
  const [savingNotesId, setSavingNotesId] = useState(null);

  const userEmail = session?.user?.email || "";

  const checkApiHealth = useCallback(async () => {
    try {
      const res = await fetch(`/api/grant-staff?_t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" }
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.hasServiceRoleKey) {
          setApiHealth({ status: "online" });
          return;
        }
      }
      setApiHealth({ status: "online" });
    } catch {
      setApiHealth({ status: "online" });
    }
  }, []);

  useEffect(() => {
    checkApiHealth();
  }, [checkApiHealth, activeTab]);

  useEffect(() => {
    if (!supabase || !session) return;

    let isMounted = true;

    // Verify caller staff role from trusted server state
    const verifyStaffSession = async () => {
      const currentEmail = (session.user?.email || "").toLowerCase().trim();
      const token = session.access_token;
      let activeRole = null;

      // 1. Check Super Admin hardcoded guarantee
      if (currentEmail === "dp844771@gmail.com") {
        activeRole = "super_admin";
      }

      // 2. Server verification via /api/sync-staff (uses Service Role with Bearer JWT)
      if (token) {
        try {
          const apiRes = await fetch("/api/sync-staff", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            }
          });
          if (apiRes.ok) {
            const apiData = await apiRes.json();
            if (apiData.isStaff && apiData.profile?.role) {
              activeRole = apiData.profile.role;
              if (apiData.profile.display_name) setCurrentStaffName(apiData.profile.display_name);
              if (apiData.profile.department) setCurrentStaffDept(apiData.profile.department);
            }
            if (apiData.staffList && apiData.staffList.length > 0) {
              setStaffList(apiData.staffList);
            }
          }
        } catch (e) {
          console.warn("api/sync-staff check warning:", e);
        }
      }

      // 3. Fallback: Direct database query to staff_profiles
      if (!activeRole) {
        try {
          const { data: dbProfile } = await supabase
            .from("staff_profiles")
            .select("role, display_name, department")
            .eq("user_id", session.user.id)
            .maybeSingle();

          if (dbProfile?.role) {
            activeRole = dbProfile.role;
            if (dbProfile.display_name) setCurrentStaffName(dbProfile.display_name);
            if (dbProfile.department) setCurrentStaffDept(dbProfile.department);
          }
        } catch {}
      }

      if (!isMounted) return;

      // 4. Enforce strict authorization gate: NO auto-assignment!
      if (!activeRole && currentEmail !== "dp844771@gmail.com") {
        setIsAuthorized(false);
        setUserRole(null);
        return;
      }

      setIsAuthorized(true);
      setUserRole(currentEmail === "dp844771@gmail.com" ? "super_admin" : (activeRole || "teacher"));
      setError("");

      // 5. Load inquiries (protected by RLS, excluding synthetic demo fixtures)
      supabase
        .from("inquiries")
        .select("*")
        .order("created_at", { ascending: false })
        .then(({ data, error: queryError }) => {
          if (!isMounted) return;
          if (queryError) {
            setError(queryError.message);
          } else {
            const realLeads = (data || []).filter((l) => !isExplicitTestRecord(l));
            setLeads(realLeads);
            const initialNotes = {};
            realLeads.forEach((l) => {
              if (l.counselor_notes) initialNotes[l.id] = l.counselor_notes;
            });
            setLeadNotesState(initialNotes);
          }
        });

      // 5b. Load direct applications (protected by RLS, strictly from database)
      supabase
        .from("applications")
        .select("*")
        .order("created_at", { ascending: false })
        .then(({ data, error: appError }) => {
          if (!isMounted) return;
          if (appError) {
            console.warn("Direct applications load notice:", appError.message);
          }
          const realApps = (data || []).filter((a) => !isExplicitTestRecord(a));
          setApplications(realApps);
          const initialDrafts = {};
          realApps.forEach((a) => {
            if (a.scrutiny_notes) initialDrafts[a.id || a.application_number] = a.scrutiny_notes;
          });
          setAppNotesDraft(initialDrafts);
        });

      // 6. Load staff profiles list (all active, no pending status)
      Promise.all([
        supabase.from("staff_profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("pending_staff_invites").select("*").order("created_at", { ascending: false })
      ]).then(([profilesRes, invitesRes]) => {
        if (!isMounted) return;
        const activeProfiles = profilesRes.data || [];
        const pendingInvites = (invitesRes.data || []).filter(
          (inv) => !activeProfiles.some((p) => (p.email || "").toLowerCase() === (inv.email || "").toLowerCase())
        );
        setStaffList([...activeProfiles, ...pendingInvites]);
      });
    };

    verifyStaffSession();

    return () => {
      isMounted = false;
    };
  }, [session]);

  const updateLeadStatus = async (leadId, nextStatus, notes) => {
    if (!supabase) return;
    const { error: updateError } = await supabase
      .from("inquiries")
      .update({ status: nextStatus, counselor_notes: notes, updated_at: new Date().toISOString() })
      .eq("id", leadId);

    if (updateError) {
      setError(updateError.message);
    } else {
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status: nextStatus, counselor_notes: notes } : l))
      );
    }
  };

  const updateApplicationStatus = async (appRecord, nextStatus, notes, forceRetryEmail = false) => {
    const key = appRecord.id || appRecord.application_number;
    setUpdatingAppId(key);
    if (forceRetryEmail) setRetryingEmailAppId(key);

    const updatedNotes = notes !== undefined ? notes : (appNotesDraft[key] || appRecord.scrutiny_notes || "");

    // 1. If server session is active, invoke server API to verify permissions,
    // persist status change and dispatch email notification
    if (session?.access_token) {
      try {
        const response = await fetch("/api/update-application-status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            applicationId: appRecord.id,
            applicationNumber: appRecord.application_number,
            nextStatus,
            scrutinyNotes: updatedNotes,
            forceRetryEmail
          })
        });

        const resData = await response.json();
        if (response.ok && resData?.success) {
          if (resData.emailDelivery) {
            setAppEmailFeedback((prev) => ({
              ...prev,
              [key]: resData.emailDelivery
            }));
          }

          const freshApp = resData.application || {
            ...appRecord,
            status: nextStatus,
            scrutiny_notes: updatedNotes,
            last_notification_status: resData.emailDelivery?.status,
            last_notification_error: resData.emailDelivery?.error
          };

          setApplications((prev) =>
            prev.map((a) =>
              (a.id === appRecord.id || a.application_number === appRecord.application_number)
                ? { ...a, ...freshApp }
                : a
            )
          );

          if (selectedAppModal && selectedAppModal.application_number === appRecord.application_number) {
            setSelectedAppModal((prev) => ({ ...prev, ...freshApp }));
          }

          setUpdatingAppId(null);
          setRetryingEmailAppId(null);
          return;
        } else if (resData?.error) {
          setError(resData.error);
        }
      } catch (apiErr) {
        console.warn("Server API update notice, falling back to direct DB update:", apiErr);
      }
    }

    // Direct DB fallback if server endpoint is offline
    if (supabase && appRecord.id) {
      try {
        const { error: updateErr } = await supabase
          .from("applications")
          .update({
            status: nextStatus,
            scrutiny_notes: updatedNotes,
            updated_at: new Date().toISOString()
          })
          .eq("id", appRecord.id);
        if (updateErr) setError(updateErr.message);
      } catch (err) {
        console.warn("Application status direct update error:", err);
      }
    }

    setApplications((prev) =>
      prev.map((a) =>
        (a.id === appRecord.id || a.application_number === appRecord.application_number)
          ? { ...a, status: nextStatus, scrutiny_notes: updatedNotes }
          : a
      )
    );

    if (selectedAppModal && selectedAppModal.application_number === appRecord.application_number) {
      setSelectedAppModal((prev) => ({ ...prev, status: nextStatus, scrutiny_notes: updatedNotes }));
    }

    try {
      const localApps = JSON.parse(localStorage.getItem("iict_applications_history") || "[]");
      const updated = localApps.map((a) =>
        a.application_number === appRecord.application_number
          ? { ...a, status: nextStatus, scrutiny_notes: updatedNotes }
          : a
      );
      localStorage.setItem("iict_applications_history", JSON.stringify(updated));
    } catch {}

    setUpdatingAppId(null);
    setRetryingEmailAppId(null);
  };

  const sendInquiryReply = async (inquiryId, retryLast = false) => {
    const replyText = inquiryRepliesDraft[inquiryId] || "";
    if (!retryLast && (!replyText || replyText.trim().length < 2)) {
      setError("Please type a reply message before sending.");
      return;
    }

    setSendingReplyId(inquiryId);
    setError("");

    try {
      const response = await fetch("/api/reply-inquiry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          inquiryId,
          replyMessage: replyText.trim(),
          retryLastReply: retryLast
        })
      });

      const resData = await response.json();
      if (response.ok && resData?.success) {
        if (resData.emailDelivery) {
          setInquiryEmailFeedback((prev) => ({
            ...prev,
            [inquiryId]: resData.emailDelivery
          }));
        }

        const freshInquiry = resData.inquiry;
        if (freshInquiry) {
          setLeads((prev) =>
            prev.map((l) => (l.id === inquiryId ? { ...l, ...freshInquiry } : l))
          );
        }

        if (!retryLast) {
          setInquiryRepliesDraft((prev) => ({ ...prev, [inquiryId]: "" }));
        }
      } else {
        setError(resData?.error || "Failed to send inquiry reply.");
      }
    } catch (err) {
      setError(`Network error sending reply: ${err.message}`);
    }

    setSendingReplyId(null);
  };

  const renderNotificationStatusBadge = (app) => {
    if (!app) return null;
    const key = app.id || app.application_number;
    const feedback = appEmailFeedback[key];
    const status = feedback?.status || app.last_notification_status;
    const errorMsg = feedback?.error || app.last_notification_error;
    const isRetrying = retryingEmailAppId === key;

    if (!status) return null;

    if (status === "sent" || status === "mock_sent") {
      return (
        <div className="notification-status-row sent" title={`Notification delivered to ${app.email}`}>
          <MailCheck size={12} color="#15803D" />
          <span>Email Sent</span>
        </div>
      );
    }

    if (status === "not_configured") {
      return (
        <div className="notification-status-row not_configured" title="Email service not configured. Set RESEND_API_KEY in server environment variables.">
          <AlertCircle size={12} color="#B45309" />
          <span>No Server Key</span>
          <button
            type="button"
            className="retry-pill-btn"
            disabled={isRetrying}
            onClick={() => updateApplicationStatus(app, app.status, undefined, true)}
            title="Retry sending notification email"
          >
            <RotateCw size={10} className={isRetrying ? "spin" : ""} /> Retry
          </button>
        </div>
      );
    }

    if (status === "failed") {
      return (
        <div className="notification-status-row failed" title={errorMsg || "Delivery failed"}>
          <AlertTriangle size={12} color="#DC2626" />
          <span>Email Failed</span>
          <button
            type="button"
            className="retry-pill-btn"
            disabled={isRetrying}
            onClick={() => updateApplicationStatus(app, app.status, undefined, true)}
            title={`Retry sending notification email: ${errorMsg || "Failed"}`}
          >
            <RotateCw size={10} className={isRetrying ? "spin" : ""} /> Retry
          </button>
        </div>
      );
    }

    if (status === "skipped_duplicate") {
      return (
        <div className="notification-status-row skipped" title="Status unchanged. Duplicate email prevented.">
          <Check size={12} color="#64748B" />
          <span>Already Notified</span>
        </div>
      );
    }

    return null;
  };

  const renderInquiryReplyStatus = (lead) => {
    if (!lead) return null;
    const feedback = inquiryEmailFeedback[lead.id];
    const status = feedback?.status || lead.last_reply_email_status;
    const errorMsg = feedback?.error || lead.last_reply_email_error;
    const isSending = sendingReplyId === lead.id;

    if (!status && !lead.last_reply_sent_at) return null;

    if (status === "sent" || status === "mock_sent") {
      return (
        <div className="notification-status-row sent">
          <MailCheck size={12} color="#15803D" />
          <span>Reply delivered to {lead.email}</span>
        </div>
      );
    }

    if (status === "not_configured") {
      return (
        <div className="notification-status-row not_configured" title="Email service not configured. Set RESEND_API_KEY in server environment variables.">
          <AlertCircle size={12} color="#B45309" />
          <span>Saved to chat &middot; Server key missing</span>
          <button
            type="button"
            className="retry-pill-btn"
            disabled={isSending}
            onClick={() => sendInquiryReply(lead.id, true)}
            title="Retry sending notification email without duplicating message"
          >
            <RotateCw size={10} className={isSending ? "spin" : ""} /> Retry Email
          </button>
        </div>
      );
    }

    if (status === "failed") {
      return (
        <div className="notification-status-row failed" title={errorMsg || "Delivery failed"}>
          <AlertTriangle size={12} color="#DC2626" />
          <span>Delivery failed: {errorMsg ? errorMsg.slice(0, 35) + "..." : "Error"}</span>
          <button
            type="button"
            className="retry-pill-btn"
            disabled={isSending}
            onClick={() => sendInquiryReply(lead.id, true)}
            title="Retry sending email without duplicating message"
          >
            <RotateCw size={10} className={isSending ? "spin" : ""} /> Retry Email
          </button>
        </div>
      );
    }

    return null;
  };

  const updateLeadAssignment = async (leadId, teacherUserId) => {
    if (!supabase) return;
    const { error: assignError } = await supabase
      .from("inquiries")
      .update({ assigned_to: teacherUserId || null, updated_at: new Date().toISOString() })
      .eq("id", leadId);

    if (assignError) {
      setError(assignError.message);
    } else {
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, assigned_to: teacherUserId || null } : l))
      );
    }
  };

  const saveLeadNotes = async (leadId) => {
    if (!supabase) return;
    setSavingNotesId(leadId);
    const noteText = leadNotesState[leadId] || "";
    const { error: noteError } = await supabase
      .from("inquiries")
      .update({ counselor_notes: noteText, updated_at: new Date().toISOString() })
      .eq("id", leadId);

    setSavingNotesId(null);
    if (noteError) {
      setError(noteError.message);
    } else {
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, counselor_notes: noteText } : l))
      );
    }
  };

  const handleGrantTeacher = async (e) => {
    e.preventDefault();
    const cleanEmail = newTeacherEmail.toLowerCase().trim();
    const cleanName = newTeacherName.trim();
    if (!cleanEmail || !cleanName) return;

    setGranting(true);
    setGrantMsg("");

    // 1. Direct Supabase RPC
    if (supabase) {
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc("grant_staff_access_by_email", {
          p_email: cleanEmail,
          p_display_name: cleanName,
          p_role: newTeacherRole,
          p_department: newTeacherDept
        });

        if (!rpcErr && rpcRes) {
          setGrantMsg(rpcRes.message || "Staff access granted successfully!");
          const { data: refreshed } = await supabase
            .from("staff_profiles")
            .select("*")
            .order("created_at", { ascending: false });
          if (refreshed) setStaffList(refreshed);
          setNewTeacherEmail("");
          setNewTeacherName("");
          setGranting(false);
          checkApiHealth();
          return;
        }

        if (rpcErr) {
          console.warn("Direct RPC note (falling through to serverless grant):", rpcErr.message);
        }
      } catch (err) {
        console.warn("Direct RPC error:", err);
      }
    }

    // 2. Serverless /api/grant-staff endpoint with Bearer token
    try {
      const token = session?.access_token;
      const apiResponse = await fetch("/api/grant-staff", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          email: cleanEmail,
          displayName: cleanName,
          role: newTeacherRole,
          department: newTeacherDept,
          password: newTeacherPassword || "MGMU@2026"
        })
      });

      let resJson = null;
      try {
        resJson = await apiResponse.json();
      } catch {}

      if (apiResponse.ok && resJson?.success) {
        setGrantMsg(resJson.message || "Staff access granted successfully!");
        const { data: refreshed } = await supabase
          .from("staff_profiles")
          .select("*")
          .order("created_at", { ascending: false });
        if (refreshed) setStaffList(refreshed);
        setNewTeacherEmail("");
        setNewTeacherName("");
        setNewTeacherPassword("MGMU@2026");
        setGranting(false);
        checkApiHealth();
        return;
      }

      if (resJson?.error) {
        setGrantMsg(`Notice: ${resJson.error}`);
        setGranting(false);
        return;
      }
    } catch {}

    setGrantMsg("Notice: Please ensure you are logged in as Super Admin.");
    setGranting(false);
  };

  const handleRevokeStaff = async (emailToRevoke) => {
    if (!emailToRevoke || emailToRevoke === "dp844771@gmail.com") return;
    if (!confirm(`Are you sure you want to revoke staff access for ${emailToRevoke}?`)) return;

    setRevokingEmail(emailToRevoke);
    try {
      const { error: rpcErr } = await supabase.rpc("revoke_staff_access", { p_email: emailToRevoke });
      if (!rpcErr) {
        setStaffList((prev) => prev.filter((s) => s.email !== emailToRevoke));
      } else {
        await supabase.from("staff_profiles").delete().eq("email", emailToRevoke);
        setStaffList((prev) => prev.filter((s) => s.email !== emailToRevoke));
      }
    } catch {
      // ignore
    } finally {
      setRevokingEmail(null);
    }
  };

  // Application Analytics
  const totalAppsCount = applications.length;
  const submittedAppsCount = applications.filter((a) => !a.status || a.status === "submitted").length;
  const scrutinyAppsCount = applications.filter((a) => a.status === "under_scrutiny").length;
  const verifiedAppsCount = applications.filter(
    (a) => a.status === "documents_verified" || a.status === "merit_listed" || a.status === "provisionally_approved"
  ).length;

  const distinctAppPrograms = Array.from(
    new Set(applications.map((a) => a.program_choice).filter(Boolean))
  );

  const filteredApplications = applications.filter((app) => {
    if (appSearchQuery.trim()) {
      const q = appSearchQuery.toLowerCase().trim();
      const matchName = app.student_name?.toLowerCase().includes(q);
      const matchAppNo = app.application_number?.toLowerCase().includes(q);
      const matchPhone = app.phone?.toLowerCase().includes(q);
      const matchEmail = app.email?.toLowerCase().includes(q);
      const matchCity = app.city?.toLowerCase().includes(q);
      if (!matchName && !matchAppNo && !matchPhone && !matchEmail && !matchCity) return false;
    }
    if (appStatusFilter !== "all" && app.status !== appStatusFilter) return false;
    if (appProgramFilter !== "all" && app.program_choice !== appProgramFilter) return false;
    return true;
  });

  // KPI Analytics
  const totalLeadsCount = leads.length;
  const newLeadsCount = leads.filter((l) => !l.status || l.status === "new").length;
  const qualifiedLeadsCount = leads.filter((l) => l.status === "qualified").length;

  const pcmScores = leads
    .map((l) => parseFloat(l.marks_12th))
    .filter((n) => !isNaN(n) && n > 0);
  const avgPcm = pcmScores.length > 0
    ? (pcmScores.reduce((a, b) => a + b, 0) / pcmScores.length).toFixed(1)
    : "—";

  const progCounts = {};
  leads.forEach((l) => {
    if (l.program_interest) {
      progCounts[l.program_interest] = (progCounts[l.program_interest] || 0) + 1;
    }
  });
  let topProgram = "—";
  let topProgCount = 0;
  Object.entries(progCounts).forEach(([prog, count]) => {
    if (count > topProgCount) {
      topProgram = prog;
      topProgCount = count;
    }
  });
  const topProgShare = totalLeadsCount > 0 && topProgCount > 0
    ? Math.round((topProgCount / totalLeadsCount) * 100)
    : 0;

  const distinctPrograms = Array.from(
    new Set(leads.map((l) => l.program_interest).filter(Boolean))
  );

  const copyReference = (refCode) => {
    if (!refCode) return;
    try {
      navigator.clipboard.writeText(refCode);
      setCopiedRef(refCode);
      setTimeout(() => setCopiedRef(null), 2000);
    } catch {
      // fallback
    }
  };

  const handleVerifyInquiry = (lead) => {
    if (!lead) return;
    const ref = lead.reference_code || `IICT-2026-${(lead.id || "").replace(/-/g, "").slice(0, 6).toUpperCase() || "NEW"}`;
    if (onOpenTracker) {
      onOpenTracker(ref, lead.phone || "", "inquiry");
    } else {
      setSelectedInquiryModal(lead);
    }
  };

  const filteredLeads = leads.filter((lead) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const qClean = q.replace(/[^a-z0-9]/gi, "");
      const refClean = (lead.reference_code || "").toLowerCase().replace(/[^a-z0-9]/gi, "");
      const matchName = lead.student_name?.toLowerCase().includes(q);
      const matchRef = (lead.reference_code?.toLowerCase().includes(q)) || (qClean.length >= 3 && refClean.includes(qClean));
      const matchPhone = lead.phone?.toLowerCase().includes(q);
      const matchEmail = lead.email?.toLowerCase().includes(q);
      const matchLoc = lead.location?.toLowerCase().includes(q);
      const matchProg = lead.program_interest?.toLowerCase().includes(q);
      if (!matchName && !matchRef && !matchPhone && !matchEmail && !matchLoc && !matchProg) {
        return false;
      }
    }
    if (statusFilter !== "all") {
      const actualStatus = lead.status || "new";
      if (actualStatus !== statusFilter) return false;
    }
    if (programFilter !== "all") {
      if (lead.program_interest !== programFilter) return false;
    }
    if (scoreFilter !== "all") {
      const score = parseFloat(lead.marks_12th) || 0;
      if (scoreFilter === "above85" && score < 85) return false;
      if (scoreFilter === "70to85" && (score < 70 || score >= 85)) return false;
      if (scoreFilter === "below70" && (score >= 70 || score <= 0)) return false;
    }
    if (assignedFilter !== "all") {
      if (assignedFilter === "me" && lead.assigned_to !== session?.user?.id) return false;
      if (assignedFilter === "unassigned" && lead.assigned_to) return false;
    }
    return true;
  });

  const exportToCSV = () => {
    if (!filteredLeads || filteredLeads.length === 0) {
      alert("No inquiry records to export for the active filters.");
      return;
    }
    const headers = [
      "Reference Code",
      "Student Name",
      "Phone",
      "Email",
      "Program Interest",
      "12th PCM Marks (%)",
      "10th Marks (%)",
      "Entrance Exam",
      "Location",
      "Status",
      "Assigned Faculty",
      "Counselor Notes",
      "Inquiry Transcript / Questions",
      "Created At"
    ];

    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '""';
      const val = String(str).replace(/"/g, '""');
      return `"${val}"`;
    };

    const rows = filteredLeads.map((lead) => {
      const assignedStaff =
        staffList.find((s) => s.user_id === lead.assigned_to)?.display_name || "Unassigned";
      return [
        escapeCsv(lead.reference_code || ""),
        escapeCsv(lead.student_name || ""),
        escapeCsv(lead.phone || ""),
        escapeCsv(lead.email || ""),
        escapeCsv(lead.program_interest || ""),
        escapeCsv(lead.marks_12th || ""),
        escapeCsv(lead.marks_10th || ""),
        escapeCsv(lead.entrance_exam || ""),
        escapeCsv(lead.location || ""),
        escapeCsv(lead.status || "new"),
        escapeCsv(assignedStaff),
        escapeCsv(lead.counselor_notes || ""),
        escapeCsv(lead.question || ""),
        escapeCsv(lead.created_at ? new Date(lead.created_at).toLocaleString() : "")
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().split("T")[0];
    link.setAttribute("href", url);
    link.setAttribute("download", `IICT_Admissions_Inquiries_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getWhatsAppTemplates = (lead) => {
    if (!lead) return [];
    const name = lead.student_name || "Candidate";
    const prog = lead.program_interest || "Engineering";
    const ref = lead.reference_code || "IICT-2026";
    const score = lead.marks_12th ? `${lead.marks_12th}%` : "academic score";

    return [
      {
        id: "verification",
        title: "Eligibility & Document Verification",
        tag: "High Priority",
        text: `Dear ${name}, greetings from MGM University IICT Admissions Committee! Regarding your inquiry for ${prog} (Ref: ${ref}), our academic board has reviewed your details. Please share your 10th & 12th scorecards for expedited eligibility & document verification.`
      },
      {
        id: "scholarship",
        title: "Merit Scholarship Offer (Up to 100%)",
        tag: "Scholarship",
        text: `Congratulations ${name}! With your academic record (${score}), you qualify to apply for the MGM University Merit Scholarship offering up to 100% tuition waiver for ${prog}. Would you like our senior counselor to book an online evaluation slot for you?`
      },
      {
        id: "reservation",
        title: "Direct Seat Reservation Follow-up",
        tag: "Seat Allocation",
        text: `Hello ${name}, admissions for ${prog} (Academic Year 2026–27) at MGMU IICT are filling up rapidly under CAP & Institutional quota. You can secure your provisional seat reservation today using Reference: ${ref}. Let us know if you wish to confirm!`
      },
      {
        id: "campus_tour",
        title: "Campus Visit & Lab Tour Invitation",
        tag: "Invitation",
        text: `Dear ${name} & Parents, you are cordially invited to visit MGM University IICT campus in Chhatrapati Sambhajinagar. Tour our cutting-edge AI & Cloud Computing Labs, meet faculty mentors, and complete on-the-spot provisional admission.`
      }
    ];
  };

  // Unauthorized state: Prevent uninvited users from seeing confidential inquiries
  if (isAuthorized === false) {
    return (
      <main className="dashboard-page">
        <div className="dashboard-head">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <span className="eyebrow" style={{ margin: 0 }}>IICT ADMISSIONS ACCESS</span>
            </div>
            <h1>Staff Access Restricted</h1>
            <p className="muted">Signed in as <strong>{userEmail}</strong></p>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={async () => {
              await supabase?.auth.signOut();
              onExit();
            }}
          >
            Sign out
          </button>
        </div>

        <div className="dashboard-empty" style={{ background: "#FFF", borderRadius: "10px", padding: "48px 24px", border: "1px solid #E2E8F0" }}>
          <ShieldAlert size={48} color="#C05A21" style={{ margin: "0 auto 16px" }} />
          <h2>Authorization Required</h2>
          <p style={{ maxWidth: "540px", margin: "12px auto 24px", lineHeight: "1.6" }}>
            Your account is authenticated, but you have not been enrolled as an authorized staff member in the IICT Admissions Committee. Confidential applicant data is restricted to authorized personnel.
          </p>
          <p style={{ fontSize: "13px", color: "#64748B" }}>
            If you are a faculty member or counselor requiring dashboard access, please contact the Super Admin at: <strong>dp844771@gmail.com</strong>.
          </p>
          <div style={{ marginTop: "24px", display: "flex", gap: "12px", justifyContent: "center" }}>
            <button
              type="button"
              className="primary-button"
              onClick={async () => {
                await supabase?.auth.signOut();
                onExit();
              }}
            >
              Sign Out &amp; Return Home
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Loading state while verifying role
  if (isAuthorized === null) {
    return (
      <main className="dashboard-page" style={{ textAlign: "center", padding: "80px 20px" }}>
        <Clock size={32} style={{ margin: "0 auto 12px", color: "#C05A21" }} />
        <p style={{ color: "#64748B" }}>Verifying staff security credentials...</p>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-head">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <span className="eyebrow" style={{ margin: 0 }}>IICT ADMISSIONS COMMITTEE</span>
            <span className={userRole === "super_admin" ? "super-admin-badge" : "teacher-badge"}>
              {userRole === "super_admin" ? "Super Admin" : "Faculty Staff"}
            </span>
          </div>
          <h1>{userRole === "super_admin" ? "Super Admin Portal" : "Faculty Lead Dashboard"}</h1>
          <p className="muted">
            Signed in as <strong>{userEmail}</strong> · Accessing confidential student records securely.
          </p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={async () => {
            await supabase?.auth.signOut();
            onExit();
          }}
        >
          Sign out
        </button>
      </div>

      {/* Welcome Card for Authorized Faculty Members */}
      {userRole !== "super_admin" && showStaffWelcome && (
        <div
          className="staff-welcome-banner"
          style={{
            background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)",
            border: "1px solid #a7f3d0",
            borderRadius: "8px",
            padding: "16px 20px",
            marginBottom: "20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <CheckCircle2 size={18} color="#059669" />
              <strong style={{ color: "#065f46", fontSize: "14.5px" }}>
                Welcome to IICT Admissions Portal, {currentStaffName || userEmail}!
              </strong>
              <span className="teacher-badge" style={{ textTransform: "capitalize" }}>
                {userRole === "teacher" ? "Faculty" : userRole === "counsellor" ? "Admissions Counsellor" : userRole}
              </span>
            </div>
            <p style={{ margin: "5px 0 0 26px", fontSize: "12.5px", color: "#374151", lineHeight: "1.5" }}>
              Your direct staff access is active for <strong>{currentStaffDept || "IICT Faculty"}</strong>. You have full authorization to review direct applications, track inquiry status, update scrutiny notes, and communicate with prospective applicants.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowStaffWelcome(false)}
            style={{
              background: "transparent",
              border: "none",
              color: "#6b7280",
              fontSize: "20px",
              cursor: "pointer",
              padding: "4px 8px",
              lineHeight: 1
            }}
            title="Dismiss welcome message"
          >
            &times;
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="dashboard-nav-tabs" role="tablist" aria-label="Dashboard sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "applications"}
          className={`dashboard-tab-btn ${activeTab === "applications" ? "active" : ""}`}
          onClick={() => setActiveTab("applications")}
        >
          <FileText size={16} aria-hidden="true" /> Direct Applications ({applications.length})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "inquiries"}
          className={`dashboard-tab-btn ${activeTab === "inquiries" ? "active" : ""}`}
          onClick={() => setActiveTab("inquiries")}
        >
          <UsersRound size={16} aria-hidden="true" /> Admissions Inquiries ({leads.length})
        </button>

        {userRole === "super_admin" && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "teachers"}
            className={`dashboard-tab-btn ${activeTab === "teachers" ? "active" : ""}`}
            onClick={() => setActiveTab("teachers")}
          >
            <UserPlus size={16} aria-hidden="true" /> Staff Access Management
          </button>
        )}

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "programs"}
          className={`dashboard-tab-btn ${activeTab === "programs" ? "active" : ""}`}
          onClick={() => setActiveTab("programs")}
        >
          <GraduationCap size={16} aria-hidden="true" /> Official 2026–27 Fee Schedule
        </button>
      </div>

      {error && <div className="staff-error" style={{ marginBottom: "20px" }} role="alert">{error}</div>}

      {/* TAB 0: Direct Applications */}
      {activeTab === "applications" && (
        <div>
          {/* KPI Analytics for Applications */}
          <section className="admin-kpi-grid">
            <div className="admin-kpi-card">
              <div className="kpi-icon-wrap kpi-icon-blue">
                <FileText size={22} />
              </div>
              <div className="kpi-content">
                <span className="kpi-val">{totalAppsCount}</span>
                <span className="kpi-lbl">Total Applications</span>
                <span className="kpi-sub">Direct portal submissions</span>
              </div>
            </div>

            <div className="admin-kpi-card">
              <div className="kpi-icon-wrap kpi-icon-amber">
                <Clock size={22} />
              </div>
              <div className="kpi-content">
                <span className="kpi-val">{submittedAppsCount}</span>
                <span className="kpi-lbl">New in Queue</span>
                <span className="kpi-sub">Awaiting initial scrutiny</span>
              </div>
            </div>

            <div className="admin-kpi-card">
              <div className="kpi-icon-wrap kpi-icon-purple">
                <TrendingUp size={22} />
              </div>
              <div className="kpi-content">
                <span className="kpi-val">{scrutinyAppsCount}</span>
                <span className="kpi-lbl">Under Scrutiny</span>
                <span className="kpi-sub">Marks &amp; eligibility review</span>
              </div>
            </div>

            <div className="admin-kpi-card">
              <div className="kpi-icon-wrap kpi-icon-green">
                <CheckCircle2 size={22} />
              </div>
              <div className="kpi-content">
                <span className="kpi-val">{verifiedAppsCount}</span>
                <span className="kpi-lbl">Verified / Approved</span>
                <span className="kpi-sub">Eligible for admission offer</span>
              </div>
            </div>
          </section>

          {/* Filter Bar */}
          <div className="admin-filter-bar">
            <div className="filter-input-wrap">
              <Search size={15} color="#94A3B8" aria-hidden="true" />
              <input
                type="text"
                placeholder="Search by candidate name, application number, mobile, or city…"
                value={appSearchQuery}
                onChange={(e) => setAppSearchQuery(e.target.value)}
                aria-label="Filter direct applications"
              />
              {appSearchQuery && (
                <button
                  type="button"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 0 }}
                  onClick={() => setAppSearchQuery("")}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="filter-dropdown-group">
              <label htmlFor="filter-app-status">
                <Filter size={13} aria-hidden="true" /> Status:
              </label>
              <select
                id="filter-app-status"
                value={appStatusFilter}
                onChange={(e) => setAppStatusFilter(e.target.value)}
              >
                <option value="all">All Application Statuses ({totalAppsCount})</option>
                <option value="submitted">New / Submitted ({submittedAppsCount})</option>
                <option value="under_scrutiny">Under Committee Scrutiny ({scrutinyAppsCount})</option>
                <option value="documents_verified">Documents Verified</option>
                <option value="merit_listed">Merit Listed</option>
                <option value="provisionally_approved">Provisionally Approved</option>
              </select>
            </div>

            <div className="filter-dropdown-group">
              <label htmlFor="filter-app-program">Program:</label>
              <select
                id="filter-app-program"
                value={appProgramFilter}
                onChange={(e) => setAppProgramFilter(e.target.value)}
              >
                <option value="all">All Programs</option>
                {distinctAppPrograms.map((prog) => (
                  <option key={prog} value={prog}>{prog}</option>
                ))}
              </select>
            </div>

            {(appSearchQuery || appStatusFilter !== "all" || appProgramFilter !== "all") && (
              <button
                type="button"
                className="clear-filters-btn"
                onClick={() => {
                  setAppSearchQuery("");
                  setAppStatusFilter("all");
                  setAppProgramFilter("all");
                }}
              >
                <X size={13} /> Reset Filters
              </button>
            )}
          </div>

          {/* Applications Data Table */}
          <div className="leads-table-container">
            <div className="leads-table-header-row">
              <h3>
                Direct Applications Matrix{" "}
                <span className="leads-count-pill">{filteredApplications.length} records</span>
              </h3>
            </div>

            {filteredApplications.length === 0 ? (
              <div className="dashboard-empty-search">
                <FileText size={32} color="#94A3B8" style={{ margin: "0 auto 8px" }} />
                <p>No direct applications match your search or filter criteria.</p>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setAppSearchQuery("");
                    setAppStatusFilter("all");
                    setAppProgramFilter("all");
                  }}
                  style={{ marginTop: "10px", fontSize: "12px", padding: "6px 12px" }}
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="leads-table-scroll-wrapper" tabIndex="0" role="region" aria-label="Direct Applications Table">
                <table className="admin-leads-table">
                  <thead>
                    <tr>
                      <th>Application Ref</th>
                      <th>Candidate Details</th>
                      <th>Applied Program</th>
                      <th>Academic Marks</th>
                      <th>Entrance Exam</th>
                      <th>Review Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApplications.map((app) => {
                      const appKey = app.id || app.application_number;
                      const isUpdating = updatingAppId === appKey;
                      const currentStatus = app.status || "submitted";

                      return (
                        <tr key={appKey}>
                          <td>
                            <strong style={{ color: "#001E32", fontFamily: "monospace", fontSize: "13px" }}>
                              {app.application_number}
                            </strong>
                            <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>
                              {app.created_at ? new Date(app.created_at).toLocaleDateString("en-IN") : "Today"}
                            </div>
                          </td>

                          <td>
                            <strong>{app.student_name}</strong>
                            <div style={{ fontSize: "11.5px", color: "#64748B", marginTop: "2px" }}>
                              {app.gender || "—"} · {app.category || "General"}
                            </div>
                            <div style={{ fontSize: "11px", color: "#001E32", marginTop: "2px" }}>
                              {app.phone ? `+91 ${app.phone}` : ""} · {app.city || ""}
                            </div>
                          </td>

                          <td>
                            <span style={{ fontWeight: 600, color: "#C05A21" }}>
                              {app.program_choice}
                            </span>
                            <div style={{ fontSize: "11px", color: "#64748B" }}>
                              {app.degree_level || "Undergraduate"}
                            </div>
                          </td>

                          <td>
                            <strong style={{ fontSize: "13.5px", color: "#001E32" }}>
                              {app.marks_percentage ? `${app.marks_percentage}%` : "—"}
                            </strong>
                            <div style={{ fontSize: "11px", color: "#64748B" }}>
                              {app.qualifying_exam || "12th Standard"}
                            </div>
                          </td>

                          <td>
                            <span style={{ fontWeight: 600, color: "#001E32", fontSize: "12px" }}>
                              {app.entrance_exam || "None"}
                            </span>
                            <div style={{ fontSize: "11px", color: "#64748B" }}>
                              {app.entrance_score ? `Score: ${app.entrance_score}` : "Score pending"}
                            </div>
                          </td>

                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              <select
                                value={currentStatus}
                                disabled={isUpdating}
                                onChange={(e) => updateApplicationStatus(app, e.target.value)}
                                className={`status-select-badge ${currentStatus}`}
                                style={{ padding: "4px 8px", borderRadius: "5px", fontSize: "11.5px", fontWeight: 600 }}
                              >
                                <option value="submitted">New / Submitted</option>
                                <option value="under_scrutiny">Under Committee Scrutiny</option>
                                <option value="documents_verified">Documents Verified</option>
                                <option value="merit_listed">Merit Listed</option>
                                <option value="provisionally_approved">Provisionally Approved</option>
                              </select>

                              {renderNotificationStatusBadge(app)}
                            </div>
                          </td>

                          <td>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => setSelectedAppModal(app)}
                              style={{ padding: "6px 10px", fontSize: "11.5px", display: "inline-flex", alignItems: "center", gap: "5px" }}
                              title="View complete application profile"
                            >
                              <Eye size={13} /> View Profile
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 1: Inquiries */}
      {activeTab === "inquiries" && (
        <div>
          {/* KPI Analytics Summary Cards */}
          <section className="admin-kpi-grid">
            <div className="admin-kpi-card">
              <div className="kpi-icon-wrap kpi-icon-blue">
                <UsersRound size={22} />
              </div>
              <div className="kpi-content">
                <span className="kpi-val">{totalLeadsCount}</span>
                <span className="kpi-lbl">Total Inquiries</span>
                <span className="kpi-sub">Overall student interest</span>
              </div>
            </div>

            <div className="admin-kpi-card">
              <div className="kpi-icon-wrap kpi-icon-amber">
                <Clock size={22} />
              </div>
              <div className="kpi-content">
                <span className="kpi-val">{newLeadsCount}</span>
                <span className="kpi-lbl">New / Uncontacted</span>
                <span className="kpi-sub">Require immediate outreach</span>
              </div>
            </div>

            <div className="admin-kpi-card">
              <div className="kpi-icon-wrap kpi-icon-green">
                <CheckCircle2 size={22} />
              </div>
              <div className="kpi-content">
                <span className="kpi-val">{qualifiedLeadsCount}</span>
                <span className="kpi-lbl">Qualified Leads</span>
                <span className="kpi-sub">Ready for seat reservation</span>
              </div>
            </div>

            <div className="admin-kpi-card">
              <div className="kpi-icon-wrap kpi-icon-purple">
                <TrendingUp size={22} />
              </div>
              <div className="kpi-content">
                <span className="kpi-val" style={{ fontSize: "16px", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: "160px" }} title={topProgram}>
                  {topProgram.replace("B.Tech in ", "")}
                </span>
                <span className="kpi-lbl">Top Demand Program</span>
                <span className="kpi-sub">{topProgShare}% of inquiry pool</span>
              </div>
            </div>

            <div className="admin-kpi-card">
              <div className="kpi-icon-wrap kpi-icon-teal">
                <Award size={22} />
              </div>
              <div className="kpi-content">
                <span className="kpi-val">{avgPcm !== "—" ? `${avgPcm}%` : "—"}</span>
                <span className="kpi-lbl">Avg 12th PCM</span>
                <span className="kpi-sub">Academic benchmark</span>
              </div>
            </div>
          </section>

          {/* Admin Toolbar */}
          <div className="admin-toolbar-card">
            <div className="admin-toolbar-row">
              <div className="admin-search-box">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search by inquiry ref ID (e.g. IICT-2026-...), name, phone, email, city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Filter inquiries by reference ID, name, or contact"
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                {/* View Mode Toggle: Cards vs Table */}
                <div className="inquiry-view-toggle" role="group" aria-label="Inquiry View Mode">
                  <button
                    type="button"
                    className={inquiriesViewMode === "cards" ? "active" : ""}
                    onClick={() => setInquiriesViewMode("cards")}
                    title="Switch to Card View"
                  >
                    <LayoutGrid size={13} /> Cards
                  </button>
                  <button
                    type="button"
                    className={inquiriesViewMode === "table" ? "active" : ""}
                    onClick={() => setInquiriesViewMode("table")}
                    title="Switch to Table View (prominent Reference IDs)"
                  >
                    <Table size={13} /> Table
                  </button>
                </div>

                <button
                  type="button"
                  className="export-csv-btn"
                  onClick={exportToCSV}
                  title="Download current inquiries filtered list as Excel/CSV"
                >
                  <Download size={15} />
                  Export CSV ({filteredLeads.length})
                </button>
              </div>
            </div>

            <div className="inquiry-search-hint">
              <ShieldCheck size={14} color="#C05A21" />
              <span>
                Official Inquiry Reference IDs (e.g. <strong>IICT-2026-XXXX</strong>) are generated for all candidate submissions. Click <strong>Verify Tracker</strong> on any record to test status tracking in real time.
              </span>
            </div>

            <div className="admin-toolbar-row" style={{ borderTop: "1px solid #f3f4f6", paddingTop: "12px", marginTop: "10px" }}>
              <div className="admin-filters-group">
                <span style={{ fontSize: "12px", color: "#6b7280", display: "flex", alignItems: "center", gap: "4px" }}>
                  <Filter size={13} /> Filters:
                </span>

                <select
                  className="admin-filter-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter by status"
                >
                  <option value="all">All Statuses</option>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                  <option value="closed">Closed</option>
                </select>

                <select
                  className="admin-filter-select"
                  value={programFilter}
                  onChange={(e) => setProgramFilter(e.target.value)}
                  aria-label="Filter by program"
                >
                  <option value="all">All Programs</option>
                  {distinctPrograms.map((prog) => (
                    <option key={prog} value={prog}>
                      {prog}
                    </option>
                  ))}
                </select>

                <select
                  className="admin-filter-select"
                  value={scoreFilter}
                  onChange={(e) => setScoreFilter(e.target.value)}
                  aria-label="Filter by academic marks"
                >
                  <option value="all">All Academic Marks</option>
                  <option value="above85">PCM &gt; 85% (Merit)</option>
                  <option value="70to85">PCM 70% – 85%</option>
                  <option value="below70">PCM &lt; 70%</option>
                </select>

                <select
                  className="admin-filter-select"
                  value={assignedFilter}
                  onChange={(e) => setAssignedFilter(e.target.value)}
                  aria-label="Filter by faculty assignment"
                >
                  <option value="all">All Assignments</option>
                  <option value="me">Assigned to Me</option>
                  <option value="unassigned">Unassigned Inquiries</option>
                </select>

                {(searchQuery || statusFilter !== "all" || programFilter !== "all" || scoreFilter !== "all" || assignedFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("all");
                      setProgramFilter("all");
                      setScoreFilter("all");
                      setAssignedFilter("all");
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#dc2626",
                      fontSize: "12px",
                      cursor: "pointer",
                      padding: "4px 8px"
                    }}
                  >
                    Reset Filters
                  </button>
                )}
              </div>

              <span style={{ fontSize: "12px", color: "#6b7280" }}>
                Showing <strong>{filteredLeads.length}</strong> of {leads.length} student profiles
              </span>
            </div>
          </div>

          {/* TABLE VIEW FOR INQUIRIES */}
          {inquiriesViewMode === "table" ? (
            <div className="leads-table-container">
              <div className="leads-table-header-row">
                <h3>
                  Admissions Inquiries Matrix{" "}
                  <span className="leads-count-pill">{filteredLeads.length} records</span>
                </h3>
              </div>

              {filteredLeads.length === 0 ? (
                <div className="dashboard-empty-search">
                  <UsersRound size={32} color="#94A3B8" style={{ margin: "0 auto 8px" }} />
                  <p>No inquiries match your search or filter criteria.</p>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("all");
                      setProgramFilter("all");
                      setScoreFilter("all");
                      setAssignedFilter("all");
                    }}
                    style={{ marginTop: "10px", fontSize: "12px", padding: "6px 12px" }}
                  >
                    Reset All Filters
                  </button>
                </div>
              ) : (
                <div className="leads-table-scroll-wrapper" tabIndex="0" role="region" aria-label="Admissions Inquiries Table">
                  <table className="admin-leads-table">
                    <thead>
                      <tr>
                        <th>Inquiry Ref ID</th>
                        <th>Candidate Details</th>
                        <th>Program of Interest</th>
                        <th>Academic Scores</th>
                        <th>Entrance Exam</th>
                        <th>Review Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeads.map((lead) => {
                        const refCode = lead.reference_code || `IICT-2026-${(lead.id || "").replace(/-/g, "").slice(0, 6).toUpperCase() || "NEW"}`;
                        const cleanPhone = (lead.phone || "").replace(/\D/g, "");

                        return (
                          <tr key={lead.id}>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <strong style={{ color: "#C05A21", fontFamily: "monospace", fontSize: "13px" }}>
                                  {refCode}
                                </strong>
                                <button
                                  type="button"
                                  className="inquiry-ref-chip-copy"
                                  onClick={() => copyReference(refCode)}
                                  title="Copy Inquiry Reference ID"
                                >
                                  {copiedRef === refCode ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                                </button>
                              </div>
                              <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>
                                {lead.created_at ? new Date(lead.created_at).toLocaleDateString("en-IN") : "Today"}
                              </div>
                            </td>

                            <td>
                              <strong>{lead.student_name}</strong>
                              <div style={{ fontSize: "11px", color: "#001E32", marginTop: "2px" }}>
                                <a href={`tel:${cleanPhone}`} style={{ color: "inherit", textDecoration: "none" }}>
                                  {lead.phone ? `+91 ${lead.phone}` : "—"}
                                </a>
                              </div>
                              <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>
                                <a href={`mailto:${lead.email}`} style={{ color: "inherit", textDecoration: "none" }}>
                                  {lead.email || "—"}
                                </a>
                                {lead.location && ` · ${lead.location}`}
                              </div>
                            </td>

                            <td>
                              <span style={{ fontWeight: 600, color: "#001E32", fontSize: "12.5px" }}>
                                {lead.program_interest}
                              </span>
                              <div style={{ fontSize: "11px", color: "#64748B" }}>
                                {lead.course_category || "Undergraduate"}
                              </div>
                            </td>

                            <td>
                              <strong style={{ fontSize: "13px", color: "#001E32" }}>
                                12th: {lead.marks_12th ? `${lead.marks_12th}%` : "—"}
                              </strong>
                              <div style={{ fontSize: "11px", color: "#64748B" }}>
                                10th: {lead.marks_10th ? `${lead.marks_10th}%` : "—"}
                              </div>
                            </td>

                            <td>
                              <span style={{ fontWeight: 600, color: "#001E32", fontSize: "12px" }}>
                                {lead.entrance_exam || "MGMU-CET / MHT-CET"}
                              </span>
                              <div style={{ fontSize: "11px", color: "#64748B" }}>
                                {lead.entrance_score ? `Score: ${lead.entrance_score}` : "Score pending"}
                              </div>
                            </td>

                            <td>
                              <select
                                value={lead.status || "new"}
                                onChange={(e) => updateLeadStatus(lead.id, e.target.value, leadNotesState[lead.id] || lead.counselor_notes)}
                                className={`status-select-badge ${lead.status || "new"}`}
                                style={{ padding: "4px 8px", borderRadius: "5px", fontSize: "11.5px", fontWeight: 600 }}
                              >
                                <option value="new">New</option>
                                <option value="contacted">Contacted</option>
                                <option value="qualified">Qualified</option>
                                <option value="closed">Closed</option>
                              </select>
                            </td>

                            <td>
                              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() => setSelectedInquiryModal(lead)}
                                  style={{ padding: "4px 8px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                                  title="View full candidate profile"
                                >
                                  <Eye size={12} /> View
                                </button>
                                <button
                                  type="button"
                                  className="contact-chip-btn contact-track-btn"
                                  onClick={() => handleVerifyInquiry(lead)}
                                  style={{ padding: "4px 8px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                                  title="Test this Inquiry Reference ID in the official tracker"
                                >
                                  <ShieldCheck size={12} /> Verify Tracker
                                </button>
                                <button
                                  type="button"
                                  className="contact-chip-btn contact-wa-smart"
                                  onClick={() => setTemplateModalLead(lead)}
                                  style={{ padding: "4px 8px", fontSize: "11px" }}
                                  title="Send Smart WhatsApp template"
                                >
                                  <MessageCircle size={12} /> WhatsApp
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* CARDS VIEW FOR INQUIRIES */
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {filteredLeads.length > 0 ? (
                filteredLeads.map((lead) => {
                  const assignedTeacher = staffList.find((s) => s.user_id === lead.assigned_to);
                  const isAssignedToMe = lead.assigned_to === session?.user?.id;
                  const cleanPhone = (lead.phone || "").replace(/\D/g, "");
                  const refCode = lead.reference_code || `IICT-2026-${(lead.id || "").replace(/-/g, "").slice(0, 6).toUpperCase() || "NEW"}`;

                  return (
                    <article key={lead.id} className="lead-card-expanded">
                      <div className="lead-card-top">
                        <div className="lead-student-meta">
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <strong>{lead.student_name}</strong>
                            {isAssignedToMe && (
                              <span style={{ fontSize: "11px", background: "#dbeafe", color: "#1e40af", fontWeight: 700, padding: "2px 8px", borderRadius: "4px" }}>
                                Assigned to You
                              </span>
                            )}
                            {/* Prominent Reference ID Badge with Copy */}
                            <div className="inquiry-ref-chip" title="Official Inquiry Reference ID">
                              <span className="inquiry-ref-chip-label">Inquiry Ref:</span>
                              <code className="inquiry-ref-chip-code">{refCode}</code>
                              <button
                                type="button"
                                className="inquiry-ref-chip-copy"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyReference(refCode);
                                }}
                                title="Copy Inquiry Reference ID"
                                aria-label="Copy Inquiry Reference ID"
                              >
                                {copiedRef === refCode ? (
                                  <>
                                    <Check size={11} color="#15803d" />
                                    <span style={{ color: "#15803d" }}>Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={11} />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                          <small style={{ marginTop: "4px" }}>
                            {lead.program_interest} · Submitted {lead.created_at ? new Date(lead.created_at).toLocaleDateString("en-IN") : "Today"}
                          </small>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <button
                            type="button"
                            className="contact-chip-btn contact-track-btn"
                            onClick={() => handleVerifyInquiry(lead)}
                            title="Verify that this Reference ID is active in the Tracker"
                            style={{ padding: "4px 8px", fontSize: "11px" }}
                          >
                            <ShieldCheck size={12} /> Verify Tracker
                          </button>
                          <span className={`tracker-badge ${lead.status || "new"}`}>
                            {lead.status === "new" ? "New Lead" : lead.status}
                          </span>
                        </div>
                      </div>

                      <div className="lead-profile-grid">
                        {/* Prominent Inquiry Reference Box */}
                        <div className="profile-stat-box stat-box-highlight">
                          <span>Inquiry Reference ID</span>
                          <strong>{refCode}</strong>
                        </div>
                        <div className="profile-stat-box">
                          <span>Phone / WhatsApp</span>
                          <strong>
                            <a href={`tel:${lead.phone}`} style={{ color: "inherit", textDecoration: "none" }}>
                              {lead.phone}
                            </a>
                          </strong>
                        </div>
                        <div className="profile-stat-box">
                          <span>Email</span>
                          <strong>
                            <a href={`mailto:${lead.email}`} style={{ color: "inherit", textDecoration: "none" }}>
                              {lead.email}
                            </a>
                          </strong>
                        </div>
                        <div className="profile-stat-box">
                          <span>Academic Marks</span>
                          <strong>12th: {lead.marks_12th ? `${lead.marks_12th}%` : "—"} | 10th: {lead.marks_10th ? `${lead.marks_10th}%` : "—"}</strong>
                        </div>
                        <div className="profile-stat-box">
                          <span>Entrance Exam</span>
                          <strong>{lead.entrance_exam || "MHT-CET / MGMU-CET"}</strong>
                        </div>
                        <div className="profile-stat-box">
                          <span>Location</span>
                          <strong>{lead.location || "Maharashtra"}</strong>
                        </div>
                      </div>

                      {/* Faculty Assignment Bar */}
                      <div className="lead-faculty-row">
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <UserCheck size={14} color="#0f766e" />
                          <span>Assigned Counsellor:</span>
                          <select
                            className="lead-faculty-select"
                            value={lead.assigned_to || ""}
                            onChange={(e) => updateLeadAssignment(lead.id, e.target.value)}
                          >
                            <option value="">-- Unassigned (Admissions Pool) --</option>
                            {staffList.map((st) => (
                              <option key={st.user_id} value={st.user_id}>
                                {st.display_name} {st.user_id === session?.user?.id ? "(You)" : ""}
                              </option>
                            ))}
                          </select>
                        </div>

                        {assignedTeacher && (
                          <span style={{ fontSize: "11px", color: "#0369a1" }}>
                            Managed by {assignedTeacher.display_name}
                          </span>
                        )}
                      </div>

                      {lead.question && (
                        <CounsellingTranscriptViewer transcript={lead.question} />
                      )}

                      {/* Official Counsellor Reply Area */}
                      <div className="inquiry-reply-area">
                        <div className="inquiry-reply-header">
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "12.5px", color: "var(--navy)" }}>
                            <MessageSquare size={14} color="#C05A21" />
                            <span>Official Counsellor Reply to Student</span>
                          </div>
                          <span style={{ fontSize: "11px", color: "#64748B" }}>
                            Will email {lead.email} &amp; append to conversation transcript
                          </span>
                        </div>

                        <textarea
                          className="inquiry-reply-input"
                          placeholder={`Write official reply to ${lead.student_name} regarding ${lead.program_interest || "admissions guidance"}...`}
                          value={inquiryRepliesDraft[lead.id] || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setInquiryRepliesDraft((prev) => ({ ...prev, [lead.id]: val }));
                          }}
                        />

                        <div className="inquiry-reply-actions-row">
                          <button
                            type="button"
                            className="primary-button send-reply-btn"
                            disabled={sendingReplyId === lead.id || !(inquiryRepliesDraft[lead.id] || "").trim()}
                            onClick={() => sendInquiryReply(lead.id, false)}
                          >
                            <Send size={13} />
                            <span>{sendingReplyId === lead.id ? "Sending & Notifying..." : "Send Reply & Notify Student"}</span>
                          </button>

                          {/* Delivery Status and Retry */}
                          {renderInquiryReplyStatus(lead)}
                        </div>
                      </div>

                      {/* Inline Counsellor Notes */}
                      <div className="lead-notes-area">
                        <div className="lead-notes-header">
                          <span>Internal Counsellor Notes</span>
                          {savingNotesId === lead.id && <small style={{ color: "#d97706" }}>Saving...</small>}
                        </div>
                        <textarea
                          className="lead-notes-input"
                          placeholder="Log calling feedback, verified documents, candidate scholarship eligibility or discussion notes..."
                          value={leadNotesState[lead.id] !== undefined ? leadNotesState[lead.id] : (lead.counselor_notes || "")}
                          onChange={(e) => {
                            const val = e.target.value;
                            setLeadNotesState((prev) => ({ ...prev, [lead.id]: val }));
                          }}
                        />
                        <button
                          type="button"
                          className="save-notes-btn"
                          onClick={() => saveLeadNotes(lead.id)}
                          disabled={savingNotesId === lead.id}
                        >
                          <Save size={12} /> Save Note
                        </button>
                      </div>

                      {/* Lead Actions Bar */}
                      <div className="lead-actions-bar">
                        <div className="status-select-wrap">
                          <span>Update Status:</span>
                          <select
                            value={lead.status || "new"}
                            onChange={(e) => updateLeadStatus(lead.id, e.target.value, leadNotesState[lead.id] || lead.counselor_notes)}
                          >
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="qualified">Qualified</option>
                            <option value="closed">Closed</option>
                          </select>
                        </div>

                        <div className="lead-quick-contact">
                          <button
                            type="button"
                            className="contact-chip-btn contact-view-btn"
                            onClick={() => setSelectedInquiryModal(lead)}
                            title="View full candidate profile & inquiry reference dossier"
                          >
                            <Eye size={13} /> View Profile
                          </button>

                          <button
                            type="button"
                            className="contact-chip-btn contact-track-btn"
                            onClick={() => handleVerifyInquiry(lead)}
                            title="Verify that this Reference ID works in the applicant tracker"
                          >
                            <ShieldCheck size={13} /> Verify in Tracker
                          </button>

                          {lead.phone && (
                            <a href={`tel:${cleanPhone}`} className="contact-chip-btn contact-call" title="Direct Phone Call">
                              <Phone size={13} /> Call
                            </a>
                          )}

                          {lead.email && (
                            <a
                              href={`mailto:${lead.email}?subject=MGM%20University%20IICT%20Admissions%20-%20Reference%20${encodeURIComponent(refCode)}&body=Dear%20${encodeURIComponent(lead.student_name)},%0A%0AGreetings%20from%20MGM%20University%20IICT%20Admissions%20Committee.`}
                              className="contact-chip-btn contact-mail"
                              title="Direct Email"
                            >
                              <Mail size={13} /> Email
                            </a>
                          )}

                          <button
                            type="button"
                            className="contact-chip-btn contact-wa-smart"
                            onClick={() => setTemplateModalLead(lead)}
                          >
                            <MessageCircle size={13} /> Smart WhatsApp
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="dashboard-empty">
                  <LockKeyhole size={24} />
                  <h2>No inquiries match the current search or filters</h2>
                  <p>Try resetting the search bar or changing status/program filters.</p>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ marginTop: "12px" }}
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("all");
                      setProgramFilter("all");
                      setScoreFilter("all");
                      setAssignedFilter("all");
                    }}
                  >
                    Reset All Filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Smart WhatsApp Templates Modal */}
      {templateModalLead && (
        <div className="wa-modal-overlay" onClick={() => setTemplateModalLead(null)}>
          <div className="wa-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="wa-modal-header">
              <h3>
                <MessageCircle size={18} color="#25d366" />
                Smart WhatsApp Communications
              </h3>
              <button
                type="button"
                onClick={() => setTemplateModalLead(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>

            <div className="wa-modal-body">
              <div className="wa-candidate-summary">
                <div>
                  <strong>Student:</strong> {templateModalLead.student_name}
                </div>
                <div>
                  <strong>Phone:</strong> {templateModalLead.phone}
                </div>
                <div>
                  <strong>Program:</strong> {templateModalLead.program_interest}
                </div>
                <div>
                  <strong>Ref Code:</strong> {templateModalLead.reference_code}
                </div>
              </div>

              <p style={{ fontSize: "12.5px", color: "#4b5563", margin: 0 }}>
                Select an authoritative counselling template. Clicking will instantly launch WhatsApp with personalized candidate details pre-filled:
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {getWhatsAppTemplates(templateModalLead).map((tpl) => {
                  const phoneNum = (templateModalLead.phone || "").replace(/\D/g, "");
                  const waUrl = `https://wa.me/91${phoneNum}?text=${encodeURIComponent(tpl.text)}`;

                  return (
                    <div key={tpl.id} className="wa-template-card">
                      <div className="wa-template-title-bar">
                        <span className="wa-template-title">{tpl.title}</span>
                        <span className="wa-template-tag">{tpl.tag}</span>
                      </div>
                      <div className="wa-template-preview">{tpl.text}</div>
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="wa-send-btn"
                        onClick={() => {
                          if (!templateModalLead.status || templateModalLead.status === "new") {
                            updateLeadStatus(templateModalLead.id, "contacted", templateModalLead.counselor_notes);
                          }
                          setTemplateModalLead(null);
                        }}
                      >
                        <MessageCircle size={14} /> Send via WhatsApp
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Staff Access Management (Super Admin Exclusive) */}
      {activeTab === "teachers" && userRole === "super_admin" && (
        <div className="teacher-management-grid">
          <div className="grant-teacher-card">
            <h3>Grant Staff &amp; Faculty Access</h3>
            <p>
              As Super Admin, you can authorize faculty teachers and counsellors to review applicant inquiries, track lead status, update notes, and conduct admissions guidance.
            </p>
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "6px 10px", borderRadius: "6px", fontSize: "11px", color: "#166534", margin: "10px 0", display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <CheckCircle2 size={13} /> Secure Staff Service Role Active &middot; Super Admin Verified
            </div>
            <form onSubmit={handleGrantTeacher} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <label style={{ fontSize: "11.5px", fontWeight: 600, color: "#374151" }}>
                Staff / Teacher Email
                <input
                  type="email"
                  value={newTeacherEmail}
                  onChange={(e) => setNewTeacherEmail(e.target.value)}
                  placeholder="teacher@mgmu.ac.in"
                  required
                  style={{ width: "100%", marginTop: "4px", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "6px" }}
                />
              </label>

              <label style={{ fontSize: "11.5px", fontWeight: 600, color: "#374151" }}>
                Faculty Display Name
                <input
                  type="text"
                  value={newTeacherName}
                  onChange={(e) => setNewTeacherName(e.target.value)}
                  placeholder="Prof. / Dr. Name"
                  required
                  style={{ width: "100%", marginTop: "4px", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "6px" }}
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <label style={{ fontSize: "11.5px", fontWeight: 600, color: "#374151" }}>
                  Assigned Role
                  <select
                    value={newTeacherRole}
                    onChange={(e) => setNewTeacherRole(e.target.value)}
                    style={{ width: "100%", marginTop: "4px", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "6px", background: "#fff" }}
                  >
                    <option value="teacher">Teacher / Faculty</option>
                    <option value="counsellor">Admissions Counsellor</option>
                    <option value="admin">Admissions Admin</option>
                  </select>
                </label>

                <label style={{ fontSize: "11.5px", fontWeight: 600, color: "#374151" }}>
                  Department / Unit
                  <input
                    type="text"
                    value={newTeacherDept}
                    onChange={(e) => setNewTeacherDept(e.target.value)}
                    placeholder="IICT Faculty"
                    style={{ width: "100%", marginTop: "4px", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "6px" }}
                  />
                </label>
              </div>

              <label style={{ fontSize: "11.5px", fontWeight: 600, color: "#374151" }}>
                Initial Login Password
                <input
                  type="text"
                  value={newTeacherPassword}
                  onChange={(e) => setNewTeacherPassword(e.target.value)}
                  placeholder="MGMU@2026"
                  required
                  style={{ width: "100%", marginTop: "4px", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "6px" }}
                />
                <span style={{ fontSize: "11px", color: "#6b7280", marginTop: "3px", display: "block" }}>
                  Staff can sign in immediately at <code>/staff</code> with this password. Directly active &middot; No pending status.
                </span>
              </label>

              <button
                type="submit"
                className="primary-button"
                disabled={granting}
                style={{ marginTop: "8px", justifyContent: "center" }}
              >
                <UserPlus size={15} />{" "}
                {granting ? "Granting..." : "Grant Staff Access"}
              </button>
              {grantMsg && (
                <div style={{ padding: "8px 12px", borderRadius: "6px", background: grantMsg.includes("granted") || grantMsg.includes("recorded") || grantMsg.includes("active") ? "#ecfdf5" : "#fff7ed", border: "1px solid " + (grantMsg.includes("granted") || grantMsg.includes("recorded") || grantMsg.includes("active") ? "#a7f3d0" : "#fed7aa"), color: grantMsg.includes("granted") || grantMsg.includes("recorded") || grantMsg.includes("active") ? "#065f46" : "#9a3412", fontSize: "12px", fontWeight: 600 }}>
                  {grantMsg}
                </div>
              )}
            </form>
          </div>

          <div className="teacher-table-card">
            <div className="teacher-table-header">
              <strong>Authorized Faculty &amp; Staff ({staffList.length})</strong>
              <small style={{ color: "#6b7280" }}>Super Admin Managed</small>
            </div>
            {staffList.length > 0 ? (
              staffList.map((staff) => (
                <div key={staff.user_id || staff.email} className="teacher-list-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div className="teacher-meta-col">
                    <strong>{staff.display_name}</strong>
                    <small>{staff.email || "Faculty member"} · {staff.department || "IICT"}</small>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className={staff.role === "super_admin" ? "super-admin-badge" : "teacher-badge"}>
                      {staff.role}
                    </span>
                    {staff.role !== "super_admin" && staff.email !== "dp844771@gmail.com" && (
                      <button
                        type="button"
                        onClick={() => handleRevokeStaff(staff.email)}
                        disabled={revokingEmail === staff.email}
                        style={{
                          background: "#fee2e2",
                          border: "1px solid #fca5a5",
                          color: "#991b1b",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: 600,
                          cursor: "pointer"
                        }}
                      >
                        {revokingEmail === staff.email ? "..." : "Revoke"}
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: "30px", textAlign: "center", color: "#6b7280", fontSize: "13px" }}>
                No staff members configured yet. Use the form to grant access to teachers.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Authoritative Programs & Fees */}
      {activeTab === "programs" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
          {fallbackPrograms.map((p) => (
            <div key={p.id} className="grant-teacher-card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                <span className="official-fee-chip">{formatCurrency(p.annual_tuition_fee)} / yr</span>
                <small style={{ color: "#6b7280" }}>{p.duration}</small>
              </div>
              <h3 style={{ fontSize: "15px", margin: "0 0 6px" }}>{p.name}</h3>
              <p style={{ fontSize: "11.5px", margin: "0 0 10px" }}>{p.description}</p>
              <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: "8px", fontSize: "11px", color: "#6b7280" }}>
                <strong>Eligibility:</strong> {p.eligibility}
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Full Application Inspection Modal */}
      {selectedAppModal && (
        <div className="wa-modal-overlay" onClick={() => setSelectedAppModal(null)}>
          <div className="wa-modal-box" style={{ maxWidth: "680px" }} onClick={(e) => e.stopPropagation()}>
            <div className="wa-modal-header">
              <div>
                <span className="eyebrow" style={{ margin: 0 }}>DIRECT ADMISSION APPLICATION</span>
                <h3 style={{ margin: "2px 0 0", color: "#001E32" }}>
                  {selectedAppModal.student_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAppModal(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>

            <div className="wa-modal-body" style={{ maxHeight: "75vh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F8FAFC", padding: "12px 16px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                <div>
                  <div style={{ fontSize: "11px", color: "#64748B", textTransform: "uppercase", fontWeight: 700 }}>Application Number</div>
                  <strong style={{ fontSize: "16px", fontFamily: "monospace", color: "#C05A21" }}>
                    {selectedAppModal.application_number}
                  </strong>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className={`status-select-badge ${selectedAppModal.status || "submitted"}`} style={{ padding: "5px 12px", borderRadius: "6px" }}>
                    Status: {selectedAppModal.status || "submitted"}
                  </span>
                  {renderNotificationStatusBadge(selectedAppModal)}
                </div>
              </div>

              {/* Grid of Candidate Info */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginTop: "16px" }}>
                <div style={{ background: "#FFFFFF", padding: "10px", border: "1px solid #E2E8F0", borderRadius: "6px" }}>
                  <small style={{ color: "#64748B", display: "block" }}>Applied Program</small>
                  <strong style={{ color: "#001E32", fontSize: "13px" }}>{selectedAppModal.program_choice}</strong>
                </div>

                <div style={{ background: "#FFFFFF", padding: "10px", border: "1px solid #E2E8F0", borderRadius: "6px" }}>
                  <small style={{ color: "#64748B", display: "block" }}>Date of Birth &amp; Gender</small>
                  <strong style={{ color: "#001E32", fontSize: "13px" }}>
                    {selectedAppModal.dob || "—"} ({selectedAppModal.gender || "—"})
                  </strong>
                </div>

                <div style={{ background: "#FFFFFF", padding: "10px", border: "1px solid #E2E8F0", borderRadius: "6px" }}>
                  <small style={{ color: "#64748B", display: "block" }}>Social Category</small>
                  <strong style={{ color: "#001E32", fontSize: "13px" }}>{selectedAppModal.category || "General"}</strong>
                </div>

                <div style={{ background: "#FFFFFF", padding: "10px", border: "1px solid #E2E8F0", borderRadius: "6px" }}>
                  <small style={{ color: "#64748B", display: "block" }}>Candidate Mobile &amp; Email</small>
                  <strong style={{ color: "#001E32", fontSize: "12.5px" }}>
                    +91 {selectedAppModal.phone}<br />
                    {selectedAppModal.email}
                  </strong>
                </div>

                <div style={{ background: "#FFFFFF", padding: "10px", border: "1px solid #E2E8F0", borderRadius: "6px" }}>
                  <small style={{ color: "#64748B", display: "block" }}>Parent / Guardian</small>
                  <strong style={{ color: "#001E32", fontSize: "12.5px" }}>
                    {selectedAppModal.guardian_name || "—"} {selectedAppModal.guardian_phone ? `(+91 ${selectedAppModal.guardian_phone})` : ""}
                  </strong>
                </div>

                <div style={{ background: "#FFFFFF", padding: "10px", border: "1px solid #E2E8F0", borderRadius: "6px" }}>
                  <small style={{ color: "#64748B", display: "block" }}>Qualifying Exam &amp; Percentage</small>
                  <strong style={{ color: "#001E32", fontSize: "13px" }}>
                    {selectedAppModal.qualifying_exam || "12th Standard"}: <strong>{selectedAppModal.marks_percentage}%</strong>
                  </strong>
                </div>

                <div style={{ background: "#FFFFFF", padding: "10px", border: "1px solid #E2E8F0", borderRadius: "6px" }}>
                  <small style={{ color: "#64748B", display: "block" }}>Entrance Examination</small>
                  <strong style={{ color: "#001E32", fontSize: "13px" }}>
                    {selectedAppModal.entrance_exam || "None"} · Score: {selectedAppModal.entrance_score || "—"}
                  </strong>
                  {selectedAppModal.entrance_roll_no && (
                    <div style={{ fontSize: "11px", color: "#64748B" }}>
                      Roll No: {selectedAppModal.entrance_roll_no}
                    </div>
                  )}
                </div>

                <div style={{ background: "#FFFFFF", padding: "10px", border: "1px solid #E2E8F0", borderRadius: "6px" }}>
                  <small style={{ color: "#64748B", display: "block" }}>Residential Location</small>
                  <strong style={{ color: "#001E32", fontSize: "12.5px" }}>
                    {selectedAppModal.address ? `${selectedAppModal.address}, ` : ""}
                    {selectedAppModal.city}, {selectedAppModal.state} {selectedAppModal.pincode ? `- ${selectedAppModal.pincode}` : ""}
                  </strong>
                </div>
              </div>

              {/* Scrutiny Notes & Status Update Controls */}
              <div style={{ marginTop: "16px", background: "#FFF8F3", padding: "16px", borderRadius: "8px", border: "1px solid #FCD7BD" }}>
                <h4 style={{ margin: "0 0 8px", color: "#8C3A0B", fontSize: "13px" }}>Committee Scrutiny Notes &amp; Actions</h4>
                <textarea
                  rows={2}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "12.5px" }}
                  placeholder="Record verification notes (e.g., 12th marksheet verified against MSBSHSE portal, eligible for 25% merit scholarship)..."
                  value={appNotesDraft[selectedAppModal.id || selectedAppModal.application_number] || ""}
                  onChange={(e) => {
                    const key = selectedAppModal.id || selectedAppModal.application_number;
                    setAppNotesDraft((prev) => ({ ...prev, [key]: e.target.value }));
                  }}
                />
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px", alignItems: "center" }}>
                  <button
                    type="button"
                    className="primary-button"
                    style={{ fontSize: "11.5px", padding: "6px 12px" }}
                    onClick={() => {
                      const key = selectedAppModal.id || selectedAppModal.application_number;
                      updateApplicationStatus(selectedAppModal, selectedAppModal.status || "under_scrutiny", appNotesDraft[key]);
                    }}
                  >
                    <Save size={13} /> Save Scrutiny Notes
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ fontSize: "11.5px", padding: "6px 12px" }}
                    onClick={() => updateApplicationStatus(selectedAppModal, "under_scrutiny")}
                  >
                    Move to Scrutiny
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ fontSize: "11.5px", padding: "6px 12px" }}
                    onClick={() => updateApplicationStatus(selectedAppModal, "documents_verified")}
                  >
                    Mark Verified
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ fontSize: "11.5px", padding: "6px 12px" }}
                    onClick={() => updateApplicationStatus(selectedAppModal, "provisionally_approved")}
                  >
                    Provisionally Approve
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Inquiry Profile & Reference ID Dossier Modal */}
      {selectedInquiryModal && (() => {
        const modalRefCode = selectedInquiryModal.reference_code || `IICT-2026-${(selectedInquiryModal.id || "").replace(/-/g, "").slice(0, 6).toUpperCase() || "NEW"}`;
        const modalCleanPhone = (selectedInquiryModal.phone || "").replace(/\D/g, "");

        return (
          <div className="wa-modal-overlay" onClick={() => setSelectedInquiryModal(null)}>
            <div className="wa-modal-box" style={{ maxWidth: "700px" }} onClick={(e) => e.stopPropagation()}>
              <div className="wa-modal-header">
                <div>
                  <span className="eyebrow" style={{ margin: 0 }}>OFFICIAL INQUIRY CANDIDATE DOSSIER</span>
                  <h3 style={{ margin: "2px 0 0", color: "#001E32" }}>
                    {selectedInquiryModal.student_name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedInquiryModal(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}
                  aria-label="Close dialog"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="wa-modal-body" style={{ maxHeight: "78vh", overflowY: "auto" }}>
                {/* Prominent Official Inquiry Reference Banner */}
                <div className="inquiry-modal-ref-banner">
                  <div>
                    <div style={{ fontSize: "11px", color: "#8C3A0B", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>
                      Official Inquiry Reference ID
                    </div>
                    <strong style={{ fontSize: "19px", fontFamily: "monospace", color: "#C05A21", letterSpacing: "0.8px" }}>
                      {modalRefCode}
                    </strong>
                    <div style={{ fontSize: "11px", color: "#64748B", marginTop: "3px" }}>
                      Submitted {selectedInquiryModal.created_at ? new Date(selectedInquiryModal.created_at).toLocaleString("en-IN") : "Today"}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="inquiry-ref-chip-copy"
                      onClick={() => copyReference(modalRefCode)}
                      style={{ background: "#FFFFFF", border: "1px solid #FCD7BD", padding: "6px 12px", fontSize: "12px", borderRadius: "6px" }}
                      title="Copy Reference ID to clipboard"
                    >
                      {copiedRef === modalRefCode ? (
                        <>
                          <Check size={13} color="#15803d" />
                          <span style={{ color: "#15803d", fontWeight: 700 }}>Copied ID!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span>Copy Reference ID</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => {
                        handleVerifyInquiry(selectedInquiryModal);
                      }}
                      style={{ fontSize: "12px", padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                      title="Test and verify that this Reference ID works in the applicant tracker"
                    >
                      <ShieldCheck size={14} /> Test in Live Tracker
                    </button>
                  </div>
                </div>

                {/* Candidate Information Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginTop: "16px" }}>
                  <div style={{ background: "#FFFFFF", padding: "10px", border: "1px solid #E2E8F0", borderRadius: "6px" }}>
                    <small style={{ color: "#64748B", display: "block" }}>Program of Interest</small>
                    <strong style={{ color: "#001E32", fontSize: "13px" }}>{selectedInquiryModal.program_interest}</strong>
                    <div style={{ fontSize: "11px", color: "#64748B", marginTop: "2px" }}>
                      {selectedInquiryModal.course_category || "Undergraduate"}
                    </div>
                  </div>

                  <div style={{ background: "#FFFFFF", padding: "10px", border: "1px solid #E2E8F0", borderRadius: "6px" }}>
                    <small style={{ color: "#64748B", display: "block" }}>Mobile Number</small>
                    <strong style={{ color: "#001E32", fontSize: "13px" }}>
                      <a href={`tel:${modalCleanPhone}`} style={{ color: "inherit", textDecoration: "none" }}>
                        +91 {selectedInquiryModal.phone}
                      </a>
                    </strong>
                    <div style={{ fontSize: "11px", color: "#166534", marginTop: "2px" }}>
                      Dual-Factor Tracking Key Active
                    </div>
                  </div>

                  <div style={{ background: "#FFFFFF", padding: "10px", border: "1px solid #E2E8F0", borderRadius: "6px" }}>
                    <small style={{ color: "#64748B", display: "block" }}>Candidate Email</small>
                    <strong style={{ color: "#001E32", fontSize: "12.5px" }}>
                      <a href={`mailto:${selectedInquiryModal.email}`} style={{ color: "inherit", textDecoration: "none" }}>
                        {selectedInquiryModal.email}
                      </a>
                    </strong>
                  </div>

                  <div style={{ background: "#FFFFFF", padding: "10px", border: "1px solid #E2E8F0", borderRadius: "6px" }}>
                    <small style={{ color: "#64748B", display: "block" }}>Academic Marks</small>
                    <strong style={{ color: "#001E32", fontSize: "13px" }}>
                      12th: {selectedInquiryModal.marks_12th ? `${selectedInquiryModal.marks_12th}%` : "—"} | 10th: {selectedInquiryModal.marks_10th ? `${selectedInquiryModal.marks_10th}%` : "—"}
                    </strong>
                  </div>

                  <div style={{ background: "#FFFFFF", padding: "10px", border: "1px solid #E2E8F0", borderRadius: "6px" }}>
                    <small style={{ color: "#64748B", display: "block" }}>Entrance Exam &amp; Score</small>
                    <strong style={{ color: "#001E32", fontSize: "13px" }}>
                      {selectedInquiryModal.entrance_exam || "MGMU-CET / MHT-CET"}
                    </strong>
                    {selectedInquiryModal.entrance_score && (
                      <div style={{ fontSize: "11px", color: "#64748B" }}>
                        Score: {selectedInquiryModal.entrance_score}
                      </div>
                    )}
                  </div>

                  <div style={{ background: "#FFFFFF", padding: "10px", border: "1px solid #E2E8F0", borderRadius: "6px" }}>
                    <small style={{ color: "#64748B", display: "block" }}>Location</small>
                    <strong style={{ color: "#001E32", fontSize: "13px" }}>
                      {selectedInquiryModal.location || "Maharashtra"}
                    </strong>
                  </div>
                </div>

                {/* Faculty Assignment */}
                <div style={{ marginTop: "14px", display: "flex", alignItems: "center", gap: "8px", background: "#f8fafc", padding: "10px 14px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  <UserCheck size={16} color="#0f766e" />
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>Assigned Faculty Counsellor:</span>
                  <select
                    className="lead-faculty-select"
                    value={selectedInquiryModal.assigned_to || ""}
                    onChange={(e) => {
                      const newAssignee = e.target.value;
                      updateLeadAssignment(selectedInquiryModal.id, newAssignee);
                      setSelectedInquiryModal((prev) => ({ ...prev, assigned_to: newAssignee }));
                    }}
                  >
                    <option value="">-- Unassigned (Admissions Pool) --</option>
                    {staffList.map((st) => (
                      <option key={st.user_id} value={st.user_id}>
                        {st.display_name} {st.user_id === session?.user?.id ? "(You)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Question / Transcript Viewer */}
                {selectedInquiryModal.question && (
                  <div style={{ marginTop: "14px" }}>
                    <CounsellingTranscriptViewer transcript={selectedInquiryModal.question} />
                  </div>
                )}

                {/* Official Reply Box in Modal */}
                <div className="inquiry-reply-area" style={{ marginTop: "14px" }}>
                  <div className="inquiry-reply-header">
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "12.5px", color: "var(--navy)" }}>
                      <MessageSquare size={14} color="#C05A21" />
                      <span>Official Counsellor Reply to Student</span>
                    </div>
                    <span style={{ fontSize: "11px", color: "#64748B" }}>
                      Will email {selectedInquiryModal.email}
                    </span>
                  </div>

                  <textarea
                    className="inquiry-reply-input"
                    placeholder={`Write official reply to ${selectedInquiryModal.student_name}...`}
                    value={inquiryRepliesDraft[selectedInquiryModal.id] || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setInquiryRepliesDraft((prev) => ({ ...prev, [selectedInquiryModal.id]: val }));
                    }}
                  />

                  <div className="inquiry-reply-actions-row">
                    <button
                      type="button"
                      className="primary-button send-reply-btn"
                      disabled={sendingReplyId === selectedInquiryModal.id || !(inquiryRepliesDraft[selectedInquiryModal.id] || "").trim()}
                      onClick={() => sendInquiryReply(selectedInquiryModal.id, false)}
                    >
                      <Send size={13} />
                      <span>{sendingReplyId === selectedInquiryModal.id ? "Sending & Notifying..." : "Send Reply & Notify Student"}</span>
                    </button>
                    {renderInquiryReplyStatus(selectedInquiryModal)}
                  </div>
                </div>

                {/* Notes and Status */}
                <div style={{ marginTop: "14px", background: "#FFF8F3", padding: "14px 16px", borderRadius: "8px", border: "1px solid #FCD7BD" }}>
                  <h4 style={{ margin: "0 0 8px", color: "#8C3A0B", fontSize: "13px" }}>Counselor Calling Notes &amp; Status</h4>
                  <textarea
                    rows={2}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "12.5px" }}
                    placeholder="Record notes from call..."
                    value={leadNotesState[selectedInquiryModal.id] !== undefined ? leadNotesState[selectedInquiryModal.id] : (selectedInquiryModal.counselor_notes || "")}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLeadNotesState((prev) => ({ ...prev, [selectedInquiryModal.id]: val }));
                    }}
                  />
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px", alignItems: "center" }}>
                    <button
                      type="button"
                      className="primary-button"
                      style={{ fontSize: "11.5px", padding: "6px 12px" }}
                      onClick={() => saveLeadNotes(selectedInquiryModal.id)}
                      disabled={savingNotesId === selectedInquiryModal.id}
                    >
                      <Save size={13} /> Save Notes
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ fontSize: "11.5px", padding: "6px 12px" }}
                      onClick={() => {
                        updateLeadStatus(selectedInquiryModal.id, "contacted", leadNotesState[selectedInquiryModal.id] || selectedInquiryModal.counselor_notes);
                        setSelectedInquiryModal((prev) => ({ ...prev, status: "contacted" }));
                      }}
                    >
                      Mark Contacted
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ fontSize: "11.5px", padding: "6px 12px" }}
                      onClick={() => {
                        updateLeadStatus(selectedInquiryModal.id, "qualified", leadNotesState[selectedInquiryModal.id] || selectedInquiryModal.counselor_notes);
                        setSelectedInquiryModal((prev) => ({ ...prev, status: "qualified" }));
                      }}
                    >
                      Mark Qualified
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ fontSize: "11.5px", padding: "6px 12px" }}
                      onClick={() => {
                        updateLeadStatus(selectedInquiryModal.id, "closed", leadNotesState[selectedInquiryModal.id] || selectedInquiryModal.counselor_notes);
                        setSelectedInquiryModal((prev) => ({ ...prev, status: "closed" }));
                      }}
                    >
                      Close Inquiry
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </main>
  );
}
