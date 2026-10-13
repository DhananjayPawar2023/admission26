import React, { useState, useEffect, useRef } from "react";
import {
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  HelpCircle,
  Lock,
  MessageCircle,
  Send,
  User
} from "lucide-react";
import { Header } from "./Header";
import { ChatRenderer } from "../chatbot/ChatRenderer";
import { parseProfileUpdates, detectIntents } from "../chatbot/parser";
import { generateCounsellorReply } from "../chatbot/counsellorReply";
import { calculateProfileCompleteness, formatCurrency, isValidEmail, isValidPhone } from "../utils/formatters";
import { InquiryReviewModal } from "./InquiryReviewModal";
import { supabaseConfigured } from "../lib/supabase";
import { getNextRecommendations, INITIAL_RECOMMENDATIONS } from "../chatbot/recommendations";

export function Inquiry({ programs = [], facts = {}, onSubmit, onBack, onApply, onPrograms, onMyInquiry, onStaff, session }) {
  const [activeRecommendations, setActiveRecommendations] = useState(INITIAL_RECOMMENDATIONS);
  const [messages, setMessages] = useState([
    {
      id: "m-1",
      role: "assistant",
      content:
        "### Welcome to MGM University IICT Admissions (2026–27) 🎓\n\nI am your automated Admissions Advisor. I provide verified, transparent guidance directly from official IICT catalogs on:\n\n• **Program Comparisons**: B.Tech AI & ML vs CSE (AI) vs Data Science vs IT\n• **Annual Tuition Fees**: Verified 2026–27 schedules and installment plans\n• **Academic Eligibility**: 10+2 PCM criteria and MGMU-CET entrance opportunities\n• **150+ Merit Scholarships**: Tuition fee waivers and state welfare schemes\n\nHow can I help you plan your admissions journey today?"
    }
  ]);

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [srAnnouncement, setSrAnnouncement] = useState("");

  const [profile, setProfile] = useState(() => {
    let preselected = "";
    try {
      preselected = localStorage.getItem("iict_selected_prog") || "";
      if (preselected) localStorage.removeItem("iict_selected_prog");
    } catch {}
    const initial = {
      name: "",
      role: "Prospective Student",
      email: "",
      phone: "",
      interested_program: preselected,
      academic_background: "",
      marks_12th: null,
      marks_10th: null,
      entrance_exam: "",
      entrance_score: null,
      location: "Maharashtra",
      questions_noted: "",
      progress: 0
    };
    initial.progress = calculateProfileCompleteness(initial);
    return initial;
  });

  const chatThreadRef = useRef(null);
  const userJustSentRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const [mobileTab, setMobileTab] = useState("chat"); // "chat" | "profile"
  const profileRef = useRef(profile);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // Track if user is reading earlier messages
  const handleThreadScroll = () => {
    const thread = chatThreadRef.current;
    if (!thread) return;
    const threshold = 120; // 120px threshold for being near bottom
    const distanceFromBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight;
    isNearBottomRef.current = distanceFromBottom <= threshold;
  };

  const scrollToBottom = () => {
    const thread = chatThreadRef.current;
    if (!thread) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const behavior = prefersReducedMotion ? "auto" : "smooth";

    // Scroll only container itself (NEVER the window/document)
    // Only auto-scroll if user just sent a message or was already near the bottom
    if (userJustSentRef.current || isNearBottomRef.current) {
      userJustSentRef.current = false;
      try {
        thread.scrollTo({
          top: thread.scrollHeight,
          behavior
        });
      } catch {
        thread.scrollTop = thread.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleResetConversation = () => {
    try {
      localStorage.removeItem("iict_profile");
      sessionStorage.removeItem("iict_profile");
    } catch {}
    const freshProfile = {
      name: "",
      role: "Prospective Student",
      email: "",
      phone: "",
      interested_program: "",
      academic_background: "",
      marks_12th: null,
      marks_10th: null,
      entrance_exam: "",
      entrance_score: null,
      location: "Maharashtra",
      questions_noted: "",
      progress: 0
    };
    userJustSentRef.current = true;
    profileRef.current = freshProfile;
    setProfile(freshProfile);
    setActiveRecommendations(INITIAL_RECOMMENDATIONS);
    setMessages([
      {
        id: "m-1",
        role: "assistant",
        content:
          "### Welcome to MGM University IICT Admissions (2026–27) 🎓\n\nI am your automated Admissions Advisor. I provide verified, transparent guidance directly from official IICT catalogs on:\n\n• **Program Comparisons**: B.Tech AI & ML vs CSE (AI) vs Data Science vs IT\n• **Annual Tuition Fees**: Verified 2026–27 schedules and installment plans\n• **Academic Eligibility**: 10+2 PCM criteria and MGMU-CET entrance opportunities\n• **150+ Merit Scholarships**: Tuition fee waivers and state welfare schemes\n\nHow can I help you plan your admissions journey today?"
      }
    ]);
    setSrAnnouncement("Conversation reset to initial state.");
  };

  const handleSendMessage = (textToSend) => {
    const text = (textToSend || input).trim();
    if (!text || isTyping) return;

    // Check if user clicked review/submit prompt
    if (text === "Talk to Admissions" || text === "Review & Submit" || text === "Review & Submit Details") {
      setShowReviewModal(true);
      return;
    }

    userJustSentRef.current = true;

    // Update active recommendations dynamically based on input and detected intents
    const currentIntents = detectIntents(text);
    setActiveRecommendations((prev) => getNextRecommendations(text, currentIntents, prev));

    const userMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInput("");
    setIsTyping(true);
    setError("");

    // Entity & completeness updates using profileRef to prevent stale closure state
    const currentProfile = profileRef.current;
    const parsedUpdates = parseProfileUpdates(text, currentProfile);
    const updatedProfile = { ...currentProfile, ...parsedUpdates };
    updatedProfile.progress = calculateProfileCompleteness(updatedProfile);
    profileRef.current = updatedProfile;
    setProfile(updatedProfile);

    setTimeout(() => {
      const { text: replyText, actionType, suggestions } = generateCounsellorReply(
        text,
        profileRef.current,
        programs,
        facts
      );

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: replyText,
          actionType: actionType,
          suggestions: suggestions || []
        }
      ]);
      setIsTyping(false);
      setSrAnnouncement("New advisor response received.");

      // If user indicated ready to submit, open review modal
      if (actionType === "show_confirmation_modal") {
        setShowReviewModal(true);
      }
    }, 400);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const executeSubmission = async (reviewedPayload) => {
    setSubmitting(true);
    setError("");

    const conversationSummary = messages
      .slice(-6)
      .map((m) => `${m.role === "assistant" ? "Advisor" : "Student"}: ${m.content.slice(0, 150)}`)
      .join("\n");

    const payload = {
      ...reviewedPayload,
      question: reviewedPayload.question
        ? `${reviewedPayload.question}\n\n[Chat Context: Topics: ${profile.questions_noted || 'General'}]\n${conversationSummary}`
        : `[Chat Profile: Topics: ${profile.questions_noted || 'General'}]\n${conversationSummary}`
    };

    try {
      await onSubmit(payload, (err) => {
        setError(err || "Submission failed. Please verify your connection.");
        setSubmitting(false);
      });
    } catch (e) {
      setError(e.message || "An unexpected error occurred.");
      setSubmitting(false);
    }
  };

  return (
    <>
      <Header
        onHome={onBack}
        onInquiry={() => {}}
        onPrograms={onPrograms || onBack}
        onApply={onApply}
        onMyInquiry={onMyInquiry}
        onStaff={onStaff}
        session={session}
        activeNav="inquiry"
      />

      {/* Screen reader live announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {srAnnouncement}
      </div>

      <main className="counselling-page">
        {/* Mobile Segmented Toggle */}
        <div className="counselling-mobile-nav" role="tablist" aria-label="Counselling views">
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === "chat"}
            className={`counselling-mobile-btn ${mobileTab === "chat" ? "active" : ""}`}
            onClick={() => setMobileTab("chat")}
          >
            <MessageCircle size={14} aria-hidden="true" /> Live Counselling Chat
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === "profile"}
            className={`counselling-mobile-btn ${mobileTab === "profile" ? "active" : ""}`}
            onClick={() => setMobileTab("profile")}
          >
            <User size={14} aria-hidden="true" /> Profile Completeness ({profile.progress}%)
          </button>
        </div>

        {/* Left Column: Chat Area */}
        <section
          className={`counselling-chat-col ${mobileTab !== "chat" ? "mobile-tab-hidden" : ""}`}
          aria-label="Admissions Conversation"
        >
          <div className="counselling-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <p className="eyebrow">OFFICIAL IICT ADMISSIONS 2026–27</p>
              <h1>Live Admissions Guidance</h1>
              <p className="muted">Get transparent answers on B.Tech, M.Tech, fees, eligibility, and scholarship quotas.</p>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={handleResetConversation}
              title="Reset conversation and start fresh"
              style={{ fontSize: "12px", padding: "6px 12px", alignSelf: "center", cursor: "pointer" }}
            >
              Start Fresh Chat
            </button>
          </div>

          <div
            ref={chatThreadRef}
            className="chat-thread"
            tabIndex={0}
            aria-label="Message history"
            onScroll={handleThreadScroll}
          >
            {messages.map((m) => (
              <div key={m.id} className={`msg-item ${m.role}`}>
                {m.role === "assistant" ? (
                  <>
                    <div className="msg-meta msg-meta-assistant">
                      <span className="bot-avatar-badge" aria-hidden="true">A</span>
                      <span className="msg-author-label">IICT Admissions Advisor</span>
                    </div>
                    <div className="msg-bubble-assistant">
                      <ChatRenderer content={m.content} />

                      {/* In-chat proposal banner */}
                      {m.actionType === "show_confirmation_modal" && (
                        <div className="in-chat-submission-card">
                          <div className="in-chat-card-header">
                            <Award size={16} color="#C05A21" aria-hidden="true" />
                            <strong>Official Inquiry Review Ready</strong>
                          </div>
                          <div className="in-chat-card-summary">
                            <div><strong>Candidate:</strong> {profile.name || "Pending"}</div>
                            <div><strong>Target Program:</strong> {profile.interested_program || "Not yet selected (choose in review dialog)"}</div>
                            <div><strong>Mobile Phone:</strong> {isValidPhone(profile.phone) ? profile.phone : "Requires 10-digit number"}</div>
                            <div><strong>Email:</strong> {isValidEmail(profile.email) ? profile.email : "Requires valid email"}</div>
                          </div>
                          <div className="in-chat-card-actions">
                            <button
                              type="button"
                              className="primary-button in-chat-confirm-btn"
                              onClick={() => setShowReviewModal(true)}
                              disabled={submitting}
                            >
                              Review &amp; Confirm Inquiry <ArrowRight size={14} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="msg-meta msg-meta-user">
                      <span className="msg-author-label">You</span>
                      <span className="user-avatar-badge" aria-hidden="true">
                        <User size={15} />
                      </span>
                    </div>
                    <div className="msg-bubble-user">{m.content}</div>
                  </>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="msg-item assistant" aria-label="Advisor is formulating response">
                <div className="msg-meta msg-meta-assistant">
                  <span className="bot-avatar-badge">A</span>
                  <span className="msg-author-label">IICT Admissions Advisor</span>
                </div>
                <div className="typing-bubble">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
              </div>
            )}
          </div>

          {/* Active Recommended Questions (Exactly 3) */}
          <div className="quick-chips-wrapper" role="group" aria-label="Recommended questions">
            {activeRecommendations.map((question) => (
              <button
                key={question}
                type="button"
                className="quick-chip-btn"
                onClick={() => handleSendMessage(question)}
              >
                {question}
              </button>
            ))}
          </div>

          {/* Chat Input Container */}
          <div className="chat-input-container">
            <textarea
              className="chat-input-textarea"
              placeholder="Ask about 2026–27 programs, verified fees, cutoffs, or scholarships…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              aria-label="Admissions chat message input"
            />
            <button
              type="button"
              className="chat-send-btn"
              onClick={() => handleSendMessage()}
              disabled={!input.trim() || isTyping}
              aria-label="Send message"
            >
              <Send size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="chat-input-caption">Enter to send · Shift + Enter for a new line</div>
          {error && <div className="staff-error" style={{ marginTop: "12px" }} role="alert">{error}</div>}
        </section>

        {/* Right Column: Profile Completeness Sidebar */}
        <aside
          className={`counselling-sidebar ${mobileTab !== "profile" ? "mobile-tab-hidden" : ""}`}
          aria-label="Student Profile Completeness"
        >
          <div className="sidebar-top">
            <span className="sidebar-eyebrow">PROFILE STATUS</span>
            <span className="sidebar-live-pill">
              <span className="sidebar-live-dot" aria-hidden="true" /> Completeness Tracker
            </span>
          </div>

          <h2 className="sidebar-title">Your Admission Profile</h2>

          <div className="profile-card">
            <div className="profile-user-left">
              <div className="profile-avatar-circle" aria-hidden="true">
                {profile.name ? (
                  profile.name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()
                ) : (
                  <User size={18} />
                )}
              </div>
              <div className="profile-user-info">
                <strong>{profile.name || "Candidate Profile"}</strong>
                <small>{profile.role || "Prospective Student"}</small>
              </div>
            </div>
            <button
              type="button"
              className="profile-edit-btn"
              onClick={() => setShowReviewModal(true)}
              title="Review & Edit Profile"
              aria-label="Review & Edit Profile"
            >
              <Edit3 size={15} />
            </button>
          </div>

          <div className="profile-fields-list">
            <div className="profile-field-row">
              <div className="profile-field-header">
                <span className="profile-field-label">Target Program</span>
                {profile.interested_program ? (
                  <span className="field-status-chip verified"><Check size={10} /> Selected</span>
                ) : (
                  <span className="field-status-chip pending">Pending</span>
                )}
              </div>
              <span className="profile-field-value">{profile.interested_program || "Share in chat or select on review..."}</span>
            </div>

            <div className="profile-field-row">
              <div className="profile-field-header">
                <span className="profile-field-label">12th Marks / Academic</span>
                {(profile.academic_background || profile.marks_12th) ? (
                  <span className="field-status-chip verified"><Check size={10} /> Provided</span>
                ) : (
                  <span className="field-status-chip pending">Pending</span>
                )}
              </div>
              <span className="profile-field-value">{profile.academic_background || "Share PCM % in chat..."}</span>
            </div>

            <div className="profile-field-row">
              <div className="profile-field-header">
                <span className="profile-field-label">Entrance Exam</span>
                {(profile.entrance_exam || profile.entrance_score) ? (
                  <span className="field-status-chip verified"><Check size={10} /> Provided</span>
                ) : (
                  <span className="field-status-chip neutral">Optional</span>
                )}
              </div>
              <span className="profile-field-value">{profile.entrance_exam || "MHT-CET / JEE / MGMU-CET..."}</span>
            </div>

            <div className="profile-field-row">
              <div className="profile-field-header">
                <span className="profile-field-label">Contact Details</span>
                {(isValidPhone(profile.phone) && isValidEmail(profile.email)) ? (
                  <span className="field-status-chip verified"><Check size={10} /> Complete</span>
                ) : (isValidPhone(profile.phone) || isValidEmail(profile.email)) ? (
                  <span className="field-status-chip pending">Partial</span>
                ) : (
                  <span className="field-status-chip pending">Required</span>
                )}
              </div>
              <span className="profile-field-value">
                {profile.phone && profile.email
                  ? `${profile.phone} · ${profile.email}`
                  : profile.phone || profile.email || "Phone & email for seat receipt..."}
              </span>
            </div>

            <div className="profile-field-row">
              <div className="profile-field-header">
                <span className="profile-field-label">Domicile / Quota</span>
                <span className="field-status-chip neutral">Selected</span>
              </div>
              <span className="profile-field-value">{profile.location || "Maharashtra"}</span>
            </div>
          </div>

          <div className="inquiry-progress-block">
            <div className="progress-header-row">
              <div
                className="progress-status-badge"
                style={{
                  backgroundColor: profile.progress === 100 ? "#FFF0E5" : profile.progress >= 60 ? "#FFF8F3" : "#F8FAFC",
                  color: profile.progress === 100 ? "#C05A21" : profile.progress >= 60 ? "#8C3A0B" : "#475569"
                }}
              >
                {profile.progress === 100 ? (
                  <><CheckCircle2 size={13} style={{ color: "#C05A21" }} /> Profile 100% Complete</>
                ) : profile.progress >= 60 ? (
                  <><Clock size={13} style={{ color: "#C05A21" }} /> Ready for Review</>
                ) : (
                  <><HelpCircle size={13} style={{ color: "#64748B" }} /> Gathering Information</>
                )}
              </div>
              <div className="progress-pct-value">
                <strong>{profile.progress}%</strong>
              </div>
            </div>

            <div className="checklist-items-wrap">
              <div className={`checklist-item ${profile.name ? "done" : "pending"}`}>
                <span className="checklist-bullet">
                  {profile.name ? <Check size={11} /> : <span className="bullet-dot" />}
                </span>
                <span className="checklist-text">
                  <span>Candidate Name</span>
                  {profile.name ? <strong>{profile.name}</strong> : <span className="pending-hint">+20%</span>}
                </span>
              </div>
              <div className={`checklist-item ${profile.interested_program ? "done" : "pending"}`}>
                <span className="checklist-bullet">
                  {profile.interested_program ? <Check size={11} /> : <span className="bullet-dot" />}
                </span>
                <span className="checklist-text">
                  <span>Target Program</span>
                  {profile.interested_program ? <strong>{profile.interested_program.replace("B.Tech in ", "")}</strong> : <span className="pending-hint">+20%</span>}
                </span>
              </div>
              <div className={`checklist-item ${(profile.academic_background || profile.marks_12th) ? "done" : "pending"}`}>
                <span className="checklist-bullet">
                  {(profile.academic_background || profile.marks_12th) ? <Check size={11} /> : <span className="bullet-dot" />}
                </span>
                <span className="checklist-text">
                  <span>12th PCM Marks</span>
                  {(profile.academic_background || profile.marks_12th) ? <strong>{profile.academic_background || `${profile.marks_12th}%`}</strong> : <span className="pending-hint">+20%</span>}
                </span>
              </div>
              <div className={`checklist-item ${(isValidPhone(profile.phone) && isValidEmail(profile.email)) ? "done" : "pending"}`}>
                <span className="checklist-bullet">
                  {(isValidPhone(profile.phone) && isValidEmail(profile.email)) ? <Check size={11} /> : <span className="bullet-dot" />}
                </span>
                <span className="checklist-text">
                  <span>Validated Contacts</span>
                  {(isValidPhone(profile.phone) && isValidEmail(profile.email)) ? <strong>{profile.phone}</strong> : <span className="pending-hint">+25%</span>}
                </span>
              </div>
            </div>

            <div className="progress-privacy-badge">
              <Lock size={12} color="#64748B" aria-hidden="true" />
              <span>Your personal details are kept private.</span>
            </div>
          </div>

          <div className="ready-connect-section">
            <h3 className="ready-connect-title">Ready to connect?</h3>
            <p className="ready-connect-desc">
              Review your details and submit directly to the IICT admissions committee with explicit contact consent.
            </p>
            <button
              type="button"
              className="send-my-inquiry-btn"
              onClick={() => setShowReviewModal(true)}
              disabled={submitting || !supabaseConfigured}
            >
              {submitting ? "Sending..." : "Review & Submit Inquiry"} <ArrowRight size={16} aria-hidden="true" />
            </button>
            {!supabaseConfigured && (
              <small className="form-help" style={{ textAlign: "center", display: "block" }}>
                Connect Supabase before accepting live inquiries.
              </small>
            )}
          </div>
        </aside>
      </main>

      {/* Explicit Confirmation Modal */}
      <InquiryReviewModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        initialData={profile}
        programs={programs}
        onProgramChange={(selectedProgram) => {
          if (selectedProgram) {
            const updated = { ...profileRef.current, interested_program: selectedProgram };
            updated.progress = calculateProfileCompleteness(updated);
            profileRef.current = updated;
            setProfile(updated);
          }
        }}
        onSubmit={async (validatedPayload) => {
          if (validatedPayload.program_interest) {
            const updated = {
              ...profileRef.current,
              interested_program: validatedPayload.program_interest,
              name: validatedPayload.student_name || profileRef.current.name,
              phone: validatedPayload.phone || profileRef.current.phone,
              email: validatedPayload.email || profileRef.current.email
            };
            updated.progress = calculateProfileCompleteness(updated);
            profileRef.current = updated;
            setProfile(updated);
          }
          setShowReviewModal(false);
          await executeSubmission(validatedPayload);
        }}
        isSubmitting={submitting}
      />
    </>
  );
}
