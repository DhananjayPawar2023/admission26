import React, { useEffect, useState } from "react";
import { Check, Search } from "lucide-react";
import { supabase } from "./lib/supabase";
import { fallbackPrograms, fallbackFacts } from "./data/programsData";
import { isValidEmail, isValidPhone, normalizePhone } from "./utils/formatters";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { Home } from "./components/Home";
import { Compare } from "./components/Compare";
import { Inquiry } from "./components/Inquiry";
import { DirectApplication } from "./components/DirectApplication";
import { ApplicationSuccess } from "./components/ApplicationSuccess";
import { Dashboard } from "./components/Dashboard";
import { StaffLogin } from "./components/StaffLogin";
import { MyInquiryModal } from "./components/MyInquiryModal";

// Clean up legacy explicit test markers from local dev sessions
try {
  localStorage.removeItem("iict_profile");
  ["iict_last_inquiry", "iict_inquiries_history"].forEach((key) => {
    const val = localStorage.getItem(key);
    if (val) {
      try {
        const parsed = JSON.parse(val);
        if (parsed && (parsed.is_test || parsed.is_demo)) {
          localStorage.removeItem(key);
        }
      } catch {}
    }
  });
} catch {
  // ignore
}

export function App() {
  const [view, setView] = useState(() => {
    const p = window.location.pathname;
    if (p === "/staff") return "staff-login";
    if (p === "/compare") return "compare";
    if (p === "/inquiry") return "inquiry";
    if (p === "/apply") return "apply";
    if (p === "/apply/success") return "apply-success";
    if (p === "/inquiry/success") return "success";
    return "home";
  });

  const [appliedProgram, setAppliedProgram] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get("program") || localStorage.getItem("iict_selected_prog") || "";
    } catch {
      return "";
    }
  });

  const [lead, setLead] = useState(() => {
    try {
      const stored = localStorage.getItem("iict_last_inquiry");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [applicationLead, setApplicationLead] = useState(() => {
    try {
      const stored = localStorage.getItem("iict_last_application");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [session, setSession] = useState(null);
  const [programs, setPrograms] = useState(fallbackPrograms);
  const [facts, setFacts] = useState(fallbackFacts);

  const [trackerState, setTrackerState] = useState({
    isOpen: false,
    reference: "",
    phone: "",
    type: "application"
  });

  const openTracker = (reference = "", phone = "", type = "application") => {
    setTrackerState({
      isOpen: true,
      reference,
      phone,
      type
    });
  };

  const closeTracker = () => {
    setTrackerState((prev) => ({ ...prev, isOpen: false }));
  };

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const urlParams = new URLSearchParams(window.location.search);
      const prog = urlParams.get("program");
      if (prog) setAppliedProgram(prog);

      if (path === "/staff") setView("staff-login");
      else if (path === "/compare") setView("compare");
      else if (path === "/inquiry") setView("inquiry");
      else if (path === "/apply") setView("apply");
      else if (path === "/apply/success") setView("apply-success");
      else if (path === "/inquiry/success") setView("success");
      else setView("home");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data?.session || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) =>
      setSession(nextSession)
    );

    // Load published programs
    supabase
      .from("programs")
      .select("id,name,degree,level,duration,annual_tuition_fee,intake_seats,description,eligibility,career_opportunities")
      .eq("published", true)
      .order("name")
      .then(({ data }) => {
        if (data?.length) setPrograms(data);
      });

    // Load published admission facts
    supabase
      .from("admission_facts")
      .select("key,value,source_url")
      .eq("published", true)
      .then(({ data }) => {
        if (data?.length) {
          setFacts(
            data.reduce(
              (all, row) => ({
                ...all,
                [row.key]: row.value,
                source_url: row.source_url || all.source_url
              }),
              {}
            )
          );
        }
      });

    return () => listener.subscription.unsubscribe();
  }, []);

  const navigateTo = (newView, urlPath) => {
    window.history.pushState({}, "", urlPath);
    setView(newView);
  };

  const handleApply = (programName = "") => {
    if (programName && typeof programName === "string") {
      setAppliedProgram(programName);
      try {
        localStorage.setItem("iict_selected_prog", programName);
      } catch {}
      navigateTo("apply", `/apply?program=${encodeURIComponent(programName)}`);
    } else {
      setAppliedProgram("");
      navigateTo("apply", "/apply");
    }
  };

  // Submit direct application to separate table/RPC
  const submitApplication = async (payload, setError, setSubmitting) => {
    if (!payload.program_choice || !payload.program_choice.trim()) {
      setError("Please deliberately select your intended academic program.");
      setSubmitting(false);
      return;
    }
    if (!payload.student_name || payload.student_name.trim().length < 2) {
      setError("Candidate legal name is required (minimum 2 characters).");
      setSubmitting(false);
      return;
    }
    if (!isValidEmail(payload.email)) {
      setError("A valid personal email address is required.");
      setSubmitting(false);
      return;
    }
    if (!isValidPhone(payload.phone)) {
      setError("A valid 10-digit mobile number is required.");
      setSubmitting(false);
      return;
    }

    if (!supabase) {
      setError("Admissions database service is unavailable. Please verify your connection or contact admissions.");
      setSubmitting(false);
      return;
    }

    const application_number = `MGMU-APP-2026-${crypto.randomUUID().slice(0, 5).toUpperCase()}`;

    let confirmedRecord = null;
    let failureReason = null;

    try {
      const rpcRes = await supabase.rpc("submit_direct_application", {
        p_application_number: application_number,
        p_student_name: payload.student_name,
        p_email: payload.email,
        p_phone: payload.phone,
        p_program_choice: payload.program_choice,
        p_dob: payload.dob || null,
        p_gender: payload.gender || null,
        p_category: payload.category || "General",
        p_degree_level: payload.degree_level || "Undergraduate",
        p_qualifying_exam: payload.qualifying_exam || null,
        p_marks_percentage: payload.marks_percentage || null,
        p_entrance_exam: payload.entrance_exam || null,
        p_entrance_roll_no: payload.entrance_roll_no || null,
        p_entrance_score: payload.entrance_score || null,
        p_address: payload.address || null,
        p_city: payload.city || null,
        p_state: payload.state || "Maharashtra",
        p_pincode: payload.pincode || null,
        p_guardian_name: payload.guardian_name || null,
        p_guardian_phone: payload.guardian_phone || null
      });

      if (!rpcRes.error && rpcRes.data?.success) {
        confirmedRecord = {
          ...payload,
          application_number,
          id: rpcRes.data.id,
          status: "submitted",
          created_at: new Date().toISOString()
        };
      } else {
        // Direct insert fallback if RPC failed
        const { data: insertData, error: insertErr } = await supabase
          .from("applications")
          .insert([
            {
              application_number,
              student_name: payload.student_name,
              email: payload.email,
              phone: payload.phone,
              dob: payload.dob || null,
              gender: payload.gender || null,
              category: payload.category || "General",
              program_choice: payload.program_choice,
              degree_level: payload.degree_level || "Undergraduate",
              qualifying_exam: payload.qualifying_exam || null,
              marks_percentage: payload.marks_percentage || null,
              entrance_exam: payload.entrance_exam || null,
              entrance_roll_no: payload.entrance_roll_no || null,
              entrance_score: payload.entrance_score || null,
              address: payload.address || null,
              city: payload.city || null,
              state: payload.state || "Maharashtra",
              pincode: payload.pincode || null,
              guardian_name: payload.guardian_name || null,
              guardian_phone: payload.guardian_phone || null,
              status: "submitted"
            }
          ])
          .select()
          .single();

        if (!insertErr && insertData) {
          confirmedRecord = insertData;
        } else {
          failureReason = insertErr?.message || rpcRes.error?.message || "Application could not be saved to the database.";
        }
      }
    } catch (err) {
      failureReason = err.message || "Failed to communicate with admissions server.";
    }

    if (!confirmedRecord) {
      setError(`Database Error: ${failureReason}. Submission was not saved.`);
      setSubmitting(false);
      return;
    }

    // Send the receipt only after the database confirms the application was saved.
    // Email failure must not discard a valid application submission.
    let emailDelivery = { status: "failed", delivered: false };
    try {
      const emailResponse = await fetch("/api/application-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_number: confirmedRecord.application_number,
          email: confirmedRecord.email,
          phone: confirmedRecord.phone
        })
      });
      const emailData = await emailResponse.json().catch(() => ({}));
      emailDelivery = emailData.emailDelivery || emailDelivery;
    } catch {
      // Keep the confirmed application visible even if the email service is unavailable.
    }

    confirmedRecord = {
      ...confirmedRecord,
      email_delivery_status: emailDelivery.status,
      email_delivered: Boolean(emailDelivery.delivered)
    };

    setApplicationLead(confirmedRecord);

    try {
      localStorage.setItem("iict_last_application", JSON.stringify(confirmedRecord));
    } catch {
      // ignore
    }

    setSubmitting(false);
    navigateTo("apply-success", "/apply/success");
  };

  // Submit inquiry to existing inquiries table
  const submitInquiry = async (payload, setError) => {
    if (!supabase) {
      setError("Supabase is not configured yet. Please check connection.");
      return;
    }

    if (!payload.student_name || payload.student_name.trim().length < 2) {
      setError("Candidate name is required (minimum 2 characters).");
      return;
    }
    if (!isValidEmail(payload.email)) {
      setError("A valid email address is required. Please check your email.");
      return;
    }
    if (!isValidPhone(payload.phone)) {
      setError("A valid 10-digit mobile number is required.");
      return;
    }

    const reference_code = `IICT-2026-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

    const rpcRes = await supabase.rpc("submit_inquiry", {
      p_reference_code: reference_code,
      p_student_name: payload.student_name.trim(),
      p_email: payload.email.trim().toLowerCase(),
      p_phone: normalizePhone(payload.phone),
      p_program_interest: payload.program_interest,
      p_question: payload.question || "",
      p_course_category: payload.course_category || "UG",
      p_marks_10th: payload.marks_10th || null,
      p_marks_12th: payload.marks_12th || null,
      p_entrance_exam: payload.entrance_exam || null,
      p_entrance_score: payload.entrance_score || null,
      p_location: payload.location || "Maharashtra"
    });

    if (rpcRes.error) {
      const fallbackRes = await supabase.rpc("submit_inquiry", {
        p_reference_code: reference_code,
        p_student_name: payload.student_name.trim(),
        p_email: payload.email.trim().toLowerCase(),
        p_phone: normalizePhone(payload.phone),
        p_program_interest: payload.program_interest,
        p_question: payload.question || ""
      });
      if (fallbackRes.error) {
        setError(rpcRes.error.message || fallbackRes.error.message);
        return;
      }
    }

    const newLead = {
      ...payload,
      reference_code,
      status: "new",
      created_at: new Date().toISOString()
    };
    setLead(newLead);

    try {
      localStorage.setItem("iict_last_inquiry", JSON.stringify(newLead));
      const existingHistory = JSON.parse(localStorage.getItem("iict_inquiries_history") || "[]");
      existingHistory.unshift(newLead);
      localStorage.setItem("iict_inquiries_history", JSON.stringify(existingHistory.slice(0, 10)));
    } catch {
      // ignore
    }

    navigateTo("success", "/inquiry/success");
  };

  return (
    <>
      <MyInquiryModal
        isOpen={trackerState.isOpen}
        onClose={closeTracker}
        onStartNew={() => {
          closeTracker();
          handleApply();
        }}
        initialReference={trackerState.reference}
        initialPhone={trackerState.phone}
        initialType={trackerState.type}
      />

      {view === "home" && (
        <Home
          onStart={() => navigateTo("inquiry", "/inquiry")}
          onApply={handleApply}
          onCompare={() => navigateTo("compare", "/compare")}
          onStaff={() => navigateTo("staff-login", "/staff")}
          onMyInquiry={() => openTracker()}
          session={session}
        />
      )}

      {view === "compare" && (
        <Compare
          programs={programs}
          facts={facts}
          onBack={() => navigateTo("home", "/")}
          onInquiry={(progName) => {
            if (progName && typeof progName === "string") {
              try {
                localStorage.setItem("iict_selected_prog", progName);
              } catch {}
            }
            navigateTo("inquiry", "/inquiry");
          }}
          onApply={handleApply}
          onMyInquiry={() => openTracker()}
          onStaff={() => navigateTo("staff-login", "/staff")}
          session={session}
        />
      )}

      {view === "apply" && (
        <DirectApplication
          initialProgram={appliedProgram}
          programs={programs}
          facts={facts}
          onSubmit={submitApplication}
          onBack={() => navigateTo("home", "/")}
          onPrograms={() => navigateTo("compare", "/compare")}
          onInquiry={() => navigateTo("inquiry", "/inquiry")}
          onMyInquiry={() => openTracker()}
          onStaff={() => navigateTo("staff-login", "/staff")}
          session={session}
        />
      )}

      {view === "apply-success" && (
        <ApplicationSuccess
          application={applicationLead}
          onHome={() => navigateTo("home", "/")}
          onTrack={(ref, phone) => openTracker(ref, phone, "application")}
          onInquiry={() => navigateTo("inquiry", "/inquiry")}
          onPrograms={() => navigateTo("compare", "/compare")}
          onStaff={() => navigateTo("staff-login", "/staff")}
          session={session}
        />
      )}

      {view === "inquiry" && (
        <Inquiry
          programs={programs}
          facts={facts}
          onSubmit={submitInquiry}
          onBack={() => navigateTo("home", "/")}
          onApply={handleApply}
          onPrograms={() => navigateTo("compare", "/compare")}
          onMyInquiry={() => openTracker("", "", "inquiry")}
          onStaff={() => navigateTo("staff-login", "/staff")}
          session={session}
        />
      )}

      {view === "staff-login" &&
        (session ? (
          <Dashboard
            session={session}
            onOpenTracker={openTracker}
            onExit={() => {
              setSession(null);
              navigateTo("home", "/");
            }}
          />
        ) : (
          <StaffLogin
            onSuccess={(nextSession) => {
              setSession(nextSession);
              setView("dashboard");
            }}
            onBack={() => navigateTo("home", "/")}
          />
        ))}

      {view === "dashboard" && (
        <Dashboard
          session={session}
          onOpenTracker={openTracker}
          onExit={() => navigateTo("home", "/")}
        />
      )}

      {view === "success" && (
        <>
          <Header
            onHome={() => navigateTo("home", "/")}
            onInquiry={() => navigateTo("inquiry", "/inquiry")}
            onPrograms={() => navigateTo("compare", "/compare")}
            onApply={handleApply}
            onMyInquiry={() => openTracker(lead?.reference_code || "", lead?.phone || "", "inquiry")}
            onStaff={() => navigateTo("staff-login", "/staff")}
            session={session}
            activeNav="inquiry"
          />
          <main className="success-page">
            <div className="success-icon" aria-hidden="true">
              <Check size={28} />
            </div>
            <p className="eyebrow">INQUIRY SUBMITTED SECURELY</p>
            <h1>Your Inquiry Has Been Registered.</h1>
            <p className="success-lead">
              Your personal details are kept private. An official IICT admissions counsellor will review your academic preferences and contact you.
            </p>
            <div className="success-card">
              <div>
                <span>Inquiry Reference ID</span>
                <strong>{lead?.reference_code}</strong>
              </div>
              <div>
                <span>Candidate Name</span>
                <strong>{lead?.student_name}</strong>
              </div>
              <div>
                <span>Program of Interest</span>
                <strong>{lead?.program_interest}</strong>
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                className="primary-button"
                onClick={() => openTracker(lead?.reference_code || "", lead?.phone || "", "inquiry")}
              >
                <Search size={15} aria-hidden="true" /> Track My Inquiry
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => navigateTo("inquiry", "/inquiry")}
              >
                Return to Admissions Chat
              </button>
            </div>
          </main>
          <Footer onStaff={() => navigateTo("staff-login", "/staff")} />
        </>
      )}
    </>
  );
}
