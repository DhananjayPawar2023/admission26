import React from "react";
import { ArrowRight, GitCompareArrows, GraduationCap, ShieldCheck } from "lucide-react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { supabaseConfigured } from "../lib/supabase";

export function SetupNotice() {
  if (supabaseConfigured) return null;
  return (
    <div className="setup-notice" role="alert">
      <strong>Supabase configuration notice:</strong>
      <span>
        Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to enable live database storage and staff access.
      </span>
    </div>
  );
}

export function Home({ onStart, onApply, onCompare, onStaff, onMyInquiry, session }) {
  return (
    <div className="home-shell">
      <Header
        onHome={() => {}}
        onInquiry={onStart}
        onPrograms={onCompare}
        onApply={onApply}
        onMyInquiry={onMyInquiry}
        onStaff={onStaff}
        session={session}
        activeNav="home"
      />
      <SetupNotice />
      <main className="hero">
        <div className="hero-copy">
          <p className="eyebrow">MGM UNIVERSITY · IICT ADMISSIONS 2026–27</p>
          <h1>
            Find the right
            <br />
            <em>path into IICT.</em>
          </h1>
          <p className="hero-sub">
            Authoritative admission guidance for B.Tech AI &amp; ML, CSE (AI), IT, and Data Science. Get accurate fee structures, eligibility requirements, scholarship details, and connect with the official admission counselling desk.
          </p>
          <div className="hero-actions">
            <button type="button" className="primary-button" onClick={onApply}>
              Direct Apply (2026–27) <ArrowRight size={18} aria-hidden="true" />
            </button>
            <button type="button" className="secondary-button" onClick={onStart}>
              Admissions Chat
            </button>
            <button type="button" className="secondary-button" onClick={onCompare}>
              View Fees &amp; Seats
            </button>
          </div>
          <div className="trust-line">
            <ShieldCheck size={17} aria-hidden="true" />
            <span>
              Official IICT data <b>•</b> 150+ Merit Scholarships <b>•</b> Direct admissions guidance
            </span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-grid" />
          <div className="art-card art-card-main">
            <span className="art-kicker">IICT / 2026–27</span>
            <span className="art-title">
              Ideas
              <br />
              <strong>into impact.</strong>
            </span>
            <span className="art-note">Institute of Information &amp; Communication Technology · MGM University</span>
          </div>
          <div className="art-card art-card-small">
            <GraduationCap size={16} />
            <span>
              B.Tech Fees from<br />
              <strong>₹1,50,000 / yr</strong>
            </span>
          </div>
          <div className="art-seal">MGM</div>
        </div>
      </main>
      <section className="compare-banner" aria-label="Program Comparison Callout">
        <div>
          <strong>Comparing B.Tech streams for 2026–27?</strong>
          <span>Examine official fees, eligibility criteria, and seats across AI &amp; ML, CSE (AI), IT, and Data Science.</span>
        </div>
        <button type="button" className="secondary-button" onClick={onCompare}>
          <GitCompareArrows size={16} aria-hidden="true" /> Compare All Programs
        </button>
      </section>
      <div className="home-footer">
        <span>Admission counselling desk · MGM Campus, N-6, CIDCO</span>
        <span>MGM University · Chhatrapati Sambhajinagar, Maharashtra 431003</span>
        <span>Helpline: +91 940 449 4299 / 0240-6481000 Ext. 2201 / +91 906 761 2000</span>
      </div>
      <Footer onStaff={onStaff} />
    </div>
  );
}
