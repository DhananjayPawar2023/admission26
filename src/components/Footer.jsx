import React from "react";

export function Footer({ onStaff }) {
  return (
    <footer className="site-footer" role="contentinfo">
      <span>MGM University · IICT Admissions (2026–27)</span>
      <span>
        Authoritative admissions information verified with{" "}
        <a
          href="https://iict.mgmu.ac.in"
          target="_blank"
          rel="noreferrer"
          style={{ color: "inherit", textDecoration: "underline" }}
        >
          iict.mgmu.ac.in
        </a>
        . Official seat allocation handled by MGM University Admissions Directorate.
      </span>
      <button
        type="button"
        className="staff-link"
        onClick={onStaff}
        aria-label="Staff and admin portal access"
      >
        Staff / Admin Portal
      </button>
    </footer>
  );
}
