import test from "node:test";
import assert from "node:assert/strict";
import { generateCounsellorReply } from "../src/chatbot/counsellorReply.js";
import { fallbackPrograms, fallbackFacts } from "../src/data/programsData.js";

test("counsellorReply: pulls authoritative fee from programs catalog", () => {
  const reply = generateCounsellorReply("What is the fee for AI & ML?", {}, fallbackPrograms, fallbackFacts);
  assert.ok(reply.text.includes("₹1,50,000"));
  assert.ok(reply.text.includes("B.Tech in Artificial Intelligence & Machine Learning"));
});

test("counsellorReply: does not state unverified fixed salary package guarantees", () => {
  const reply = generateCounsellorReply("Tell me about placements", {}, fallbackPrograms, fallbackFacts);
  assert.ok(reply.text.includes("Training & Placement Cell"));
  assert.ok(reply.text.includes("Salary packages vary each academic year"));
});

test("counsellorReply: generic 'yes' does NOT trigger silent auto-submission", () => {
  const profile = {
    name: "Rohan Patil",
    phone: "9822334455",
    email: "rohan@gmail.com",
    interested_program: "B.Tech in Artificial Intelligence & Machine Learning"
  };

  const reply = generateCounsellorReply("yes", profile, fallbackPrograms, fallbackFacts);
  assert.notEqual(reply.actionType, "submit_now");
});

test("counsellorReply: explicit submission intent prompts confirmation review modal", () => {
  const profile = {
    name: "Rohan Patil",
    phone: "9822334455",
    email: "rohan@gmail.com",
    interested_program: "B.Tech in Artificial Intelligence & Machine Learning"
  };

  const reply = generateCounsellorReply("submit inquiry", profile, fallbackPrograms, fallbackFacts);
  assert.equal(reply.actionType, "show_confirmation_modal");
  assert.ok(reply.text.includes("Review"));
});

test("Parity: Suggested buttons and typed variations yield the same intent response", () => {
  // 1. AI vs CSE comparison
  const sugComparison = generateCounsellorReply("AI & ML vs CSE (AI)", {}, fallbackPrograms, fallbackFacts);
  const typedComp1 = generateCounsellorReply("ai vs cse", {}, fallbackPrograms, fallbackFacts);
  const typedComp2 = generateCounsellorReply("difference between ai and cse", {}, fallbackPrograms, fallbackFacts);
  const typedComp3 = generateCounsellorReply("which is better ai or cse?", {}, fallbackPrograms, fallbackFacts);

  assert.ok(sugComparison.text.includes("Program Comparison: B.Tech AI & ML vs B.Tech CSE (AI)"));
  assert.ok(typedComp1.text.includes("Program Comparison: B.Tech AI & ML vs B.Tech CSE (AI)"));
  assert.ok(typedComp2.text.includes("Program Comparison: B.Tech AI & ML vs B.Tech CSE (AI)"));
  assert.ok(typedComp3.text.includes("Program Comparison: B.Tech AI & ML vs B.Tech CSE (AI)"));

  // 2. Fees schedule
  const sugFees = generateCounsellorReply("Check Fees (2026–27)", {}, fallbackPrograms, fallbackFacts);
  const typedFees1 = generateCounsellorReply("what are the fees?", {}, fallbackPrograms, fallbackFacts);
  const typedFees2 = generateCounsellorReply("fee structure", {}, fallbackPrograms, fallbackFacts);
  const typedFees3 = generateCounsellorReply("how much does it cost?", {}, fallbackPrograms, fallbackFacts);

  assert.ok(sugFees.text.includes("Official 2026–27 Annual Tuition Fee Schedule"));
  assert.ok(typedFees1.text.includes("Official 2026–27 Annual Tuition Fee Schedule"));
  assert.ok(typedFees2.text.includes("Official 2026–27 Annual Tuition Fee Schedule"));
  assert.ok(typedFees3.text.includes("Official 2026–27 Annual Tuition Fee Schedule"));

  // 3. Low CET scores
  const sugLowCet = generateCounsellorReply("Low CET Score Options", {}, fallbackPrograms, fallbackFacts);
  const typedLowCet1 = generateCounsellorReply("can i get admission with less marks in cet?", {}, fallbackPrograms, fallbackFacts);
  const typedLowCet2 = generateCounsellorReply("i got low percentile in cet", {}, fallbackPrograms, fallbackFacts);

  assert.ok(sugLowCet.text.includes("Admissions Guidance for CET/JEE Scores"));
  assert.ok(typedLowCet1.text.includes("Admissions Guidance for CET/JEE Scores"));
  assert.ok(typedLowCet2.text.includes("Admissions Guidance for CET/JEE Scores"));

  // 4. Eligibility criteria
  const sugElig = generateCounsellorReply("Check Eligibility Criteria", {}, fallbackPrograms, fallbackFacts);
  const typedElig1 = generateCounsellorReply("what is the eligibility?", {}, fallbackPrograms, fallbackFacts);
  const typedElig2 = generateCounsellorReply("pcm criteria", {}, fallbackPrograms, fallbackFacts);

  assert.ok(sugElig.text.includes("Official Eligibility Criteria (2026–27)"));
  assert.ok(typedElig1.text.includes("Official Eligibility Criteria (2026–27)"));
  assert.ok(typedElig2.text.includes("Official Eligibility Criteria (2026–27)"));
});

