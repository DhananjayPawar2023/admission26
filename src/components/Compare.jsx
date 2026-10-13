import React, { useState } from "react";
import {
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  ExternalLink,
  GitCompareArrows,
  LayoutGrid,
  MessageCircle,
  Search,
  ShieldCheck,
  X
} from "lucide-react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { formatCurrency } from "../utils/formatters";

export function Compare({ programs, facts, onBack, onInquiry, onApply, onMyInquiry, onStaff, session }) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("boxes"); // "boxes" | "compare"
  const [compareList, setCompareList] = useState(["btech-aiml", "btech-cse-ai", "btech-it", "btech-ds"]);

  const toggleCompare = (id) => {
    setCompareList((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 4) {
        return [...prev.slice(1), id];
      }
      return [...prev, id];
    });
  };

  const filteredPrograms = programs.filter((p) => {
    const matchesCategory =
      activeCategory === "all" ||
      (activeCategory === "ug" && p.level === "Undergraduate" && p.id !== "btech-dsy") ||
      (activeCategory === "dsy" && p.id === "btech-dsy") ||
      (activeCategory === "pg" && p.level === "Postgraduate") ||
      (activeCategory === "diploma" && (p.level === "Diploma" || p.level === "Certificate"));

    const matchesSearch =
      !searchQuery.trim() ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.career_opportunities.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  const comparedPrograms = programs.filter((p) => compareList.includes(p.id));

  return (
    <>
      <Header
        onHome={onBack}
        onInquiry={() => onInquiry()}
        onPrograms={() => {}}
        onApply={onApply}
        onMyInquiry={onMyInquiry}
        onStaff={onStaff}
        session={session}
        activeNav="programs"
      />
      <main className="programs-boxes-page">
        <div className="programs-header-section">
          <div>
            <p className="eyebrow">OFFICIAL IICT 2026–27 ACADEMIC SCHEDULE</p>
            <h1>Programs &amp; Fee Structure</h1>
            <p className="subtitle">
              Verified annual tuition fees, approved seat matrix, eligibility criteria, and career roles for all programs at the Institute of Information and Communication Technology (IICT), MGM University.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            <div className="view-switcher-group" role="group" aria-label="View format switcher">
              <button
                type="button"
                className={`view-switcher-btn ${viewMode === "boxes" ? "active" : ""}`}
                onClick={() => setViewMode("boxes")}
                aria-pressed={viewMode === "boxes"}
              >
                <LayoutGrid size={14} aria-hidden="true" /> Program Boxes
              </button>
              <button
                type="button"
                className={`view-switcher-btn ${viewMode === "compare" ? "active" : ""}`}
                onClick={() => setViewMode("compare")}
                aria-pressed={viewMode === "compare"}
              >
                <GitCompareArrows size={14} aria-hidden="true" /> Compare Side-by-Side
                {compareList.length > 0 && (
                  <span className="compare-count-badge">{compareList.length}</span>
                )}
              </button>
            </div>
            <button type="button" className="primary-button" onClick={() => onApply ? onApply() : onInquiry()}>
              Direct Apply <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
        </div>

        {viewMode === "boxes" ? (
          <>
            <div className="program-controls-row">
              <div className="program-category-tabs" role="tablist" aria-label="Program Levels">
                <button
                  type="button"
                  className={`category-tab-btn ${activeCategory === "all" ? "active" : ""}`}
                  onClick={() => setActiveCategory("all")}
                >
                  All Programs ({programs.length})
                </button>
                <button
                  type="button"
                  className={`category-tab-btn ${activeCategory === "ug" ? "active" : ""}`}
                  onClick={() => setActiveCategory("ug")}
                >
                  B.Tech UG (4)
                </button>
                <button
                  type="button"
                  className={`category-tab-btn ${activeCategory === "dsy" ? "active" : ""}`}
                  onClick={() => setActiveCategory("dsy")}
                >
                  Lateral Entry DSY
                </button>
                <button
                  type="button"
                  className={`category-tab-btn ${activeCategory === "pg" ? "active" : ""}`}
                  onClick={() => setActiveCategory("pg")}
                >
                  M.Tech PG (2)
                </button>
                <button
                  type="button"
                  className={`category-tab-btn ${activeCategory === "diploma" ? "active" : ""}`}
                  onClick={() => setActiveCategory("diploma")}
                >
                  Diploma &amp; Cert (2)
                </button>
              </div>

              <div className="program-search-box">
                <Search size={15} color="#94A3B8" aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Search branch, e.g. AI, Cloud, Cyber..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Filter programs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#94A3B8" }}
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="program-box-grid">
              {filteredPrograms.map((p) => {
                const isPopular = p.id === "btech-aiml" || p.id === "btech-cse-ai";
                const isCompared = compareList.includes(p.id);
                return (
                  <div key={p.id} className={`program-card-box ${isPopular ? "featured" : ""}`}>
                    {isPopular && <div className="program-card-badge">HIGH DEMAND 2026–27</div>}
                    <div className="program-card-head">
                      <div className="program-type-tags">
                        <span className="degree-pill">{p.degree}</span>
                        <span className="duration-pill">{p.duration}</span>
                      </div>
                      <span className="intake-pill">
                        <strong>{p.intake_seats}</strong> Seats
                      </span>
                    </div>

                    <h3 className="program-card-title">{p.name}</h3>

                    <div className="program-fee-box">
                      <div className="fee-primary-row">
                        <span className="fee-label">Annual Tuition Fee</span>
                        <span className="fee-amount">
                          {formatCurrency(p.annual_tuition_fee)} <small>/ year</small>
                        </span>
                      </div>
                      <div className="fee-scholarship-note">
                        <Award size={13} aria-hidden="true" />
                        <span>150+ Merit Scholarships up to 100% tuition waiver</span>
                      </div>
                    </div>

                    <p className="program-card-desc">{p.description}</p>

                    <div className="program-detail-block">
                      <span className="detail-block-title">Eligibility Criteria</span>
                      <p className="detail-block-text">{p.eligibility}</p>
                    </div>

                    <div className="program-detail-block">
                      <span className="detail-block-title">Key Career Opportunities</span>
                      <p className="detail-block-roles">{p.career_opportunities}</p>
                    </div>

                    <div className="program-card-actions">
                      <button
                        type="button"
                        className="card-direct-apply-btn"
                        onClick={() => onApply ? onApply(p.name) : onInquiry(p.name)}
                        title={`Direct Application for ${p.name}`}
                      >
                        Direct Apply <ArrowRight size={13} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="card-inquire-btn"
                        onClick={() => onInquiry(p.name)}
                        title="Chat with Admissions Counsellor for this specific program"
                      >
                        <MessageCircle size={13} aria-hidden="true" /> Inquire for This
                      </button>
                    </div>

                    <label className={`card-compare-toggle ${isCompared ? "checked" : ""}`}>
                      <input
                        type="checkbox"
                        checked={isCompared}
                        onChange={() => toggleCompare(p.id)}
                      />
                      <span>{isCompared ? "✓ In Comparison Matrix" : "+ Add to Compare"}</span>
                    </label>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* SIDE-BY-SIDE COMPARISON MATRIX VIEW */
          <div className="compare-matrix-container">
            <div className="compare-matrix-header">
              <div>
                <h3>Side-by-Side Program Comparison Matrix</h3>
                <p style={{ margin: "4px 0 0", color: "#64748B", fontSize: "13px" }}>
                  Select up to 4 programs below to examine exact fees, intake, curriculum, and career pathways.
                </p>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setViewMode("boxes")}
                style={{ padding: "8px 14px", fontSize: "12px" }}
              >
                ← Back to Program Cards
              </button>
            </div>

            <div className="compare-picker-chips">
              {programs.map((prog) => {
                const isSel = compareList.includes(prog.id);
                return (
                  <button
                    type="button"
                    key={prog.id}
                    className={`compare-chip ${isSel ? "selected" : ""}`}
                    onClick={() => toggleCompare(prog.id)}
                  >
                    {isSel ? <Check size={13} /> : <span style={{ width: 13, height: 13, display: "inline-block" }}>+</span>}
                    {prog.name}
                  </button>
                );
              })}
            </div>

            {comparedPrograms.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748B" }}>
                <p>No programs selected. Click any program chip above to start comparing!</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="compare-matrix-table">
                  <thead>
                    <tr>
                      <th className="col-row-title">Parameter</th>
                      {comparedPrograms.map((p) => (
                        <th key={p.id} className="col-program-head">
                          <span className="degree-pill" style={{ display: "inline-block", marginBottom: "6px" }}>
                            {p.degree} · {p.duration}
                          </span>
                          <strong>{p.name}</strong>
                          <span className="intake-pill">
                            <strong>{p.intake_seats}</strong> Seats
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th className="col-row-title">Annual Tuition Fee</th>
                      {comparedPrograms.map((p) => (
                        <td key={p.id}>
                          <span className="compare-fee-tag">
                            {formatCurrency(p.annual_tuition_fee)} <small>/ year</small>
                          </span>
                          <div style={{ fontSize: "11px", color: "#C05A21", marginTop: "4px", fontWeight: 600 }}>
                            150+ Merit Scholarships Available
                          </div>
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <th className="col-row-title">Approved Seats</th>
                      {comparedPrograms.map((p) => (
                        <td key={p.id}>
                          <strong style={{ color: "#001E32", fontSize: "15px" }}>{p.intake_seats} seats</strong>
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <th className="col-row-title">Eligibility Criteria</th>
                      {comparedPrograms.map((p) => (
                        <td key={p.id} style={{ fontSize: "12px", lineHeight: "1.5", color: "#334155" }}>
                          {p.eligibility}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <th className="col-row-title">Curriculum Focus</th>
                      {comparedPrograms.map((p) => (
                        <td key={p.id} style={{ fontSize: "12.5px", lineHeight: "1.5", color: "#475569" }}>
                          {p.description}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <th className="col-row-title">Career Roles</th>
                      {comparedPrograms.map((p) => (
                        <td key={p.id} style={{ fontSize: "12px", color: "#001E32", fontWeight: 600 }}>
                          {p.career_opportunities}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <th className="col-row-title">Admissions Action</th>
                      {comparedPrograms.map((p) => (
                        <td key={p.id}>
                          <div className="display-flex-col-gap8">
                            <button
                              type="button"
                              className="card-direct-apply-btn"
                              onClick={() => onApply ? onApply(p.name) : onInquiry(p.name)}
                            >
                              Direct Apply <ArrowRight size={12} />
                            </button>
                            <button
                              type="button"
                              className="card-inquire-btn"
                              onClick={() => onInquiry(p.name)}
                            >
                              <MessageCircle size={12} /> Inquire for This
                            </button>
                          </div>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Floating Compare Action Bar in Boxes View */}
        {viewMode === "boxes" && compareList.length >= 2 && (
          <div className="floating-compare-bar" role="status" aria-live="polite">
            <span>{compareList.length} Programs Selected for Comparison</span>
            <button type="button" className="floating-compare-btn" onClick={() => setViewMode("compare")}>
              <GitCompareArrows size={14} /> Compare Side-by-Side
            </button>
            <button type="button" className="floating-clear-btn" onClick={() => setCompareList([])}>
              Clear
            </button>
          </div>
        )}

        <div className="fee-guidelines-box">
          <div className="guideline-shield-icon">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h4>Verified MGM University IICT Fee &amp; Admission Guidelines (2026–27)</h4>
            <div className="guidelines-grid">
              <div className="guideline-item">
                <CheckCircle2 size={15} color="#C05A21" />
                <span>Application Fee: <b>{facts.application_fee_domestic || "₹2,000"}</b> (Domestic)</span>
              </div>
              <div className="guideline-item">
                <CheckCircle2 size={15} color="#C05A21" />
                <span>Caution Deposit: <b>{facts.caution_money_deposit || "₹5,000"}</b> (100% Refundable)</span>
              </div>
              <div className="guideline-item">
                <CheckCircle2 size={15} color="#C05A21" />
                <span>Eligibility Fee: <b>{facts.eligibility_fee || "₹5,000"}</b> (One-time)</span>
              </div>
              <div className="guideline-item">
                <CheckCircle2 size={15} color="#C05A21" />
                <span>Application Deadline: <b>{facts.application_deadline || "September 23, 2026"}</b></span>
              </div>
              <div className="guideline-item">
                <CheckCircle2 size={15} color="#C05A21" />
                <span>Admission Helpline: <b>{facts.helpline_phone_1 || "+91 940 449 4299"}</b></span>
              </div>
              <div className="guideline-item">
                <CheckCircle2 size={15} color="#C05A21" />
                <span>Office: <b>{facts.helpline_phone_2 || "0240-6481000 Ext. 2201"}</b></span>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer onStaff={onStaff} />
    </>
  );
}
