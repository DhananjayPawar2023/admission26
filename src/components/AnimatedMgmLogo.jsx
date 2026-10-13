import React from "react";

export function AnimatedMgmLogo({ onClick }) {
  return (
    <button
      className="mgm-brand-header-btn"
      onClick={onClick}
      title="IICT - MGM University"
      type="button"
    >
      <div className="mgm-logo-emblem-box">
        <img
          src="/LogoMGM.svg"
          alt="MGM University Crest"
          className="mgm-crest-vector"
          onError={(e) => {
            e.currentTarget.src = "https://cdn.mgmtech.org/static/mgmu.ac.in/assets/images/LogoMGM.svg";
          }}
        />
      </div>
      <div className="mgm-brand-divider" />
      <div className="mgm-brand-titles">
        <div className="mgm-brand-row">
          <span className="mgm-brand-univ">MGM UNIVERSITY</span>
          <span className="mgm-brand-badge">NAAC &apos;A&apos; GRADE</span>
        </div>
        <span className="mgm-brand-inst">Institute of Information &amp; Communication Technology (IICT)</span>
      </div>
    </button>
  );
}
