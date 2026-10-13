import React, { useState, useEffect } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  MessageSquare,
  Phone,
  Search,
  ShieldCheck,
  UserCheck,
  X
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { normalizePhone } from "../utils/formatters";

export function MyInquiryModal({
  isOpen,
  onClose,
  onStartNew,
  initialReference = "",
  initialPhone = "",
  initialType = "application" // "application" | "inquiry"
}) {
  const [activeTab, setActiveTab] = useState(initialType);
  const [refCode, setRefCode] = useState(initialReference);
  const [phoneNumber, setPhoneNumber] = useState(initialPhone);
  const [searchResult, setSearchResult] = useState(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (initialReference) {
        setRefCode(initialReference);
        if (initialReference.toUpperCase().startsWith("IICT-")) {
          setActiveTab("inquiry");
        } else {
          setActiveTab("application");
        }
      }
      if (initialPhone) {
        setPhoneNumber(initialPhone);
      }

      // If nothing was passed, check localStorage for last application or inquiry
      if (!initialReference && !initialPhone) {
        const lastApp = localStorage.getItem("iict_last_application");
        const lastInq = localStorage.getItem("iict_last_inquiry");

        if (lastApp) {
          try {
            const parsed = JSON.parse(lastApp);
            setRefCode(parsed.application_number || "");
            setPhoneNumber(parsed.phone || "");
            setActiveTab("application");
          } catch {}
        } else if (lastInq) {
          try {
            const parsed = JSON.parse(lastInq);
            setRefCode(parsed.reference_code || "");
            setPhoneNumber(parsed.phone || "");
            setActiveTab("inquiry");
          } catch {}
        }
      }
    }
  }, [isOpen, initialReference, initialPhone]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleTrack = async (e) => {
    e?.preventDefault();
    setSearchError("");
    setSearchResult(null);

    const cleanRef = refCode.trim().toUpperCase();
    const cleanPhone = normalizePhone(phoneNumber);

    if (!cleanRef) {
      setSearchError("Please enter your reference or application ID.");
      return;
    }

    if (!cleanPhone || cleanPhone.length < 10) {
      setSearchError("Please enter your 10-digit registered mobile number for privacy verification.");
      return;
    }

    setLoading(true);
    setSearched(true);

    const isApp = cleanRef.includes("APP") || activeTab === "application";

    if (!supabase) {
      setSearchError("Admissions database service is not configured. Please contact the IICT admissions desk directly.");
      setLoading(false);
      return;
    }

    try {
      if (isApp) {
        const { data, error } = await supabase.rpc("track_application_status", {
          p_application_number: cleanRef,
          p_phone: cleanPhone
        });

        if (error) {
          setSearchError(`Server error verifying application: ${error.message}`);
          setLoading(false);
          return;
        }

        if (data?.found) {
          setSearchResult({
            ...data,
            type: "application"
          });
        } else {
          setSearchError(
            data?.error ||
            `No matching application found for Reference "${cleanRef}" and Mobile ending in "...${cleanPhone.slice(-4)}". Please check your reference ID.`
          );
        }
      } else {
        const { data, error } = await supabase.rpc("track_inquiry_status", {
          p_reference_code: cleanRef,
          p_phone: cleanPhone
        });

        if (error) {
          setSearchError(`Server error verifying inquiry: ${error.message}`);
          setLoading(false);
          return;
        }

        if (data?.found) {
          setSearchResult({
            ...data,
            type: "inquiry"
          });
        } else {
          setSearchError(
            data?.error ||
            `No matching inquiry found for Reference "${cleanRef}" and Mobile ending in "...${cleanPhone.slice(-4)}". Please check your reference code.`
          );
        }
      }
    } catch (rpcErr) {
      setSearchError(`Network error while contacting admissions server: ${rpcErr.message}`);
    }

    setLoading(false);
  };

  const getStatusMilestone = (status, type) => {
    const s = (status || "").toLowerCase();
    if (type === "application") {
      if (s === "submitted") return 1;
      if (s === "under_scrutiny" || s === "scrutiny") return 2;
      if (s === "documents_verified" || s === "verified") return 3;
      if (s === "merit_listed" || s === "provisionally_approved" || s === "approved") return 4;
      return 1;
    }
    // Inquiry
    if (s === "new" || s === "submitted") return 1;
    if (s === "assigned" || s === "in_review") return 2;
    if (s === "contacted" || s === "counselled") return 3;
    if (s === "admitted" || s === "qualified") return 4;
    return 1;
  };

  const formatStatusLabel = (status, type) => {
    const s = (status || "").toLowerCase();
    if (type === "application") {
      switch (s) {
        case "submitted":
          return "Received · Under Committee Scrutiny";
        case "under_scrutiny":
          return "Eligibility & Document Scrutiny In Progress";
        case "documents_verified":
          return "Documents Verified · Awaiting Merit Ranking";
        case "merit_listed":
          return "Merit Listed · Counselling Call Scheduled";
        case "provisionally_approved":
          return "Provisionally Approved for Admission";
        default:
          return status;
      }
    }
    // Inquiry
    switch (s) {
      case "new":
        return "Received · Queued for Counsellor";
      case "assigned":
        return "Assigned to Admissions Officer";
      case "contacted":
        return "Counsellor Contact Initiated";
      case "qualified":
        return "Profile Evaluated & Qualified";
      default:
        return status;
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="track-modal-title"
    >
      <div className="modal-dialog tracker-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="tracker-modal-title-row">
            <ShieldCheck size={20} color="#C05A21" aria-hidden="true" />
            <h3 id="track-modal-title">Official Admissions Status Tracker</h3>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close tracking modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher: Direct Application vs Inquiry */}
        <div className="tracker-tabs-row" role="tablist" aria-label="Tracker Mode">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "application"}
            className={`tracker-tab-btn ${activeTab === "application" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("application");
              setSearchResult(null);
              setSearchError("");
              setSearched(false);
            }}
          >
            <FileText size={14} aria-hidden="true" />
            <span>Direct Application</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "inquiry"}
            className={`tracker-tab-btn ${activeTab === "inquiry" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("inquiry");
              setSearchResult(null);
              setSearchError("");
              setSearched(false);
            }}
          >
            <MessageSquare size={14} aria-hidden="true" />
            <span>Admissions Inquiry</span>
          </button>
        </div>

        {/* Privacy Note */}
        <div className="tracker-privacy-notice">
          <Lock size={13} aria-hidden="true" />
          <span>
            <strong>Privacy Protected:</strong> To prevent unauthorized disclosure of academic data, both your Reference ID and registered 10-digit mobile number are required.
          </span>
        </div>

        {/* Verification & Search Form */}
        <form className="tracker-form" onSubmit={handleTrack}>
          <div className="tracker-inputs-grid">
            <div className="tracker-field">
              <label htmlFor="tracker-ref-input">
                {activeTab === "application" ? "Application ID" : "Inquiry Reference ID"}
              </label>
              <input
                id="tracker-ref-input"
                type="text"
                placeholder={activeTab === "application" ? "e.g. MGMU-APP-2026-XXXXX" : "e.g. IICT-2026-XXXXXX"}
                value={refCode}
                onChange={(e) => setRefCode(e.target.value)}
                required
              />
            </div>

            <div className="tracker-field">
              <label htmlFor="tracker-phone-input">Registered Mobile Number</label>
              <input
                id="tracker-phone-input"
                type="tel"
                placeholder="10-digit phone number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                maxLength={13}
                required
              />
            </div>
          </div>

          <button type="submit" className="primary-button tracker-submit-btn" disabled={loading}>
            <Search size={15} aria-hidden="true" />
            <span>{loading ? "Verifying..." : "Verify & Track Status"}</span>
          </button>
        </form>

        {/* Error State */}
        {searchError && (
          <div className="tracker-error-box" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{searchError}</span>
          </div>
        )}

        {/* Result State (Privacy Protected) */}
        {searched && searchResult && (
          <div className="tracker-result-card" role="region" aria-label="Status Result">
            <div className="tracker-result-head">
              <div>
                <span className="tracker-result-type">
                  {searchResult.type === "application" ? "Direct Application" : "Admissions Inquiry"}
                </span>
                <h4 className="tracker-result-code">
                  {searchResult.application_number || searchResult.reference_code}
                </h4>
              </div>
              <span className={`tracker-badge ${searchResult.status || "submitted"}`}>
                {formatStatusLabel(searchResult.status, searchResult.type)}
              </span>
            </div>

            {/* Visual Milestones */}
            <div className="tracker-milestone-track">
              {searchResult.type === "application" ? (
                <>
                  <div className={`milestone-step ${getStatusMilestone(searchResult.status, "application") >= 1 ? "done" : ""}`}>
                    <div className="step-dot">1</div>
                    <span>Received</span>
                  </div>
                  <div className={`milestone-step ${getStatusMilestone(searchResult.status, "application") >= 2 ? "done" : ""}`}>
                    <div className="step-dot">2</div>
                    <span>Scrutiny</span>
                  </div>
                  <div className={`milestone-step ${getStatusMilestone(searchResult.status, "application") >= 3 ? "done" : ""}`}>
                    <div className="step-dot">3</div>
                    <span>Verified</span>
                  </div>
                  <div className={`milestone-step ${getStatusMilestone(searchResult.status, "application") >= 4 ? "done" : ""}`}>
                    <div className="step-dot">4</div>
                    <span>Merit / Offer</span>
                  </div>
                </>
              ) : (
                <>
                  <div className={`milestone-step ${getStatusMilestone(searchResult.status, "inquiry") >= 1 ? "done" : ""}`}>
                    <div className="step-dot">1</div>
                    <span>Logged</span>
                  </div>
                  <div className={`milestone-step ${getStatusMilestone(searchResult.status, "inquiry") >= 2 ? "done" : ""}`}>
                    <div className="step-dot">2</div>
                    <span>Assigned</span>
                  </div>
                  <div className={`milestone-step ${getStatusMilestone(searchResult.status, "inquiry") >= 3 ? "done" : ""}`}>
                    <div className="step-dot">3</div>
                    <span>Counselling</span>
                  </div>
                  <div className={`milestone-step ${getStatusMilestone(searchResult.status, "inquiry") >= 4 ? "done" : ""}`}>
                    <div className="step-dot">4</div>
                    <span>Evaluated</span>
                  </div>
                </>
              )}
            </div>

            <div className="tracker-info-rows">
              <div className="tracker-info-row">
                <span>Selected Academic Program</span>
                <strong>{searchResult.program_choice || searchResult.program_interest}</strong>
              </div>

              <div className="tracker-info-row">
                <span>Submission Timestamp</span>
                <span>
                  {searchResult.created_at
                    ? new Date(searchResult.created_at).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short"
                      })
                    : "Logged"}
                </span>
              </div>

              <div className="tracker-info-row">
                <span>Committee Guidance Note</span>
                <span style={{ color: "#334155", fontSize: "12px", lineHeight: "1.5" }}>
                  {searchResult.type === "application"
                    ? "Your academic profile is being examined by the IICT scrutiny committee. An admissions counselor will reach out to you directly if additional verification documents are needed."
                    : "An official IICT admissions counselor is reviewing your queries and will connect with you during official university helpline hours (10 AM – 5 PM)."}
                </span>
              </div>
            </div>
          </div>
        )}

        {searched && !searchResult && !searchError && (
          <div className="tracker-empty">
            <Clock size={28} style={{ margin: "0 auto 8px", color: "#9ca3af" }} aria-hidden="true" />
            <p>No active record found for the provided details.</p>
            <button
              type="button"
              className="primary-button"
              style={{ marginTop: "12px", justifyContent: "center" }}
              onClick={() => {
                onClose();
                onStartNew();
              }}
            >
              Start Direct Application / Inquiry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
