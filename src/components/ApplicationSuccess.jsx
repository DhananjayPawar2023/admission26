import React from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  FileCheck,
  GraduationCap,
  Home,
  Lock,
  PhoneCall,
  Printer,
  Search,
  ShieldCheck
} from "lucide-react";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function ApplicationSuccess({
  application,
  onHome,
  onTrack,
  onInquiry,
  onPrograms,
  onStaff,
  session
}) {
  const handlePrint = () => {
    window.print();
  };

  const appNumber = application?.application_number || "MGMU-APP-2026-PENDING";
  const candidateName = application?.student_name || "Applicant";
  const program = application?.program_choice || "IICT B.Tech Program";
  const phone = application?.phone || "";
  const submissionTime = application?.created_at
    ? new Date(application.created_at).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short"
      })
    : new Date().toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short"
      });

  return (
    <div className="app-success-layout">
      <Header
        onHome={onHome}
        onInquiry={onInquiry}
        onPrograms={onPrograms}
        onMyInquiry={onTrack}
        onStaff={onStaff}
        session={session}
        activeNav="apply"
      />

      <main className="app-success-main">
        <div className="app-success-banner">
          <div className="app-success-icon-badge" aria-hidden="true">
            <CheckCircle2 size={36} />
          </div>
          <p className="eyebrow">MGM UNIVERSITY · IICT ADMISSIONS 2026–27</p>
          <h1>Application Received by Admissions Portal</h1>
          <p className="app-success-lead">
            Your direct application has been successfully logged for official scrutiny by the IICT Admissions Committee.
          </p>
        </div>

        {/* Official Application Summary Card */}
        <div className="app-summary-card">
          <div className="app-summary-header">
            <div>
              <span className="app-summary-kicker">Official Reference ID</span>
              <h2 className="app-ref-number">{appNumber}</h2>
            </div>
            <div className="app-status-pill">
              <Clock size={13} aria-hidden="true" />
              <span>Status: Under Committee Scrutiny</span>
            </div>
          </div>

          <div className="app-summary-grid">
            <div className="app-summary-item">
              <span className="item-label">Candidate Name</span>
              <strong className="item-value">{candidateName}</strong>
            </div>

            <div className="app-summary-item">
              <span className="item-label">Target Program</span>
              <strong className="item-value">{program}</strong>
            </div>

            <div className="app-summary-item">
              <span className="item-label">Registered Phone</span>
              <strong className="item-value">
                {phone ? `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` : "—"}
              </strong>
            </div>

            <div className="app-summary-item">
              <span className="item-label">Submission Date</span>
              <strong className="item-value">{submissionTime}</strong>
            </div>
          </div>

          <div className="app-privacy-notice">
            <Lock size={13} aria-hidden="true" />
            <span>
              Your personal details are kept private. Sensitive contact and academic documents are restricted exclusively to authorized MGM University admissions personnel.
            </span>
          </div>
        </div>

        {/* Honest Admissions Notice: No seat claimed or payment taken */}
        <div className="app-notice-box">
          <div className="app-notice-icon">
            <ShieldCheck size={24} color="#C05A21" aria-hidden="true" />
          </div>
          <div>
            <h3>Official Admissions Desk Process &amp; Next Steps</h3>
            <p>
              Please note: <strong>No seat reservation or fee payment has been made yet.</strong> This portal has recorded your application for administrative processing. Here is what happens next:
            </p>
            <ol className="app-steps-list">
              <li>
                <strong>Document Scrutiny:</strong> The IICT admissions committee verifies your qualifying marks (12th / Diploma) and entrance scores (MGMU-CET / MHT-CET / JEE).
              </li>
              <li>
                <strong>Counsellor Callback:</strong> An authorized counsellor will reach out via your registered phone number to guide you through branch counseling and scholarship eligibility.
              </li>
              <li>
                <strong>Official Offer &amp; Fee Payment:</strong> Upon approval, provisional allotment and fee payment links are issued directly through the official MGM University Portal (<code>https://admissions.mgmu.ac.in</code>) or at the on-campus admissions desk.
              </li>
            </ol>
          </div>
        </div>

        {/* Actions Row */}
        <div className="app-success-actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => onTrack(appNumber, phone)}
          >
            <Search size={15} aria-hidden="true" />
            <span>Track Application Status</span>
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={handlePrint}
          >
            <Printer size={15} aria-hidden="true" />
            <span>Print / Save Application Slip</span>
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={onHome}
          >
            <Home size={15} aria-hidden="true" />
            <span>Back to Admissions Home</span>
          </button>
        </div>

        <div className="app-helpline-box">
          <PhoneCall size={18} color="#C05A21" aria-hidden="true" />
          <span>
            Have urgent questions regarding your application? Contact the IICT Helpline:{" "}
            <a href="tel:+919404494299"><strong>+91 940 449 4299</strong></a> /{" "}
            <strong>0240-6481000 Ext. 2201</strong> (Mon–Sat, 10:00 AM – 5:00 PM).
          </span>
        </div>
      </main>

      <Footer onStaff={onStaff} />
    </div>
  );
}
