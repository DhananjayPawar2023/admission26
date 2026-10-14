import React, { useState, useEffect, useRef } from "react";
import { X, CheckCircle2, ShieldCheck, AlertCircle } from "lucide-react";
import { formatCurrency, isValidEmail, isValidPhone, normalizePhone } from "../utils/formatters";

export function InquiryReviewModal({
  isOpen,
  onClose,
  initialData,
  programs = [],
  onSubmit,
  onProgramChange,
  isSubmitting = false
}) {
  const [formData, setFormData] = useState({
    student_name: "",
    email: "",
    phone: "",
    program_interest: "",
    marks_12th: "",
    entrance_score: "",
    location: "Maharashtra",
    question: "",
    consent: false
  });
  const [validationError, setValidationError] = useState("");
  const modalRef = useRef(null);
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        student_name: initialData?.name || "",
        email: initialData?.email || "",
        phone: initialData?.phone || "",
        program_interest: initialData?.interested_program || "",
        marks_12th: initialData?.marks_12th ? String(initialData.marks_12th) : "",
        entrance_score: initialData?.entrance_score ? String(initialData.entrance_score) : "",
        location: initialData?.location || "Maharashtra",
        question: initialData?.questions_noted ? `Focus topics: ${initialData.questions_noted}` : "",
        consent: false
      });
      setValidationError("");
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [isOpen, initialData, programs]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError("");

    const trimmedName = formData.student_name.trim();
    const trimmedEmail = formData.email.trim().toLowerCase();
    const trimmedPhone = normalizePhone(formData.phone);

    if (!trimmedName || trimmedName.length < 2) {
      setValidationError("Please enter your full candidate name (at least 2 letters).");
      return;
    }

    if (!isValidPhone(trimmedPhone)) {
      setValidationError("Please enter a valid 10-digit Indian mobile number (e.g., 9822334455).");
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setValidationError("Please enter a valid email address (e.g., student@example.com).");
      return;
    }

    if (!formData.program_interest) {
      setValidationError("Please select your program of interest.");
      return;
    }

    if (!formData.consent) {
      setValidationError("Please confirm your consent to be contacted by checking the confirmation box below.");
      return;
    }

    const payload = {
      student_name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
      program_interest: formData.program_interest,
      course_category: "UG",
      marks_12th: formData.marks_12th ? parseFloat(formData.marks_12th) : null,
      entrance_score: formData.entrance_score ? parseFloat(formData.entrance_score) : null,
      entrance_exam: formData.entrance_score ? `MHT-CET / JEE (${formData.entrance_score})` : null,
      location: formData.location || "Maharashtra",
      question: formData.question.trim(),
      consent_to_contact: true
    };

    onSubmit(payload);
  };

  return (
    <div
      className="modal-overlay"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="inquiry-modal-title"
    >
      <div
        className="modal-dialog review-inquiry-modal"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow" style={{ fontSize: "11px", letterSpacing: "1px" }}>
              STEP 2 OF 2: VERIFICATION & CONSENT
            </span>
            <h3 id="inquiry-modal-title" style={{ margin: "4px 0 0" }}>
              Review Admission Inquiry
            </h3>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <p className="modal-lead-note" style={{ fontSize: "13px", color: "#64748B", margin: "10px 0 16px" }}>
          Please verify the information below before submitting. Our admissions committee will reach out using these details.
        </p>

        {validationError && (
          <div
            className="staff-error"
            style={{ marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}
            role="alert"
          >
            <AlertCircle size={16} />
            <span>{validationError}</span>
          </div>
        )}

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="inquiry-name">
              Full Name <span className="req">*</span>
            </label>
            <input
              id="inquiry-name"
              ref={nameInputRef}
              type="text"
              value={formData.student_name}
              onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
              placeholder="e.g. Aditi Deshmukh"
              required
              disabled={isSubmitting}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="form-group">
              <label htmlFor="inquiry-phone">
                Mobile Number (10 Digits) <span className="req">*</span>
              </label>
              <input
                id="inquiry-phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="e.g. 9822334455"
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="form-group">
              <label htmlFor="inquiry-email">
                Email Address <span className="req">*</span>
              </label>
              <input
                id="inquiry-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="e.g. aditi@gmail.com"
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="inquiry-program">
              Target Program (2026–27) <span className="req">*</span>
            </label>
            <select
              id="inquiry-program"
              value={formData.program_interest}
              onChange={(e) => {
                const selected = e.target.value;
                setFormData({ ...formData, program_interest: selected });
                if (onProgramChange) onProgramChange(selected);
              }}
              disabled={isSubmitting}
            >
              <option value="">-- Select your preferred program --</option>
              {programs
                .filter((p) => p.id !== "diploma-cyber" && !/cyber\s*security.*digital\s*forensics/i.test(p.name))
                .map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name} ({formatCurrency(p.annual_tuition_fee)}/yr)
                  </option>
                ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="form-group">
              <label htmlFor="inquiry-12th">12th PCM Marks (%)</label>
              <input
                id="inquiry-12th"
                type="number"
                step="0.1"
                min="35"
                max="100"
                value={formData.marks_12th}
                onChange={(e) => setFormData({ ...formData, marks_12th: e.target.value })}
                placeholder="e.g. 78.5"
                disabled={isSubmitting}
              />
            </div>
            <div className="form-group">
              <label htmlFor="inquiry-entrance">CET / JEE Percentile</label>
              <input
                id="inquiry-entrance"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={formData.entrance_score}
                onChange={(e) => setFormData({ ...formData, entrance_score: e.target.value })}
                placeholder="e.g. 84.2"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="inquiry-location">Domicile / City</label>
            <input
              id="inquiry-location"
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g. Pune, Maharashtra"
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="inquiry-question">Specific Question or Remarks (Optional)</label>
            <textarea
              id="inquiry-question"
              rows={2}
              value={formData.question}
              onChange={(e) => setFormData({ ...formData, question: e.target.value })}
              placeholder="Ask about scholarship eligibility, hostel booking, or counselling slots..."
              disabled={isSubmitting}
            />
          </div>

          {/* Explicit Consent Checkbox */}
          <div className="consent-checkbox-wrap" style={{ margin: "14px 0", background: "#F8FAFC", padding: "12px", borderRadius: "6px", border: "1px solid #E2E8F0" }}>
            <label style={{ display: "flex", gap: "10px", alignItems: "flex-start", cursor: "pointer", fontSize: "12px", color: "#334155", margin: 0 }}>
              <input
                type="checkbox"
                checked={formData.consent}
                onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                style={{ marginTop: "3px", cursor: "pointer" }}
                required
                disabled={isSubmitting}
              />
              <span>
                <strong>Mandatory Consent</strong>: I authorize the Admissions Directorate of MGM University IICT to contact me via Call, SMS, WhatsApp, or Email regarding admission procedure, counseling schedule, and fee guidelines.
              </span>
            </label>
          </div>

          <div className="modal-actions" style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "18px" }}>
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={isSubmitting || !formData.consent}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              {isSubmitting ? (
                <>Submitting Inquiry...</>
              ) : (
                <>
                  <CheckCircle2 size={16} /> Confirm &amp; Submit Inquiry
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