test("MGMU-CET: Distinguishes exam information from low-score solutions", () => {
  // Query 1: Exam pattern query
  const examReply = generateCounsellorReply("What is the MGMU-CET exam pattern?", {}, fallbackPrograms, fallbackFacts);
  assert.ok(examReply.text.includes("MGMU-CET 2026 Entrance Examination"));
  assert.ok(examReply.text.includes("MGM University conducts the **MGMU-CET 2026**"));
  assert.ok(examReply.text.includes("₹2,000"));
  assert.ok(examReply.text.includes("Admissions Directorate"));
  // Must NOT include the low score guidance message
  assert.ok(!examReply.text.includes("A lower percentile in MHT-CET or JEE does not automatically disqualify you"));

  // Query 2: Low score query
  const lowScoreReply = generateCounsellorReply("I got a low score in CET; can I still apply?", {}, fallbackPrograms, fallbackFacts);
  assert.ok(lowScoreReply.text.includes("Admissions Guidance for CET/JEE Scores"));
  assert.ok(lowScoreReply.text.includes("45% in PCM"));
  // Must NOT include standalone exam overview
  assert.ok(!lowScoreReply.text.includes("MGM University conducts the **MGMU-CET 2026**"));
});

test("Degree Level & Specialization: Distinguishes M.Tech Data Science from B.Tech Data Science", () => {
  // Query 1: M.Tech Data Science
  const mtechDsReply = generateCounsellorReply("Tell me about M.Tech Data Science", {}, fallbackPrograms, fallbackFacts);
  assert.ok(mtechDsReply.text.includes("M.Tech in Data Science"));
  assert.ok(mtechDsReply.text.includes("Postgraduate (M.Tech)"));
  assert.ok(mtechDsReply.text.includes("4 Semesters"));
  assert.ok(mtechDsReply.text.includes("GATE / MGMU-CET PG"));
  // Must NOT include B.Tech in Data Science section
  assert.ok(!mtechDsReply.text.includes("Undergraduate (B.Tech)"));
  assert.ok(!mtechDsReply.text.includes("8 Semesters"));

  // Query 2: B.Tech Data Science
  const btechDsReply = generateCounsellorReply("Tell me about B.Tech Data Science", {}, fallbackPrograms, fallbackFacts);
  assert.ok(btechDsReply.text.includes("B.Tech in Data Science"));
  assert.ok(btechDsReply.text.includes("Undergraduate (B.Tech)"));
  assert.ok(btechDsReply.text.includes("8 Semesters"));
  assert.ok(btechDsReply.text.includes("60 Seats"));
  // Must NOT include M.Tech section
  assert.ok(!btechDsReply.text.includes("Postgraduate (M.Tech)"));
  assert.ok(!btechDsReply.text.includes("GATE / MGMU-CET PG"));

  // Query 3: M.Tech AI
  const mtechAiReply = generateCounsellorReply("Tell me about M.Tech AI", {}, fallbackPrograms, fallbackFacts);
  assert.ok(mtechAiReply.text.includes("M.Tech in Artificial Intelligence"));
  assert.ok(mtechAiReply.text.includes("Postgraduate (M.Tech)"));
  assert.ok(!mtechAiReply.text.includes("Undergraduate (B.Tech)"));
});

test("Single program inquiries: handles specific program requests accurately", () => {
  const replyDs = generateCounsellorReply("Tell me about B.Tech in Data Science", {}, fallbackPrograms, fallbackFacts);
  assert.ok(replyDs.text.includes("B.Tech in Data Science"));
  assert.ok(replyDs.text.includes("Big data engineering") || replyDs.text.includes("statistical modelling"));

  const replyIt = generateCounsellorReply("Tell me about Information Technology", {}, fallbackPrograms, fallbackFacts);
  assert.ok(replyIt.text.includes("B.Tech in Information Technology"));
  assert.ok(replyIt.text.includes("Cloud computing"));
});

