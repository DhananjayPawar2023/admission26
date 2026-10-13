import React, { useState, useEffect } from "react";
import {
  Award,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  Filter,
  GraduationCap,
  LockKeyhole,
  Mail,
  MessageCircle,
  Phone,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
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

export function Dashboard({ session, onExit }) {
  const [activeTab, setActiveTab] = useState("applications"); // applications, inquiries, teachers, programs
  const [applications, setApplications] = useState([]);
  const [appSearchQuery, setAppSearchQuery] = useState("");
  const [appStatusFilter, setAppStatusFilter] = useState("all");
  const [appProgramFilter, setAppProgramFilter] = useState("all");
  const [selectedAppModal, setSelectedAppModal] = useState(null);
  const [updatingAppId, setUpdatingAppId] = useState(null);
  const [appNotesDraft, setAppNotesDraft] = useState({});

  const [leads, setLeads] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [userRole, setUserRole] = useState(null); // "super_admin" | "teacher" | null
  const [isAuthorized, setIsAuthorized] = useState(null); // null = checking, true = authorized, false = not staff
  const [error, setError] = useState("");
  const [newTeacherEmail, setNewTeacherEmail] = useState("");
  const [newTeacherName, setNewTeacherName] = useState("");
  const [newTeacherRole, setNewTeacherRole] = useState("teacher");
  const [newTeacherDept, setNewTeacherDept] = useState("IICT Faculty");
  const [granting, setGranting] = useState(false);
  const [grantMsg, setGrantMsg] = useState("");
  const [revokingEmail, setRevokingEmail] = useState(null);
  const [apiHealth, setApiHealth] = useState(null);

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

  useEffect(() => {
    if (activeTab === "teachers") {
      fetch("/api/grant-staff")
        .then((res) => res.json())
        .then((data) => {
          if (data?.hasServiceRoleKey) {
            setApiHealth({ status: "online" });
          } else {
            setApiHealth({ status: "missing_key" });
          }
        })
        .catch(() => {
          setApiHealth({ status: "unreachable" });
        });
    }
  }, [activeTab]);

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
            .select("role")
            .eq("user_id", session.user.id)
            .maybeSingle();

          if (dbProfile?.role) {
            activeRole = dbProfile.role;
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

      // 6. Load staff profiles list and pending invites
      Promise.all([
        supabase.from("staff_profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("pending_staff_invites").select("*").order("created_at", { ascending: false })
      ]).then(([profilesRes, invitesRes]) => {
        if (!isMounted) return;
        const activeProfiles = profilesRes.data || [];
        const pendingInvites = (invitesRes.data || []).map((inv) => ({
          ...inv,
          isPending: true
        }));
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

  const updateApplicationStatus = async (appRecord, nextStatus, notes) => {
    const key = appRecord.id || appRecord.application_number;
    setUpdatingAppId(key);
    const updatedNotes = notes !== undefined ? notes : (appNotesDraft[key] || appRecord.scrutiny_notes || "");

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
        console.warn("Application status update error:", err);
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
          return;
        }

        if (rpcErr && rpcErr.message && !rpcErr.message.includes("not found")) {
          setGrantMsg(`Notice: ${rpcErr.message}`);
          setGranting(false);
          return;
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
          department: newTeacherDept
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
        setGranting(false);
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

  const filteredLeads = leads.filter((lead) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = lead.student_name?.toLowerCase().includes(q);
      const matchRef = lead.reference_code?.toLowerCase().includes(q);
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
                  placeholder="Search by student name, ref code, phone, email, city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Filter inquiries by name or contact"
                />
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

            <div className="admin-toolbar-row" style={{ borderTop: "1px solid #f3f4f6", paddingTop: "12px" }}>
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

          {/* Inquiries List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {filteredLeads.length > 0 ? (
              filteredLeads.map((lead) => {
                const assignedTeacher = staffList.find((s) => s.user_id === lead.assigned_to);
                const isAssignedToMe = lead.assigned_to === session?.user?.id;
                const cleanPhone = (lead.phone || "").replace(/\D/g, "");

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
                        </div>
                        <small>
                          Ref: {lead.reference_code} · {lead.program_interest} · {new Date(lead.created_at).toLocaleDateString()}
                        </small>
                      </div>
                      <span className={`tracker-badge ${lead.status || "new"}`}>
                        {lead.status === "new" ? "New Lead" : lead.status}
                      </span>
                    </div>

                    <div className="lead-profile-grid">
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
                        {lead.phone && (
                          <a href={`tel:${cleanPhone}`} className="contact-chip-btn contact-call" title="Direct Phone Call">
                            <Phone size={13} /> Call
                          </a>
                        )}

                        {lead.email && (
                          <a
                            href={`mailto:${lead.email}?subject=MGM%20University%20IICT%20Admissions%20-%20Reference%20${encodeURIComponent(lead.reference_code || "")}&body=Dear%20${encodeURIComponent(lead.student_name)},%0A%0AGreetings%20from%20MGM%20University%20IICT%20Admissions%20Committee.`}
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
            {apiHealth?.status === "missing_key" && (
              <div className="server-prereq-alert">
                <strong><ShieldAlert size={15} /> Server Configuration Prerequisite:</strong>
                Serverless staff management requires the <code>SUPABASE_SERVICE_ROLE_KEY</code> secret to be configured in your server environment variables (e.g. in Vercel Project Settings &gt; Environment Variables or local server <code>.env</code> file).
                <div style={{ marginTop: "6px", fontSize: "11px", color: "#78350F" }}>
                  Staff invitations are disabled until this server environment variable is configured by the project owner.
                </div>
              </div>
            )}
            {apiHealth?.status === "online" && (
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "6px 10px", borderRadius: "6px", fontSize: "11px", color: "#166534", margin: "10px 0", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <CheckCircle2 size={13} /> Secure Staff Service Role Active
              </div>
            )}
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

              <button
                type="submit"
                className="primary-button"
                disabled={granting || apiHealth?.status === "missing_key"}
                style={{ marginTop: "8px", justifyContent: "center" }}
                title={apiHealth?.status === "missing_key" ? "Action disabled: SUPABASE_SERVICE_ROLE_KEY required in server environment." : undefined}
              >
                <UserPlus size={15} />{" "}
                {granting
                  ? "Granting..."
                  : apiHealth?.status === "missing_key"
                  ? "Action Disabled (Missing Server Key)"
                  : "Grant Staff Access"}
              </button>
              {grantMsg && (
                <div style={{ padding: "8px 12px", borderRadius: "6px", background: grantMsg.includes("granted") || grantMsg.includes("recorded") ? "#ecfdf5" : "#fff7ed", border: "1px solid " + (grantMsg.includes("granted") || grantMsg.includes("recorded") ? "#a7f3d0" : "#fed7aa"), color: grantMsg.includes("granted") || grantMsg.includes("recorded") ? "#065f46" : "#9a3412", fontSize: "12px", fontWeight: 600 }}>
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
                    <span className={staff.isPending ? "pending-invite-badge" : staff.role === "super_admin" ? "super-admin-badge" : "teacher-badge"}>
                      {staff.isPending ? "Pending Invite" : staff.role}
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
                <div>
                  <span className={`status-select-badge ${selectedAppModal.status || "submitted"}`} style={{ padding: "5px 12px", borderRadius: "6px" }}>
                    Status: {selectedAppModal.status || "submitted"}
                  </span>
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
    </main>
  );
}
