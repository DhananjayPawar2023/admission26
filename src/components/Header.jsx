import React, { useState } from "react";
import { ArrowRight, LogIn, Menu, Phone, PhoneCall, ShieldCheck, X } from "lucide-react";
import { AnimatedMgmLogo } from "./AnimatedMgmLogo";

export function Header({ onHome, onInquiry, onPrograms, onApply, onMyInquiry, onStaff, session, activeNav }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (callback) => {
    setMobileMenuOpen(false);
    if (callback) callback();
  };

  return (
    <>
      <header className="site-header" role="banner">
        <AnimatedMgmLogo onClick={() => handleNavClick(onHome)} />
        <nav className="site-nav" aria-label="Main Navigation">
          <button
            type="button"
            className={activeNav === "home" ? "active" : ""}
            onClick={onHome}
            aria-current={activeNav === "home" ? "page" : undefined}
          >
            Home
          </button>
          <button
            type="button"
            className={activeNav === "programs" ? "active" : ""}
            onClick={onPrograms}
            aria-current={activeNav === "programs" ? "page" : undefined}
          >
            Programs &amp; Fees
          </button>
          <button
            type="button"
            className={activeNav === "apply" ? "active" : ""}
            onClick={onApply}
            aria-current={activeNav === "apply" ? "page" : undefined}
          >
            Direct Apply
          </button>
          <button
            type="button"
            className={activeNav === "inquiry" ? "active" : ""}
            onClick={onInquiry}
            aria-current={activeNav === "inquiry" ? "page" : undefined}
          >
            Admissions Chat
          </button>
          <button
            type="button"
            className={activeNav === "myInquiry" ? "active" : ""}
            onClick={onMyInquiry}
            aria-current={activeNav === "myInquiry" ? "page" : undefined}
          >
            Track Status
          </button>
        </nav>
        <div className="header-right">
          <a
            href="tel:+919404494299"
            className="header-phone-badge"
            title="Call IICT Admission Helpline: +91 940 449 4299"
            aria-label="Call IICT Admission Helpline at +91 940 449 4299"
          >
            <Phone size={13} aria-hidden="true" />
            <span>+91 940 449 4299</span>
          </a>
          <button
            type="button"
            className="header-cta-btn"
            onClick={onApply || onInquiry}
            aria-label="Start direct application"
          >
            Apply Now <ArrowRight size={13} aria-hidden="true" />
          </button>
          {session ? (
            <button
              type="button"
              className="header-signin-btn logged-in"
              onClick={onStaff}
              title="Staff Dashboard"
              aria-label="Open Staff Dashboard"
            >
              <ShieldCheck size={13} aria-hidden="true" /> Staff
            </button>
          ) : (
            <button
              type="button"
              className="header-signin-btn"
              onClick={onStaff}
              title="Staff & Teacher Sign In"
              aria-label="Staff Sign In"
            >
              Sign In
            </button>
          )}
          <button
            type="button"
            className="mobile-hamburger-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* Responsive Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div
          className="mobile-drawer-overlay"
          onClick={() => setMobileMenuOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation"
        >
          <div className="mobile-drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-header">
              <div className="drawer-brand-col">
                <strong>MGM UNIVERSITY</strong>
                <small>IICT Admissions 2026–27</small>
              </div>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="mobile-drawer-nav" aria-label="Mobile Menu Links">
              <button
                type="button"
                className={`drawer-nav-item ${activeNav === "home" ? "active" : ""}`}
                onClick={() => handleNavClick(onHome)}
              >
                <span>Home</span>
                <ArrowRight size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={`drawer-nav-item ${activeNav === "programs" ? "active" : ""}`}
                onClick={() => handleNavClick(onPrograms)}
              >
                <span>Programs &amp; Official Fees</span>
                <ArrowRight size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={`drawer-nav-item ${activeNav === "apply" ? "active" : ""}`}
                onClick={() => handleNavClick(onApply)}
              >
                <span>Direct Application (2026–27)</span>
                <ArrowRight size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={`drawer-nav-item ${activeNav === "inquiry" ? "active" : ""}`}
                onClick={() => handleNavClick(onInquiry)}
              >
                <span>Admissions Counselling Chat</span>
                <ArrowRight size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={`drawer-nav-item ${activeNav === "myInquiry" ? "active" : ""}`}
                onClick={() => handleNavClick(onMyInquiry)}
              >
                <span>Track Application / Inquiry</span>
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </nav>

            <div className="mobile-drawer-actions">
              <button
                type="button"
                className="drawer-apply-cta"
                onClick={() => handleNavClick(onApply || onInquiry)}
              >
                Direct Apply Now <ArrowRight size={14} aria-hidden="true" />
              </button>

              <a href="tel:+919404494299" className="drawer-helpline-link">
                <PhoneCall size={16} aria-hidden="true" />
                <div>
                  <strong>+91 940 449 4299</strong>
                  <small>IICT Admission Helpline (Mon–Sat)</small>
                </div>
              </a>

              <div className="drawer-footer-row">
                {session ? (
                  <button type="button" className="drawer-staff-btn" onClick={() => handleNavClick(onStaff)}>
                    <ShieldCheck size={14} aria-hidden="true" /> Open Staff Portal
                  </button>
                ) : (
                  <button type="button" className="drawer-staff-btn" onClick={() => handleNavClick(onStaff)}>
                    <LogIn size={14} aria-hidden="true" /> Staff Sign In
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
