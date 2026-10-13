import test from "node:test";
import assert from "node:assert/strict";
import { parseProfileUpdates, detectIntents, normalizeText } from "../src/chatbot/parser.js";

test("Name parsing: extracts valid explicit self-introductions", () => {
  const res1 = parseProfileUpdates("My name is Rohan Patil", {});
  assert.equal(res1.name, "Rohan Patil");

  const res2 = parseProfileUpdates("I am Priya Sharma", {});
  assert.equal(res2.name, "Priya Sharma");

  const res3 = parseProfileUpdates("Myself Amit Kulkarni", {});
  assert.equal(res3.name, "Amit Kulkarni");
});

test("Name parsing: does NOT interpret ordinary questions or statements as names", () => {
  const ordinary1 = parseProfileUpdates("Good morning, can you help me?", {});
  assert.equal(ordinary1.name, undefined);

  const ordinary2 = parseProfileUpdates("I am interested in AI branch", {});
  assert.equal(ordinary2.name, undefined);

  const ordinary3 = parseProfileUpdates("I am a 12th pass student", {});
  assert.equal(ordinary3.name, undefined);

  const ordinary4 = parseProfileUpdates("Tell me about fees", {});
  assert.equal(ordinary4.name, undefined);

  const ordinary5 = parseProfileUpdates("Which branch is better?", {});
  assert.equal(ordinary5.name, undefined);

  const ordinary6 = parseProfileUpdates("Direct second year", {});
  assert.equal(ordinary6.name, undefined);

  const ordinary7 = parseProfileUpdates("I am confused about which branch to choose?", {});
  assert.equal(ordinary7.name, undefined);

  const ordinary8 = parseProfileUpdates("I am wondering about hostel facilities", {});
  assert.equal(ordinary8.name, undefined);
});

test("Question parsing separation: questions do NOT contaminate applicant profile", () => {
  // Question about fees
  const res1 = parseProfileUpdates("What are the fees?", {});
  assert.equal(res1.name, undefined);
  assert.equal(res1.interested_program, undefined);
  assert.equal(res1.phone, undefined);
  assert.equal(res1.email, undefined);

  // Question mentioning programs
  const res2 = parseProfileUpdates("What is the fee for B.Tech in Artificial Intelligence & Machine Learning?", {});
  assert.equal(res2.interested_program, undefined);

  // Comparison question
  const res3 = parseProfileUpdates("Can you compare AI vs CSE?", {});
  assert.equal(res3.interested_program, undefined);

  // Conversational 'it' question
  const res4 = parseProfileUpdates("Is it a good college?", {});
  assert.equal(res4.interested_program, undefined);
});

test("Program parsing: extracts program ONLY when application interest is declared", () => {
  const res1 = parseProfileUpdates("I want to apply for B.Tech in Information Technology", {});
  assert.equal(res1.interested_program, "B.Tech in Information Technology");

  const res2 = parseProfileUpdates("I choose B.Tech in Data Science", {});
  assert.equal(res2.interested_program, "B.Tech in Data Science");

  const res3 = parseProfileUpdates("Interested in applying for AI & ML", {});
  assert.equal(res3.interested_program, "B.Tech in Artificial Intelligence & Machine Learning");

  const res4 = parseProfileUpdates("My preferred branch is CSE (AI)", {});
  assert.equal(res4.interested_program, "B.Tech in Computer Science & Engineering (Artificial Intelligence)");
});

test("Academic score parsing: does NOT treat '12th standard' as 12% score", () => {
  const falsePositive1 = parseProfileUpdates("I am studying in 12th standard, what is the fee?", {});
  assert.equal(falsePositive1.marks_12th, undefined);
  assert.equal(falsePositive1.academic_background, undefined);

  const falsePositive2 = parseProfileUpdates("Passed 12th std in 2025", {});
  assert.equal(falsePositive2.marks_12th, undefined);

  const trueScore1 = parseProfileUpdates("I got 84.5% in 12th board exams", {});
  assert.equal(trueScore1.marks_12th, 84.5);
  assert.equal(trueScore1.academic_background, "12th · 84.5%");

  const trueScore2 = parseProfileUpdates("12th PCM score is 78%", {});
  assert.equal(trueScore2.marks_12th, 78);
});

test("Entrance exam parsing: handles CET and JEE scores within bounds", () => {
  const cet = parseProfileUpdates("I scored 89.4 percentile in MHT-CET", {});
  assert.equal(cet.entrance_score, 89.4);
  assert.equal(cet.entrance_exam, "MHT-CET · 89.4 percentile");

  const jee = parseProfileUpdates("My JEE Main percentile is 92.1", {});
  assert.equal(jee.entrance_score, 92.1);
  assert.equal(jee.entrance_exam, "JEE (Main) · 92.1 percentile");
});

test("Contact parsing: extracts valid 10-digit Indian phones and emails", () => {
  const phoneOnly = parseProfileUpdates("You can call me on 9822334455", {});
  assert.equal(phoneOnly.phone, "9822334455");

  const phoneWithPrefix = parseProfileUpdates("Mobile: +91-9404494299", {});
  assert.equal(phoneWithPrefix.phone, "9404494299");

  const emailOnly = parseProfileUpdates("My email is rohan.patil@gmail.com", {});
  assert.equal(emailOnly.email, "rohan.patil@gmail.com");
});

test("Normalization: strips noisy punctuation and collapses whitespace", () => {
  assert.equal(normalizeText("AI & ML vs CSE (AI)?!"), "ai & ml vs cse ai");
  assert.equal(normalizeText("Check Fees (2026–27)..."), "check fees 2026 27");
  assert.equal(normalizeText("What are the fees???"), "what are the fees");
});

