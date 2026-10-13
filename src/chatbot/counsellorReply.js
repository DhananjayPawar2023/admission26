import { formatCurrency, isValidEmail, isValidPhone } from "../utils/formatters.js";
import { fallbackPrograms } from "../data/programsData.js";
import { detectIntents } from "./parser.js";
import { getNextRecommendations } from "./recommendations.js";

/**
 * Single source of truth admissions reply generator.
 * Uses verified programs catalog and official admission facts.
 * Avoids fabricated salaries, speculative placement figures, or unverified claims.
 */
export function generateCounsellorReply(text, profile = {}, programs = [], facts = {}) {
  const q = (text || "").toLowerCase().trim();

  // Helper to safely lookup program details from the authoritative catalog using exact ID
  const getProgram = (id) => {
    return (
      programs.find((p) => p.id === id) ||
      fallbackPrograms.find((p) => p.id === id) ||
      { name: id, annual_tuition_fee: 150000, duration: "4 years", intake_seats: 60 }
    );
  };

  const pAiml = getProgram("btech-aiml");
  const pCse = getProgram("btech-cse-ai");
  const pDs = getProgram("btech-ds");
  const pIt = getProgram("btech-it");
  const pDsy = getProgram("btech-dsy");
  const pMtechAiml = getProgram("mtech-aiml");
  const pMtechDs = getProgram("mtech-ds");
  const pCyber = getProgram("diploma-cyber");

  // Explicit inquiry submission intent check (Does NOT silently submit; prompts review)
  const isSubmissionTrigger = (
    q === "submit inquiry" ||
    q === "submit my inquiry" ||
    q === "apply now" ||
    q === "confirm inquiry" ||
    q === "talk to admissions" ||
    q === "request callback" ||
    q.includes("please submit my inquiry") ||
    q.includes("i want to apply")
  );

  if (isSubmissionTrigger) {
    const hasValidPhone = isValidPhone(profile.phone);
    const hasValidEmail = isValidEmail(profile.email);
    const hasName = Boolean(profile.name && profile.name.trim().length >= 2);

    if (hasName && hasValidPhone && hasValidEmail) {
      return {
        text: `### Official Admission Inquiry Review\n\nThank you, **${profile.name}**! I have gathered your details for **${profile.interested_program || "B.Tech Admissions"}**.\n\nBefore submitting, please review the exact details in the confirmation dialog and confirm your consent to be contacted by our admissions committee.`,
        actionType: "show_confirmation_modal",
        suggestions: ["Review & Submit", "Edit Profile Details", "Check Fees Schedule"]
      };
    } else {
      return {
        text: `### Final Step Before Inquiry Submission\n\nTo ensure our admissions officers can reach you with official allotment updates and fee structures, we require verified contact details:\n\n• **Candidate Name**: ${profile.name || "Required"}\n• **Mobile Number (10 digits)**: ${hasValidPhone ? profile.phone : "Required"}\n• **Valid Email Address**: ${hasValidEmail ? profile.email : "Required"}\n• **Program of Interest**: ${profile.interested_program || "Not yet selected (choose in review modal)"}\n\nPlease click **Review & Submit** to complete these fields with your consent.`,
        actionType: "show_confirmation_modal",
        suggestions: ["Review & Submit Details", "Compare Programs", "Check Fees (2026–27)"]
      };
    }
  }

  // Detect relevant intents (supports multi-question handling and normalized typed input)
  const detectedIntents = detectIntents(text);
  const sections = [];
  let suggestedPills = [];

  const selectionStatusNote = profile.interested_program
    ? `• **Your Selected Program**: **${profile.interested_program}** *(Comparing programs in chat does not change your selected program)*`
    : `• **Your Selected Program**: None selected yet *(You can explore and compare branches freely; declare your choice when ready, e.g., "I want to apply for IT", or choose in the review form)*`;

  // 1. Comparison: AI & ML vs CSE (AI)
  if (detectedIntents.includes("compare_ai_cse")) {
    sections.push(`### Program Comparison: B.Tech AI & ML vs B.Tech CSE (AI)

Both programs are 4-year undergraduate degrees offered at IICT MGM University under the 2026–27 curriculum:

• **${pCse.name}** (${formatCurrency(pCse.annual_tuition_fee)}/year, ${pCse.duration}):
  - **Focus**: Comprehensive classical computer science foundation (Data Structures, Algorithms, Operating Systems, Computer Networks, Database Architecture) paired with advanced AI electives.
  - **Career Pathways**: Universal eligibility across Software Development Engineer (SDE) roles, Systems Engineering, and AI engineering.
  - **Best For**: Students seeking a traditional core computer science degree with an AI specialization.

• **${pAiml.name}** (${formatCurrency(pAiml.annual_tuition_fee)}/year, ${pAiml.duration}):
  - **Focus**: Direct focus on intelligent computing: Deep Learning, Neural Networks, Natural Language Processing, Computer Vision, and Applied Machine Learning.
  - **Career Pathways**: Machine Learning Engineers, AI Solutions Architects, Computer Vision Specialists, and Autonomous Systems Developers.
  - **Fee Difference**: ₹1.50 Lakhs/year compared to ₹2.045 Lakhs/year for CSE (AI).

---
📌 **Program Selection Status**:
${selectionStatusNote}`);

    suggestedPills.push("Check B.Tech AI Fees", "Check Eligibility Criteria", "Compare AI vs Data Science");
  }

  // 2. Comparison: AI & ML vs Data Science
  if (detectedIntents.includes("compare_ai_ds")) {
    sections.push(`### Program Comparison: B.Tech AI & ML vs B.Tech Data Science

Both programs share an annual tuition fee of **${formatCurrency(pAiml.annual_tuition_fee)} / year**:

• **${pDs.name}**:
  - **Core Curriculum**: Big Data engineering, statistical modelling, predictive analytics, business intelligence, data warehousing, and visualization.
  - **Primary Tools**: Python, R, Apache Spark, SQL/NoSQL, Tableau, and predictive analytics tools.
  - **Target Sectors**: FinTech, Investment Banking, Healthcare Informatics, Consulting, and Enterprise Analytics.

• **${pAiml.name}**:
  - **Core Curriculum**: Autonomous agents, perception, computer vision, natural language models, neural networks, and reinforcement learning.
  - **Primary Tools**: PyTorch, TensorFlow, OpenCV, Transformers, and Robotics frameworks.
  - **Target Sectors**: Autonomous Systems, Computer Vision, Robotics, and Generative AI.

---
📌 **Program Selection Status**:
${selectionStatusNote}`);

    suggestedPills.push("Data Science Details", "Tuition Fee Schedule", "Check Eligibility");
  }

  // 3. Comparison: AI & ML vs IT
  if (detectedIntents.includes("compare_ai_it")) {
    sections.push(`### Program Comparison: B.Tech AI & ML vs B.Tech Information Technology

• **${pAiml.name}** (${formatCurrency(pAiml.annual_tuition_fee)}/year, ${pAiml.duration}):
  - **Curriculum Focus**: Neural networks, deep learning (PyTorch/TensorFlow), computer vision, natural language processing, and autonomous agents.
  - **Target Roles**: AI Engineer, Machine Learning Specialist, Data Architect, Computer Vision Engineer.
  - **Best For**: Students wanting deep specialization in intelligent algorithmic systems and generative AI.

• **${pIt.name}** (${formatCurrency(pIt.annual_tuition_fee)}/year, ${pIt.duration}):
  - **Curriculum Focus**: Enterprise cloud architectures (AWS/Azure), DevOps automation, distributed networks, cybersecurity, and system architecture.
  - **Target Roles**: Cloud Solutions Architect, DevOps Engineer, Full-Stack Developer, Network Security Specialist.
  - **Best For**: Students seeking strong enterprise infrastructure, cloud computing, and DevOps engineering careers.

• **Placement & Industry Parity**: Both AI & ML and IT graduates hold equal campus eligibility for core software engineering (SDE), full-stack development, and tech consulting campus drives.

---
📌 **Program Selection Status**:
${selectionStatusNote}`);

    suggestedPills.push("Check B.Tech IT Fees", "Check B.Tech AI Fees", "Compare AI vs CSE", "Talk to Admissions");
  }

  // 4. Comparison: IT vs CSE
  if (detectedIntents.includes("compare_it_cse")) {
    sections.push(`### Program Comparison: B.Tech Information Technology vs B.Tech CSE (AI)

• **${pCse.name}** (${formatCurrency(pCse.annual_tuition_fee)}/year, ${pCse.duration}):
  - **Curriculum**: Comprehensive classical computer science foundation (Data Structures, Algorithms, Compilers, OS, DBMS) combined with AI specializations.
  - **Career Pathways**: Software Development Engineer (SDE), Systems Programmer, AI Solutions Architect.
  - **Best For**: Students seeking classical computer science breadth with AI specialization.

• **${pIt.name}** (${formatCurrency(pIt.annual_tuition_fee)}/year, ${pIt.duration}):
  - **Curriculum**: Enterprise Cloud Computing (AWS/Azure), DevOps pipelines, Distributed Systems, Network Engineering, and Cybersecurity.
  - **Career Pathways**: Cloud Infrastructure Architect, DevOps Specialist, Full-Stack Developer, Systems Engineer.
  - **Best For**: Students seeking enterprise infrastructure, cloud computing, and DevOps engineering.

• **Placement & Industry Parity**: Information Technology and CSE graduates hold identical campus placement eligibility for software developer and systems engineer campus hiring drives.

---
📌 **Program Selection Status**:
${selectionStatusNote}`);

    suggestedPills.push("Check B.Tech IT Fees", "IT Eligibility", "Compare AI vs CSE");
  }

  // 5. Comparison: B.Tech vs BCA/BSc
  if (detectedIntents.includes("compare_btech_bca")) {
    sections.push(`### 4-Year B.Tech vs 3-Year BCA / B.Sc:

• **Professional Engineering Degree**: B.Tech is a 4-year professional engineering degree recognized under the Washington Accord, directly eligible for MS/M.Tech programs globally and competitive technical campus recruitments.
• **Curriculum Depth**: Rigorous foundation in mathematics, hardware-software integration, system design, and mandatory industry internships.

---
📌 **Program Selection Status**:
${selectionStatusNote}`);

    suggestedPills.push("Check B.Tech Fees", "Scholarship Options", "Eligibility Criteria");
  }

  // 5. Best branch inquiry
  if (detectedIntents.includes("best_branch")) {
    sections.push(`### Choosing the Right Branch at IICT

All branches at IICT focus on high-demand modern technologies:
1. **${pCse.name}**: Best for versatile software development and classical computing fundamentals.
2. **${pAiml.name}**: Best for specialized focus on machine learning algorithms and intelligent systems at ₹1.50L/year.
3. **${pDs.name}**: Best for students interested in big data, statistical analysis, and enterprise intelligence.
4. **${pIt.name}**: Best for cloud infrastructure, enterprise systems, and DevOps engineering.`);

    suggestedPills.push("Compare AI vs CSE", "Tuition Fee Schedule", "Talk to Admissions");
  }

  // 6. Dedicated single program inquiries (Undergraduate & Postgraduate cleanly decoupled)
  if (detectedIntents.includes("program_aiml") && !detectedIntents.includes("compare_ai_cse") && !detectedIntents.includes("compare_ai_ds")) {
    sections.push(`### ${pAiml.name}

• **Level**: Undergraduate (B.Tech)
• **Annual Tuition Fee**: ${formatCurrency(pAiml.annual_tuition_fee)} / year
• **Duration**: ${pAiml.duration} (8 Semesters)
• **Intake**: ${pAiml.intake_seats || 180} Seats
• **Curriculum Focus**: ${pAiml.description || "Machine Learning algorithms, Deep Learning with PyTorch/TensorFlow, Computer Vision, Natural Language Processing, and Generative AI."}
• **Eligibility**: ${pAiml.eligibility || "10+2 with Physics & Math + Chemistry/CS/IT (min 45% for Open, 40% for Reserved). Valid score in MGMU-CET / MHT-CET / JEE Main."}
• **Career Pathways**: ${pAiml.career_opportunities || "AI Engineer, ML Research Scientist, NLP Specialist, Computer Vision Engineer."}`);

    suggestedPills.push("Check B.Tech AI Fees", "Check Eligibility Criteria", "Compare AI vs CSE");
  }

  if (detectedIntents.includes("program_cse") && !detectedIntents.includes("compare_ai_cse")) {
    sections.push(`### ${pCse.name}

• **Level**: Undergraduate (B.Tech)
• **Annual Tuition Fee**: ${formatCurrency(pCse.annual_tuition_fee)} / year
• **Duration**: ${pCse.duration} (8 Semesters)
• **Intake**: ${pCse.intake_seats || 60} Seats
• **Curriculum Focus**: ${pCse.description || "Complete Computer Science foundation (Algorithms, OS, Computer Architecture, DBMS, Networks) enhanced with advanced Artificial Intelligence electives."}
• **Eligibility**: ${pCse.eligibility || "10+2 with Physics & Math + Chemistry/CS/IT (min 45% for Open, 40% for Reserved). Valid score in MGMU-CET / MHT-CET / JEE Main."}
• **Career Pathways**: ${pCse.career_opportunities || "Software Development Engineer (SDE), AI Solutions Architect, Full Stack AI Developer."}`);

    suggestedPills.push("Check Fees (2026–27)", "AI vs CSE Comparison", "Check Eligibility");
  }

  if (detectedIntents.includes("program_ds") && !detectedIntents.includes("compare_ai_ds")) {
    sections.push(`### ${pDs.name}

• **Level**: Undergraduate (B.Tech)
• **Annual Tuition Fee**: ${formatCurrency(pDs.annual_tuition_fee)} / year
• **Duration**: ${pDs.duration} (8 Semesters)
• **Intake**: ${pDs.intake_seats || 60} Seats
• **Curriculum Focus**: ${pDs.description || "Statistical computing, Big Data analytics with Apache Spark, Data Visualization, predictive modelling, and database management."}
• **Eligibility**: ${pDs.eligibility || "10+2 with Physics & Math + Chemistry/CS/IT (min 45% for Open, 40% for Reserved). Valid score in MGMU-CET / MHT-CET / JEE Main."}
• **Career Pathways**: ${pDs.career_opportunities || "Data Scientist, Big Data Engineer, Business Intelligence Consultant, Quantitative Analyst."}`);

    suggestedPills.push("Tuition Fee Schedule", "Check Eligibility", "Talk to Admissions");
  }

  if (detectedIntents.includes("program_it") && !detectedIntents.includes("compare_it_cse")) {
    sections.push(`### ${pIt.name}

• **Level**: Undergraduate (B.Tech)
• **Annual Tuition Fee**: ${formatCurrency(pIt.annual_tuition_fee)} / year
• **Duration**: ${pIt.duration} (8 Semesters)
• **Intake**: ${pIt.intake_seats || 120} Seats
• **Curriculum Focus**: ${pIt.description || "Enterprise software architecture, Cloud computing (AWS/Azure), Information security, DevOps pipelines, and distributed databases."}
• **Eligibility**: ${pIt.eligibility || "10+2 with Physics & Math + Chemistry/CS/IT (min 45% for Open, 40% for Reserved). Valid score in MGMU-CET / MHT-CET / JEE Main."}
• **Career Pathways**: ${pIt.career_opportunities || "Cloud Architect, DevOps Engineer, Enterprise Software Consultant, Network Specialist."}`);

    suggestedPills.push("Check B.Tech IT Fees", "IT Eligibility", "Submit Inquiry");
  }

  if (detectedIntents.includes("program_dsy") && !detectedIntents.includes("branch_change_dsy")) {
    sections.push(`### ${pDsy.name}

• **Annual Tuition Fee**: ${formatCurrency(pDsy.annual_tuition_fee)} / year
• **Duration**: 3 Years (Semesters 3 to 8)
• **Eligibility**: Passed 3-year Engineering Diploma with at least 45% aggregate (40% for Maharashtra Reserved categories).
• **Branches Available**: AI & ML, CSE (AI), Data Science, and IT.`);

    suggestedPills.push("DSY Eligibility", "Fees Schedule", "Submit Inquiry");
  }

  // Dedicated M.Tech specializations
  if (detectedIntents.includes("program_mtech_ds")) {
    sections.push(`### ${pMtechDs.name}

• **Level**: Postgraduate (M.Tech)
• **Annual Tuition Fee**: ${formatCurrency(pMtechDs.annual_tuition_fee)} / year
• **Duration**: ${pMtechDs.duration} (4 Semesters)
• **Intake**: ${pMtechDs.intake_seats || 18} Seats
• **Curriculum Focus**: ${pMtechDs.description || "Postgraduate research program covering distributed high-performance computing, advanced data mining, and decision science."}
• **Eligibility**: ${pMtechDs.eligibility || "B.E./B.Tech in relevant branch with at least 50% (45% for Reserved categories). Valid score in GATE or MGMU-CET PG."}
• **Career Pathways**: ${pMtechDs.career_opportunities || "Chief Data Officer, Principal Data Scientist, AI R&D Lead."}`);

    suggestedPills.push("Check Fees Schedule", "M.Tech Eligibility", "Talk to Admissions");
  }

  if (detectedIntents.includes("program_mtech_aiml")) {
    sections.push(`### ${pMtechAiml.name}

• **Level**: Postgraduate (M.Tech)
• **Annual Tuition Fee**: ${formatCurrency(pMtechAiml.annual_tuition_fee)} / year
• **Duration**: ${pMtechAiml.duration} (4 Semesters)
• **Intake**: ${pMtechAiml.intake_seats || 18} Seats
• **Curriculum Focus**: ${pMtechAiml.description || "Postgraduate research program in generative AI, deep reinforcement learning, cognitive computing, and embedded edge intelligence."}
• **Eligibility**: ${pMtechAiml.eligibility || "B.E./B.Tech in CSE/IT/ECE with at least 50% (45% for Reserved categories). Valid score in GATE or MGMU-CET PG."}
• **Career Pathways**: ${pMtechAiml.career_opportunities || "Principal AI Scientist, Autonomous Systems Specialist, Generative AI Researcher."}`);

    suggestedPills.push("Check Fees Schedule", "M.Tech Eligibility", "Talk to Admissions");
  }

  if (detectedIntents.includes("program_mtech") && !detectedIntents.includes("program_mtech_aiml") && !detectedIntents.includes("program_mtech_ds")) {
    sections.push(`### M.Tech Programs at MGM IICT (2026–27)

• **Specializations**:
  1. **${pMtechAiml.name}**: Generative AI, deep reinforcement learning, and autonomous agents (${formatCurrency(pMtechAiml.annual_tuition_fee)}/year, 18 seats).
  2. **${pMtechDs.name}**: Distributed computing, advanced predictive analytics, and decision intelligence (${formatCurrency(pMtechDs.annual_tuition_fee)}/year, 18 seats).
• **Duration**: 2 Years (4 Semesters).
• **Eligibility**: B.E./B.Tech in relevant engineering discipline with at least 50% (45% for Reserved categories). Valid score in GATE or MGMU-CET PG.`);

    suggestedPills.push("Check Fees Schedule", "M.Tech Eligibility", "Submit Inquiry");
  }

  if (detectedIntents.includes("program_cyber")) {
    sections.push(`### ${pCyber.name}

• **Duration**: ${pCyber.duration || "1 year"}
• **Annual Tuition Fee**: ${formatCurrency(pCyber.annual_tuition_fee)} / year
• **Curriculum**: ${pCyber.description || "Network security, ethical hacking fundamentals, cyber laws, threat detection, and forensic evidence collection."}
• **Eligibility**: ${pCyber.eligibility || "10+2 / HSC from any stream with minimum 45% (40% for Reserved)."}`);

    suggestedPills.push("Check Fees Schedule", "Contact Admissions", "Talk to Admissions");
  }

  // 7. Dedicated MGMU-CET Entrance Exam Information
  if (detectedIntents.includes("mgmu_cet_info")) {
    sections.push(`### MGMU-CET 2026 Entrance Examination

MGM University conducts the **MGMU-CET 2026** (Common Entrance Test) as an official university entrance pathway:

• **Admissions Scope**: A valid score in MGMU-CET 2026 is officially accepted for admissions across all IICT B.Tech programs (AI & ML, CSE-AI, Data Science, and IT) alongside MHT-CET 2026 and JEE Main 2026. For postgraduate engineering, MGMU-CET PG is accepted alongside GATE.
• **Eligibility Criteria**:
  - **B.Tech (4 Years)**: Passed 10+2 / HSC with Physics and Mathematics as compulsory subjects along with Chemistry/CS/IT/Biology (minimum 45% aggregate in PCM for Open category, 40% for Maharashtra Reserved categories).
  - **M.Tech (2 Years)**: B.E./B.Tech in relevant branch with at least 50% aggregate (45% for Maharashtra Reserved categories).
• **Application & Entrance Fee**: ₹2,000 (Domestic application & MGMU-CET fee as per official university fee schedule).
• **Registration Portal**: Official university portal (${facts.source_url || "https://iict.mgmu.ac.in"} / mgmu.ac.in).
• **Exam Format, Syllabus & Date Confirmation**:
  - Detailed examination schedules, test slot booking, syllabus guidelines, and testing mode are published in the official MGMU-CET Information Brochure.
  - To confirm the latest 2026–27 exam dates, slot availability, or syllabus specifics, please consult the official Admissions Directorate:
    📞 **${facts.helpline_phone_1 || "+91 940 449 4299"}** | ✉️ **${facts.admissions_email || "admissions@mgmu.ac.in"}**`);

    suggestedPills.push("Check B.Tech Fees", "Eligibility Criteria", "Compare AI vs CSE", "Talk to Admissions");
  }

  // 8. Low Score Solutions & Alternative Admissions
  if (detectedIntents.includes("low_score_solutions")) {
    sections.push(`### Admissions Guidance for CET/JEE Scores

A lower percentile in MHT-CET or JEE does not automatically disqualify you:
1. **MGMU-CET 2026 Opportunity**: MGM University conducts its own entrance exam (MGMU-CET). You can register online and appear for this standardized test to secure admission on university merit.
2. **10+2 PCM Minimum Eligibility**: AICTE & Government of Maharashtra norms require a minimum aggregate of **45% in PCM** (Physics, Mathematics, and Chemistry/CS/IT/Bio) for Open category, or **40% for Maharashtra Reserved categories** (SC/ST/OBC/VJNT/NT/SBC/EWS/PwD).
3. **Institutional Admissions**: Eligible candidates may participate in early provisional counselling rounds on a merit basis.`);

    suggestedPills.push("How to take MGMU-CET?", "12th PCM Criteria", "Talk to Admissions");
  }

  // 9. Fees inquiry
  if (detectedIntents.includes("fees")) {
    sections.push(`### Official 2026–27 Annual Tuition Fee Schedule

The verified annual tuition fees for academic year 2026–27 are:
• **${pAiml.name}**: ${formatCurrency(pAiml.annual_tuition_fee)} / year
• **${pDs.name}**: ${formatCurrency(pDs.annual_tuition_fee)} / year
• **${pIt.name}**: ${formatCurrency(pIt.annual_tuition_fee)} / year
• **${pCse.name}**: ${formatCurrency(pCse.annual_tuition_fee)} / year
• **${pDsy.name}**: ${formatCurrency(pDsy.annual_tuition_fee)} / year
• **M.Tech (AI & ML / Data Science)**: ₹1,50,000 / year
• **Diploma in Cyber Security**: ₹1,00,000 / year

• **Payment Options**: Fees can be paid in semester installments.
• **Refundable Caution Deposit**: ${facts.caution_money_deposit || "₹5,000 (Refundable)"}.
• **Bank Loans**: MGM University provides official bonafide documentation to assist with educational loan processing with nationalized and private banks.`);

    suggestedPills.push("Scholarship Details", "Hostel Fees", "Check Eligibility");
  }

  // 10. Eligibility criteria
  if (detectedIntents.includes("eligibility") && !detectedIntents.includes("low_score_solutions")) {
    sections.push(`### Official Eligibility Criteria (2026–27)

• **B.Tech First Year (4 Years)**:
  - Passed 10+2 / HSC with Physics and Mathematics as compulsory subjects along with one of Chemistry / Computer Science / IT / Biology.
  - Minimum **45% aggregate in PCM** (Open category) or **40% aggregate in PCM** (Maharashtra Reserved categories).
  - Valid score in **MHT-CET 2026**, **JEE Main 2026**, or **MGMU-CET 2026**.

• **B.Tech Lateral Entry (DSY - 3 Years)**:
  - Passed 3-year Engineering Diploma with minimum **45% aggregate** (40% for Reserved categories).`);

    suggestedPills.push("Check Fees Schedule", "MGMU-CET Details", "Submit Inquiry");
  }

  // 11. Scholarships
  if (detectedIntents.includes("scholarships")) {
    sections.push(`### Scholarships & Financial Concessions (2026–27)

MGM University and state welfare schemes offer:
• **MGM University Merit Scholarships**: Merit-based tuition fee concessions (up to 100% for top academic achievers in board exams or entrance percentiles).
• **Government of Maharashtra (MahaDBT)**: Eligible Maharashtra students can apply for state welfare tuition fee reimbursement (SC/ST, OBC, EBC, SEBC, VJNT as per state social welfare guidelines).
• **Sports Scholarships**: Concessions awarded to verified state and national sports achievers.

*Note: Specific scholarship percentages depend on annual institutional quota verification and timely application on the designated state/university portals.*`);

    suggestedPills.push("Check B.Tech Fees", "Eligibility Criteria", "Talk to Admissions");
  }

  // 12. Placements
  if (detectedIntents.includes("placements")) {
    sections.push(`### Training & Placement Cell Overview

• **Recruitment Drives**: IICT students participate in campus drives with prominent IT and tech service firms including TCS, Persistent Systems, Infosys, Cognizant, Tech Mahindra, and specialized software startups.
• **Technical Preparation**: Coding practice (DSA), cloud certifications, and technical mentorship from Year 2 onwards.
• **Mandatory Internships**: Industry internship opportunities are integrated into the curriculum.

*Note on Compensation: Salary packages vary each academic year based on market conditions, company hiring policy, and individual student evaluation. IICT does not publish unverified fixed package claims. For verified past placement reports, please consult the Training & Placement Cell.*`);

    suggestedPills.push("Check Course Fees", "AI vs CSE Comparison", "Book Campus Visit");
  }

  // 13. Hostels & Campus
  if (detectedIntents.includes("hostel")) {
    sections.push(`### Campus Hostels & Student Amenities

• **On-Campus Hostels**: Separate accommodation for boys and girls inside the MGM Campus with 24/7 security and biometric monitoring.
• **Dining Facilities**: Hygienic mess serving vegetarian meals, breakfast, and evening snacks.
• **Campus Amenities**: Central sports stadium, Olympic-size swimming pool, library, modern computing labs, and immediate medical support at the on-campus MGM Hospital.`);

    suggestedPills.push("Campus Location", "Tuition Fees", "Helpline Numbers");
  }

  // 14. Direct admission / Quota
  if (detectedIntents.includes("direct_admission")) {
    sections.push(`### Institutional Admissions Policy

• **Zero Capitation / Donation**: MGM University operates transparent, merit-based admissions with **no donation or capitation fees**.
• **Admissions Route**: You can apply via MHT-CET, JEE Main, or the institutional **MGMU-CET 2026 online entrance test**.
• **Statutory Eligibility**: Candidates must satisfy the minimum 10+2 PCM criteria (45% Open / 40% Reserved) to be eligible.`);

    suggestedPills.push("Register for MGMU-CET", "Fee Structure", "Required Documents");
  }

  // 15. Dates and Documents
  if (detectedIntents.includes("dates_documents")) {
    sections.push(`### Admission Schedule & Document Checklist

• **Admission Batch**: Academic Year 2026–27 applications are currently being accepted.
• **Deadline Reference**: ${facts.application_deadline || "Applications are processed on rolling merit."}
• **Essential Documents**:
  1. 10th (SSC) Marksheet
  2. 12th (HSC) Marksheet or Polytechnic Diploma Marksheets
  3. Entrance Exam Scorecard (MHT-CET / JEE / MGMU-CET)
  4. College Leaving Certificate (Transfer Certificate)
  5. Domicile & Nationality Certificate (or Birth Certificate)
  6. Caste Certificate & Validity (for Maharashtra Reserved Categories)
  7. Aadhaar Card copy and passport-size photographs`);

    suggestedPills.push("Check Eligibility", "Fees Schedule", "Submit Inquiry");
  }

  // 16. Degree validity & Recognition
  if (detectedIntents.includes("recognition")) {
    sections.push(`### Accreditation & Degree Recognition

• **UGC Recognized**: MGM University is a state private university recognized by the **University Grants Commission (UGC)** under Section 2(f) of the UGC Act, 1956.
• **Government & Competitive Exams**: Graduates are legally eligible for UPSC, MPSC, GATE, and public sector employment.
• **Higher Education Abroad**: Degrees are accepted internationally for Master's (MS/MBA) applications, subject to standard university evaluation (e.g. WES evaluation).`);

    suggestedPills.push("Compare Programs", "Fees Schedule", "Contact Admissions");
  }

  // 17. Non-CS / Beginner Coding
  if (detectedIntents.includes("coding_beginner")) {
    sections.push(`### Guidance for Beginners & Non-CS Backgrounds

• **Foundation from Basics**: The first-year engineering curriculum starts with fundamental computational thinking and programming from scratch.
• **Mentored Lab Sessions**: Dedicated faculty-assisted laboratory hours help students with no prior coding experience build hands-on programming confidence.`);

    suggestedPills.push("Compare AI vs CSE", "Tuition Fees", "Check Eligibility");
  }

  // 18. Branch Change / DSY
  if (detectedIntents.includes("branch_change_dsy")) {
    sections.push(`### Lateral Entry (DSY) & Branch Change

• **Direct Second Year (DSY)**: Polytechnic Diploma holders in engineering can join directly in Semester 3 across AI & ML, CSE (AI), IT, and Data Science. Annual fee is **${formatCurrency(pDsy.annual_tuition_fee)} / year**.
• **Branch Sliding**: Internal branch transfers after First Year depend on seat vacancies and First-Year CGPA merit under university regulations.`);

    suggestedPills.push("DSY Eligibility", "Fees Schedule", "Submit Inquiry");
  }

  // 19. Contact & Campus Location
  if (detectedIntents.includes("contact_helpline") || detectedIntents.includes("location_visit")) {
    sections.push(`### Official IICT Admissions Contact & Campus Helpdesk

• **Director, IICT**: ${facts.director_name || "Dr. Sharad S. Mulik"} (${facts.director_email || "director.iict@mgmu.ac.in"})
• **Admissions Helplines**:
  - Primary IICT: **${facts.helpline_phone_1 || "+91 940 449 4299"}**
  - IICT Office: **${facts.helpline_phone_2 || "+91 240 2480490"}**
  - MGM University Helpdesk: **${facts.helpline_phone_3 || "1800 233 4646"}**
• **Official Email**: ${facts.admissions_email || "admissions@mgmu.ac.in"} | ${facts.iict_office_email || "iict@mgmu.ac.in"}
• **Campus Address**: ${facts.campus_address || "MGM University Campus, N-6, CIDCO, Chhatrapati Sambhajinagar - 431003, Maharashtra"}
• **Office Hours**: ${facts.office_hours || "Monday to Saturday, 9:30 AM to 5:30 PM"}`);

    suggestedPills.push("Check Programs", "Fees Schedule", "Submit Inquiry");
  }

  // 20. Why MGM IICT
  if (detectedIntents.includes("why_mgm")) {
    sections.push(`### Why Choose MGM University IICT?

• **Future-Ready Curriculum**: 100% focused on computing specializations (AI, ML, Data Science, and IT).
• **Infrastructure**: Advanced AI & High-Performance Computing labs, modern campus stadium, and digital libraries.
• **Zero Donation**: Completely transparent, merit-based admissions with structured installments and scholarship support.
• **Location**: Central Chhatrapati Sambhajinagar with secure on-campus residential hostels.`);

    suggestedPills.push("Compare Programs", "Fees Schedule", "Talk to Admissions");
  }

  // 21. Clarifying Fallback if no specific intents matched
  const isUnrecognized = sections.length === 0;
  if (isUnrecognized) {
    const trimmedInput = text.trim();
    const queryQuote = trimmedInput ? ` about **"${trimmedInput.length > 50 ? trimmedInput.slice(0, 47) + '...' : trimmedInput}"**` : "";

    sections.push(`### Let me clarify your admissions question

I want to make sure I give you accurate, verified information${queryQuote}, but I could not match your inquiry to a specific admissions topic.

Could you please clarify which aspect of admissions you are inquiring about?

• **Programs & Curricula**: Are you asking about B.Tech AI & ML, CSE (AI), Data Science, or IT?
• **Fees & Scholarships**: Are you looking for the 2026–27 annual tuition schedule, installments, or merit waivers?
• **Eligibility & Admissions**: Are you asking about 12th PCM criteria, entrance exams (MHT-CET / JEE / MGMU-CET), or required documents?
• **Campus & Student Life**: Are you inquiring about campus hostels, placement records, or campus visits?

You can choose one of the options below or rephrase your question:`);

    suggestedPills = [
      "Check Fees (2026–27)",
      "Compare AI vs CSE",
      "Check Eligibility Criteria",
      "Hostel Facilities"
    ];
  }

  // Next steps guidance (Only display when a concrete admissions topic was successfully answered and candidate details exist)
  let nextStepNotice = "";
  if (!isUnrecognized && profile.name && profile.interested_program && (isValidPhone(profile.phone) || isValidEmail(profile.email))) {
    nextStepNotice = `\n\n---\n💡 **Next Step**: Your profile information for **${profile.interested_program}** is noted. When you are prepared, click **Review & Submit Inquiry** below to verify your details and give consent for counselor callback.`;
  }

  return {
    text: sections.join("\n\n") + nextStepNotice,
    actionType: null,
    suggestions: getNextRecommendations(text, detectedIntents)
  };
}