test("counsellorReply: multi-intent queries address all questions", () => {
  const reply1 = generateCounsellorReply(
    "What are the fees for AI & ML, and what are the hostel facilities?",
    {},
    fallbackPrograms,
    fallbackFacts
  );
  assert.ok(reply1.text.includes("Fee Schedule"));
  assert.ok(reply1.text.includes("Campus Hostels & Student Amenities"));

  const reply2 = generateCounsellorReply(
    "What is the eligibility for B.Tech and are there any scholarships?",
    {},
    fallbackPrograms,
    fallbackFacts
  );
  assert.ok(reply2.text.includes("Official Eligibility Criteria"));
  assert.ok(reply2.text.includes("Scholarships & Financial Concessions"));
});

test("Unrecognized queries: asks clarifying question and does NOT repeat previous answer", () => {
  const profile = { name: "Rohan", interested_program: "B.Tech in AI & ML" };
  const reply = generateCounsellorReply(
    "What is the weather today?",
    profile,
    fallbackPrograms,
    fallbackFacts
  );

  // Must ask clarification quoting the user question
  assert.ok(reply.text.includes("Let me clarify your admissions question"));
  assert.ok(reply.text.includes("What is the weather today?"));
  // Must NOT repeat unrelated fee schedule or welcome monologue
  assert.ok(!reply.text.includes("Official 2026–27 Annual Tuition Fee Schedule"));
  assert.ok(!reply.text.includes("I am your automated IICT Admissions Advisor"));
});

test("Sequential messages: reply addresses the latest message and not prior topics", () => {
  // Turn 1: Ask fees
  const turn1 = generateCounsellorReply("What are the fees?", {}, fallbackPrograms, fallbackFacts);
  assert.ok(turn1.text.includes("Official 2026–27 Annual Tuition Fee Schedule"));
  assert.ok(!turn1.text.includes("Campus Hostels"));

  // Turn 2: Follow-up asking hostels
  const turn2 = generateCounsellorReply("What about hostel facilities?", {}, fallbackPrograms, fallbackFacts);
  assert.ok(turn2.text.includes("Campus Hostels & Student Amenities"));
  assert.ok(!turn2.text.includes("Official 2026–27 Annual Tuition Fee Schedule"));

  // Turn 3: Follow-up asking UGC recognition
  const turn3 = generateCounsellorReply("Is the degree UGC approved?", {}, fallbackPrograms, fallbackFacts);
  assert.ok(turn3.text.includes("UGC Recognized"));
  assert.ok(!turn3.text.includes("Campus Hostels"));
});

test("Comparison answers: shows compared programs and applicant's selected program separately", () => {
  // Case A: With an already selected program
  const profileWithProgram = {
    name: "Sneha Deshmukh",
    interested_program: "B.Tech in Artificial Intelligence & Machine Learning"
  };

  const replyWithSelected = generateCounsellorReply(
    "compare AI & ML and IT",
    profileWithProgram,
    fallbackPrograms,
    fallbackFacts
  );

  // Both compared programs are shown with curricula & pathways
  assert.ok(replyWithSelected.text.includes("Program Comparison: B.Tech AI & ML vs B.Tech Information Technology"));
  assert.ok(replyWithSelected.text.includes("B.Tech in Artificial Intelligence & Machine Learning"));
  assert.ok(replyWithSelected.text.includes("B.Tech in Information Technology"));

  // The student's already selected program is shown distinctly in the selection status block
  assert.ok(replyWithSelected.text.includes("Your Selected Program"));
  assert.ok(replyWithSelected.text.includes("B.Tech in Artificial Intelligence & Machine Learning"));
  assert.ok(replyWithSelected.text.includes("Comparing programs in chat does not change your selected program"));

  // Case B: With no selected program yet
  const profileWithoutProgram = {
    name: "Rohan",
    interested_program: ""
  };

  const replyWithoutSelected = generateCounsellorReply(
    "AI & ML vs IT",
    profileWithoutProgram,
    fallbackPrograms,
    fallbackFacts
  );

  assert.ok(replyWithoutSelected.text.includes("Program Comparison: B.Tech AI & ML vs B.Tech Information Technology"));
  assert.ok(replyWithoutSelected.text.includes("None selected yet"));

  // Case C: 'Which is better, AI & ML or IT?' variation
  const replyWhichBetter = generateCounsellorReply(
    "Which is better, AI & ML or IT?",
    profileWithoutProgram,
    fallbackPrograms,
    fallbackFacts
  );
  assert.ok(replyWhichBetter.text.includes("Program Comparison: B.Tech AI & ML vs B.Tech Information Technology"));
});