test("Multi-intent detection: detects multiple topics in complex questions", () => {
  const intents1 = detectIntents("What are the fees for B.Tech and what are the hostel facilities?");
  assert.ok(intents1.includes("fees"));
  assert.ok(intents1.includes("hostel"));

  const intents2 = detectIntents("Can you tell me the eligibility criteria and scholarship options?");
  assert.ok(intents2.includes("eligibility"));
  assert.ok(intents2.includes("scholarships"));
});

test("Intent collisions: distinguishes MGMU-CET info from low-score solutions", () => {
  const examIntents = detectIntents("What is the MGMU-CET exam pattern?");
  assert.deepEqual(examIntents, ["mgmu_cet_info"]);
  assert.ok(!examIntents.includes("low_score_solutions"));

  const lowScoreIntents = detectIntents("I got a low score in CET; can I still apply?");
  assert.deepEqual(lowScoreIntents, ["low_score_solutions"]);
  assert.ok(!lowScoreIntents.includes("mgmu_cet_info"));
});

test("Intent collisions: cleanly separates M.Tech vs B.Tech degree levels and programs", () => {
  const mtechDs = detectIntents("Tell me about M.Tech Data Science");
  assert.deepEqual(mtechDs, ["program_mtech_ds"]);
  assert.ok(!mtechDs.includes("program_ds"));

  const btechDs = detectIntents("Tell me about B.Tech Data Science");
  assert.deepEqual(btechDs, ["program_ds"]);
  assert.ok(!btechDs.includes("program_mtech_ds"));

  const mtechAi = detectIntents("Tell me about M.Tech AI");
  assert.deepEqual(mtechAi, ["program_mtech_aiml"]);
  assert.ok(!mtechAi.includes("program_aiml"));

  const btechAi = detectIntents("Tell me about B.Tech AI & ML");
  assert.deepEqual(btechAi, ["program_aiml"]);
  assert.ok(!btechAi.includes("program_mtech_aiml"));
});

test("Program selection separation: comparing programs does not set or change selected program", () => {
  // Queries specifically testing comparison phrases
  const comp1 = parseProfileUpdates("compare AI & ML and IT", {});
  assert.equal(comp1.interested_program, undefined, "'compare AI & ML and IT' must not set interested_program");

  const comp2 = parseProfileUpdates("AI & ML vs IT", {});
  assert.equal(comp2.interested_program, undefined, "'AI & ML vs IT' must not set interested_program");

  const comp3 = parseProfileUpdates("Which is better, AI & ML or IT?", {});
  assert.equal(comp3.interested_program, undefined, "'Which is better, AI & ML or IT?' must not set interested_program");

  // Additional comparison variations & question pills
  const comp4 = parseProfileUpdates("Can you compare AI vs CSE?", {});
  assert.equal(comp4.interested_program, undefined);

  const comp5 = parseProfileUpdates("Data Science vs AI", {});
  assert.equal(comp5.interested_program, undefined);

  const comp6 = parseProfileUpdates("Data Science Details", {});
  assert.equal(comp6.interested_program, undefined);

  const comp7 = parseProfileUpdates("What are the fees of Information Technology?", {});
  assert.equal(comp7.interested_program, undefined);

  const comp8 = parseProfileUpdates("Which branch do you recommend, AI or IT?", {});
  assert.equal(comp8.interested_program, undefined);
});

test("Program selection persistence: discussing another program never overwrites existing selection", () => {
  const existingProfile = {
    name: "Aarav Sharma",
    interested_program: "B.Tech in Information Technology"
  };

  // Discussions & comparisons must not return an interested_program update
  const res1 = parseProfileUpdates("compare AI & ML and IT", existingProfile);
  assert.equal(res1.interested_program, undefined);

  const res2 = parseProfileUpdates("AI & ML vs IT", existingProfile);
  assert.equal(res2.interested_program, undefined);

  const res3 = parseProfileUpdates("Which is better, AI & ML or IT?", existingProfile);
  assert.equal(res3.interested_program, undefined);

  const res4 = parseProfileUpdates("Tell me about Data Science", existingProfile);
  assert.equal(res4.interested_program, undefined);

  const res5 = parseProfileUpdates("What is the fee for AI & ML?", existingProfile);
  assert.equal(res5.interested_program, undefined);

  // In merged profile, original program selection remains completely intact
  const merged = { ...existingProfile, ...res1 };
  assert.equal(merged.interested_program, "B.Tech in Information Technology");
});

test("Program selection: explicit choice/application statements set the selected program", () => {
  // Explicit choice statements
  const resChoice1 = parseProfileUpdates("I’ve chosen AI & ML", {});
  assert.equal(resChoice1.interested_program, "B.Tech in Artificial Intelligence & Machine Learning");

  const resChoice2 = parseProfileUpdates("I have chosen AI & ML", {});
  assert.equal(resChoice2.interested_program, "B.Tech in Artificial Intelligence & Machine Learning");

  const resChoice3 = parseProfileUpdates("I want to apply for IT", {});
  assert.equal(resChoice3.interested_program, "B.Tech in Information Technology");

  const resChoice4 = parseProfileUpdates("My preferred program is Data Science", {});
  assert.equal(resChoice4.interested_program, "B.Tech in Data Science");

  const resChoice5 = parseProfileUpdates("I choose B.Tech in Data Science", {});
  assert.equal(resChoice5.interested_program, "B.Tech in Data Science");

  const resChoice6 = parseProfileUpdates("I want to apply for B.Tech in Information Technology", {});
  assert.equal(resChoice6.interested_program, "B.Tech in Information Technology");
});

