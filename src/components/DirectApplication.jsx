import React, { useState, useEffect } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  FileText,
  GraduationCap,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  User
} from "lucide-react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { isValidEmail, isValidPhone, normalizePhone } from "../utils/formatters";

export function DirectApplication({
  initialProgram,
  programs,
  facts,
  onSubmit,
  onBack,
  onPrograms,
  onInquiry,
  onMyInquiry,
  onStaff,
  session
}) {
  const [selectedProgram, setSelectedProgram] = useState(() => {
    if (initialProgram && !/cyber\s*security.*digital\s*forensics/i.test(initialProgram) && initialProgram !== "Diploma in Cyber Security and Digital Forensics") {
      return initialProgram;
    }
    return "";
  });
  const [candidateName, setCandidateName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [category, setCategory] = useState("General");
  const [degreeLevel, setDegreeLevel] = useState("Undergraduate");
  const [qualifyingExam, setQualifyingExam] = useState("HSC (12th Science)");
  const [marksPercentage, setMarksPercentage] = useState("");
  const [entranceExam, setEntranceExam] = useState("MGMU-CET");
  const [entranceRollNo, setEntranceRollNo] = useState("");
  const [entranceScore, setEntranceScore] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("Maharashtra");
  const [pincode, setPincode] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [declarationAgreed, setDeclarationAgreed] = useState(false);

  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialProgram) {
      if (/cyber\s*security.*digital\s*forensics/i.test(initialProgram) || initialProgram === "Diploma in Cyber Security and Digital Forensics") {
        setSelectedProgram("");
      } else {
        setSelectedProgram(initialProgram);
      }
    }
  }, [initialProgram]);

  // Adjust default degree level based on program selection
  useEffect(() => {
    if (selectedProgram) {
      if (/m\.tech|postgraduate/i.test(selectedProgram)) {
        setDegreeLevel("Postgraduate");
        setQualifyingExam("B.E. / B.Tech / MCA / M.Sc");
        setEntranceExam("GATE / MGMU-CET");
      } else if (/lateral|dsy/i.test(selectedProgram)) {
        setDegreeLevel("Undergraduate");
        setQualifyingExam("Diploma in Engineering / B.Sc");
      } else {
        setDegreeLevel("Undergraduate");
      }
    }
  }, [selectedProgram]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    // 1. Deliberate Program Selection Validation
    if (!selectedProgram || !selectedProgram.trim()) {
      setFormError("Please deliberately select your intended academic program.");
      window.scrollTo({ top: 120, behavior: "smooth" });
      return;
    }

    // 2. Personal Information Validation
    if (!candidateName || candidateName.trim().length < 2) {
      setFormError("Please enter your full legal candidate name as per your SSC marksheet.");
      return;
    }
    if (!dob) {
      setFormError("Please specify your date of birth.");
      return;
    }
    if (!gender) {
      setFormError("Please select your gender.");
      return;
    }

    // 3. Contact Validation
    if (!isValidEmail(email)) {
      setFormError("Please enter a valid personal email address for admission communications.");
      return;
    }
    if (!isValidPhone(phone)) {
      setFormError("Please enter a valid 10-digit mobile number for SMS/verification alerts.");
      return;
    }
    if (guardianPhone && !isValidPhone(guardianPhone)) {
      setFormError("Please enter a valid 10-digit guardian mobile number or leave it blank.");
      return;
    }

    // 4. Academic Details Validation
    const marksNum = parseFloat(marksPercentage);
    if (isNaN(marksNum) || marksNum < 35 || marksNum > 100) {
      setFormError("Please enter a valid aggregate percentage or PCM percentage between 35% and 100%.");
      return;
    }

    // 5. Address Validation
    if (!city || city.trim().length < 2) {
      setFormError("Please enter your city/district.");
      return;
    }
    if (pincode && (pincode.trim().length !== 6 || isNaN(parseInt(pincode)))) {
      setFormError("Please enter a valid 6-digit postal pincode.");
      return;
    }

    // 6. Declaration Check
    if (!declarationAgreed) {
      setFormError("You must verify the declaration before submitting your official application.");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      student_name: candidateName.trim(),
      email: email.trim().toLowerCase(),
      phone: normalizePhone(phone),
      dob,
      gender,
      category,
      program_choice: selectedProgram.trim(),
      degree_level: degreeLevel,
      qualifying_exam: qualifyingExam,
      marks_percentage: marksNum,
      entrance_exam: entranceExam,
      entrance_roll_no: entranceRollNo.trim() || null,
      entrance_score: entranceScore.trim() || null,
      address: address.trim() || null,
      city: city.trim(),
      state: state.trim() || "Maharashtra",
      pincode: pincode.trim() || null,
      guardian_name: guardianName.trim() || null,
      guardian_phone: guardianPhone ? normalizePhone(guardianPhone) : null
    };

    try {
      await onSubmit(payload, setFormError, setIsSubmitting);
    } catch (err) {
      setFormError(err?.message || "Failed to submit application. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="direct-app-layout">
      <Header
        onHome={onBack}
        onInquiry={onInquiry}
        onPrograms={onPrograms}
        onMyInquiry={onMyInquiry}
        onStaff={onStaff}
        session={session}
        activeNav="apply"
      />

      <div className="direct-app-banner">
        <div className="direct-app-banner-content">
          <p className="eyebrow">OFFICIAL IICT DIRECT ADMISSION PORTAL · 2026–27</p>
          <h1>Direct Application for Admission</h1>
          <p className="direct-app-banner-sub">
            Institute of Information and Communication Technology · MGM University, Chhatrapati Sambhajinagar.
            Complete this application to submit your academic profile directly to the admissions committee for scrutiny and merit list processing.
          </p>
          <div className="direct-app-privacy-pill">
            <Lock size={13} aria-hidden="true" />
            <span>Your personal details are kept private and processed exclusively by the admissions desk.</span>
          </div>
        </div>
      </div>

      <main className="direct-app-container">
        <form className="direct-app-form" onSubmit={handleSubmit} noValidate>
          {formError && (
            <div className="direct-app-error-banner" role="alert">
              <AlertCircle size={20} aria-hidden="true" />
              <div>
                <strong>Application Incomplete</strong>
                <p>{formError}</p>
              </div>
            </div>
          )}

          {/* Section 1: Academic Program Selection */}
          <section className="direct-app-section" aria-labelledby="section-program-title">
            <div className="direct-app-section-head">
              <div className="section-step-badge">1</div>
              <div>
                <h2 id="section-program-title">Target Academic Program</h2>
                <p>Select the engineering branch you are applying for. Selection must be deliberate.</p>
              </div>
            </div>

            <div className="form-field-group">
              <label htmlFor="program-select">
                Program Choice <span className="req">*</span>
              </label>
              <select
                id="program-select"
                value={selectedProgram}
                onChange={(e) => setSelectedProgram(e.target.value)}
                className="direct-app-select"
                required
              >
                <option value="">— Select an Academic Program —</option>
                {programs
                  .filter((prog) => prog.id !== "diploma-cyber" && !/cyber\s*security.*digital\s*forensics/i.test(prog.name))
                  .map((prog) => (
                    <option key={prog.id} value={prog.name}>
                      {prog.name} ({prog.degree} · {prog.duration})
                    </option>
                  ))}
              </select>
              {!selectedProgram && (
                <span className="field-hint warning">
                  * A deliberate program selection is required to proceed.
                </span>
              )}
              {selectedProgram && (
                <span className="field-hint success">
                  ✓ Selected program: <strong>{selectedProgram}</strong>
                </span>
              )}
            </div>
          </section>

          {/* Section 2: Personal Particulars */}
          <section className="direct-app-section" aria-labelledby="section-personal-title">
            <div className="direct-app-section-head">
              <div className="section-step-badge">2</div>
              <div>
                <h2 id="section-personal-title">Candidate Personal Details</h2>
                <p>Ensure details match your SSC / 10th standard certificate.</p>
              </div>
            </div>

            <div className="direct-app-grid two-cols">
              <div className="form-field-group full-width">
                <label htmlFor="candidate-name">
                  Candidate Full Legal Name <span className="req">*</span>
                </label>
                <input
                  id="candidate-name"
                  type="text"
                  placeholder="e.g. Rahul Ramesh Shinde (as per marksheet)"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  required
                />
              </div>

              <div className="form-field-group">
                <label htmlFor="candidate-dob">
                  Date of Birth <span className="req">*</span>
                </label>
                <input
                  id="candidate-dob"
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  max="2012-12-31"
                  required
                />
              </div>

              <div className="form-field-group">
                <label htmlFor="candidate-gender">
                  Gender <span className="req">*</span>
                </label>
                <select
                  id="candidate-gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  required
                >
                  <option value="">— Select Gender —</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-field-group">
                <label htmlFor="candidate-category">
                  Social Reservation Category <span className="req">*</span>
                </label>
                <select
                  id="candidate-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                >
                  <option value="General">General / Open</option>
                  <option value="OBC">OBC (Other Backward Class)</option>
                  <option value="EWS">EWS (Economically Weaker Section)</option>
                  <option value="TFWS">TFWS (Tuition Fee Waiver Scheme)</option>
                  <option value="SC">SC (Scheduled Caste)</option>
                  <option value="ST">ST (Scheduled Tribe)</option>
                  <option value="NT/VJNT">NT / VJNT / SBC</option>
                </select>
              </div>

              <div className="form-field-group">
                <label htmlFor="candidate-level">Degree Level</label>
                <input
                  id="candidate-level"
                  type="text"
                  value={degreeLevel}
                  readOnly
                  className="input-readonly"
                />
              </div>
            </div>
          </section>

          {/* Section 3: Contact & Communication */}
          <section className="direct-app-section" aria-labelledby="section-contact-title">
            <div className="direct-app-section-head">
              <div className="section-step-badge">3</div>
              <div>
                <h2 id="section-contact-title">Contact &amp; Guardian Information</h2>
                <p>Admissions alerts, merit notifications, and counselling calls are dispatched to these details.</p>
              </div>
            </div>

            <div className="direct-app-grid two-cols">
              <div className="form-field-group">
                <label htmlFor="candidate-phone">
                  Candidate Mobile Number <span className="req">*</span>
                </label>
                <input
                  id="candidate-phone"
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={13}
                  required
                />
                <span className="field-hint">Used as your secure tracker key.</span>
              </div>

              <div className="form-field-group">
                <label htmlFor="candidate-email">
                  Candidate Email Address <span className="req">*</span>
                </label>
                <input
                  id="candidate-email"
                  type="email"
                  placeholder="e.g. rahul@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-field-group">
                <label htmlFor="guardian-name">Parent / Guardian Name</label>
                <input
                  id="guardian-name"
                  type="text"
                  placeholder="Father / Mother / Guardian name"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                />
              </div>

              <div className="form-field-group">
                <label htmlFor="guardian-phone">Parent / Guardian Phone</label>
                <input
                  id="guardian-phone"
                  type="tel"
                  placeholder="10-digit guardian mobile"
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                  maxLength={13}
                />
              </div>
            </div>
          </section>

          {/* Section 4: Academic Background & Entrance Scores */}
          <section className="direct-app-section" aria-labelledby="section-academic-title">
            <div className="direct-app-section-head">
              <div className="section-step-badge">4</div>
              <div>
                <h2 id="section-academic-title">Academic Qualifications &amp; Entrance Exam</h2>
                <p>Enter qualifying exam marks and entrance score for merit evaluation.</p>
              </div>
            </div>

            <div className="direct-app-grid two-cols">
              <div className="form-field-group">
                <label htmlFor="qualifying-exam">
                  Qualifying Exam <span className="req">*</span>
                </label>
                <select
                  id="qualifying-exam"
                  value={qualifyingExam}
                  onChange={(e) => setQualifyingExam(e.target.value)}
                  required
                >
                  <option value="HSC (12th Science)">HSC (12th Science / PCM)</option>
                  <option value="CBSE / ICSE 12th">CBSE / ICSE 12th Standard</option>
                  <option value="Polytechnic Diploma">Polytechnic Engineering Diploma</option>
                  <option value="B.E. / B.Tech / MCA / M.Sc">B.E. / B.Tech / MCA / M.Sc (for PG)</option>
                  <option value="Other">Other Equivalent Board</option>
                </select>
              </div>

              <div className="form-field-group">
                <label htmlFor="marks-percentage">
                  12th PCM % or Aggregate % <span className="req">*</span>
                </label>
                <input
                  id="marks-percentage"
                  type="number"
                  step="0.01"
                  min="35"
                  max="100"
                  placeholder="e.g. 84.50"
                  value={marksPercentage}
                  onChange={(e) => setMarksPercentage(e.target.value)}
                  required
                />
                <span className="field-hint">Minimum 45% (40% for reserved categories) required for B.Tech.</span>
              </div>

              <div className="form-field-group">
                <label htmlFor="entrance-exam">Entrance Examination</label>
                <select
                  id="entrance-exam"
                  value={entranceExam}
                  onChange={(e) => setEntranceExam(e.target.value)}
                >
                  <option value="MGMU-CET">MGMU-CET 2026</option>
                  <option value="MHT-CET">MHT-CET 2026</option>
                  <option value="JEE Main">JEE Main 2026</option>
                  <option value="GATE">GATE (for M.Tech)</option>
                  <option value="Appearing / Planned">Yet to Appear / Scheduled</option>
                  <option value="None">None / Direct Management Quota</option>
                </select>
              </div>

              <div className="form-field-group">
                <label htmlFor="entrance-score">Entrance Score / Percentile</label>
                <input
                  id="entrance-score"
                  type="text"
                  placeholder="e.g. 89.45 Percentile or 140/200"
                  value={entranceScore}
                  onChange={(e) => setEntranceScore(e.target.value)}
                />
              </div>

              <div className="form-field-group full-width">
                <label htmlFor="entrance-roll-no">Entrance Exam Roll / Application Number (Optional)</label>
                <input
                  id="entrance-roll-no"
                  type="text"
                  placeholder="e.g. 2601004523"
                  value={entranceRollNo}
                  onChange={(e) => setEntranceRollNo(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Section 5: Residential Address */}
          <section className="direct-app-section" aria-labelledby="section-address-title">
            <div className="direct-app-section-head">
              <div className="section-step-badge">5</div>
              <div>
                <h2 id="section-address-title">Permanent Residential Address</h2>
                <p>Address used for official correspondence and domicile verification.</p>
              </div>
            </div>

            <div className="direct-app-grid two-cols">
              <div className="form-field-group full-width">
                <label htmlFor="cand-address">Street Address / House No.</label>
                <input
                  id="cand-address"
                  type="text"
                  placeholder="e.g. Plot No. 14, Samarth Nagar"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div className="form-field-group">
                <label htmlFor="cand-city">
                  City / Town <span className="req">*</span>
                </label>
                <input
                  id="cand-city"
                  type="text"
                  placeholder="e.g. Chhatrapati Sambhajinagar"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                />
              </div>

              <div className="form-field-group">
                <label htmlFor="cand-state">State</label>
                <input
                  id="cand-state"
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                />
              </div>

              <div className="form-field-group">
                <label htmlFor="cand-pincode">Pincode</label>
                <input
                  id="cand-pincode"
                  type="text"
                  placeholder="e.g. 431003"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Section 6: Candidate Declaration */}
          <section className="direct-app-section" aria-labelledby="section-declaration-title">
            <div className="direct-app-section-head">
              <div className="section-step-badge">6</div>
              <div>
                <h2 id="section-declaration-title">Declaration &amp; Verification Consent</h2>
                <p>Read and confirm before final submission.</p>
              </div>
            </div>

            <label className="direct-app-checkbox-label">
              <input
                type="checkbox"
                checked={declarationAgreed}
                onChange={(e) => setDeclarationAgreed(e.target.checked)}
                required
              />
              <span className="checkbox-text">
                I hereby declare that all academic scores and personal details submitted in this application are accurate and true to the best of my knowledge. I understand that this submission initiates official scrutiny by the IICT Admissions Committee at MGM University, and provisional seat allocation is subject to original document verification and fee payment on the official university portal.
              </span>
            </label>
          </section>

          {/* Form Actions */}
          <div className="direct-app-actions-row">
            <button
              type="button"
              className="secondary-button"
              onClick={onBack}
              disabled={isSubmitting}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              <span>Cancel &amp; Return</span>
            </button>
            <button
              type="submit"
              className="primary-button direct-app-submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span>Submitting Application to Committee...</span>
              ) : (
                <>
                  <CheckCircle2 size={18} aria-hidden="true" />
                  <span>Submit Official Application for 2026–27</span>
                </>
              )}
            </button>
          </div>
        </form>
      </main>

      <Footer onStaff={onStaff} />
    </div>
  );
}
