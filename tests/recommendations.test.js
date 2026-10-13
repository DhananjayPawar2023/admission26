import test from "node:test";
import assert from "node:assert/strict";
import {
  RECOMMENDATION_POOL,
  INITIAL_RECOMMENDATIONS,
  mapIntentToPoolQuestion,
  getNextRecommendations
} from "../src/chatbot/recommendations.js";
import { detectIntents, parseProfileUpdates } from "../src/chatbot/parser.js";

test("Recommendations: initial set has exactly three unique questions from the pool", () => {
  assert.equal(INITIAL_RECOMMENDATIONS.length, 3);
  assert.equal(new Set(INITIAL_RECOMMENDATIONS).size, 3);
  for (const q of INITIAL_RECOMMENDATIONS) {
    assert.ok(RECOMMENDATION_POOL.includes(q), `${q} must belong to the recommendation pool`);
  }
});

test("Recommendations: pool contains exactly the ten specified admissions topics", () => {
  assert.equal(RECOMMENDATION_POOL.length, 10);
  const expectedTopics = [
    "AI & ML vs CSE (AI)",
    "Data Science vs AI",
    "Low CET Score Options",
    "Check Fees (2026–27)",
    "Scholarships (Up to 100%)",
    "Placements Overview",
    "Hostel & Campus Life",
    "Degree Recognition & Govt Jobs",
    "Non-CS Beginner Coding",
    "Admission Dates & Documents"
  ];
  assert.deepEqual(RECOMMENDATION_POOL, expectedTopics);
});

test("Recommendations: clicking a recommendation updates to three relevant follow-ups and avoids immediate repeat", () => {
  const previous = [...INITIAL_RECOMMENDATIONS];
  // User clicks 'Check Fees (2026–27)'
  const clicked = "Check Fees (2026–27)";
  const intents = detectIntents(clicked);
  const nextThree = getNextRecommendations(clicked, intents, previous);

  // Exactly three unique questions
  assert.equal(nextThree.length, 3);
  assert.equal(new Set(nextThree).size, 3);

  // Must not immediately show the question user just asked
  assert.ok(!nextThree.includes(clicked), "New recommendations must not include the question just asked");

  // Follow-ups to fees must include scholarships and admission dates/documents
  assert.ok(nextThree.includes("Scholarships (Up to 100%)"));
  assert.ok(nextThree.includes("Admission Dates & Documents"));
});

test("Recommendations: parity between typed questions and recommendation clicks", () => {
  const previous = [...INITIAL_RECOMMENDATIONS];

  // 1. Click 'Check Fees (2026–27)'
  const clickIntents = detectIntents("Check Fees (2026–27)");
  const fromClick = getNextRecommendations("Check Fees (2026–27)", clickIntents, previous);

  // 2. Type 'What are the tuition fees?'
  const typeIntents = detectIntents("What are the tuition fees?");
  const fromType = getNextRecommendations("What are the tuition fees?", typeIntents, previous);

  // Both should identify the fees topic and yield the exact same relevant follow-ups
  assert.deepEqual(fromType, fromClick);
  assert.ok(fromType.includes("Scholarships (Up to 100%)"));
});

test("Recommendations: avoids repeats across successive question turns", () => {
  let active = [...INITIAL_RECOMMENDATIONS];

  // Turn 1: User asks Fees
  const turn1Intents = detectIntents("Check Fees (2026–27)");
  active = getNextRecommendations("Check Fees (2026–27)", turn1Intents, active);
  assert.equal(active.length, 3);
  assert.ok(!active.includes("Check Fees (2026–27)"));

  // Turn 2: User clicks Scholarships from active
  const turn2Intents = detectIntents("Scholarships (Up to 100%)");
  active = getNextRecommendations("Scholarships (Up to 100%)", turn2Intents, active);
  assert.equal(active.length, 3);
  assert.ok(!active.includes("Scholarships (Up to 100%)"));

  // Turn 3: User asks Placements
  const turn3Intents = detectIntents("Placements Overview");
  active = getNextRecommendations("Placements Overview", turn3Intents, active);
  assert.equal(active.length, 3);
  assert.ok(!active.includes("Placements Overview"));
});

test("Recommendations: unclear/unrecognized question shows three useful topics differing from previous set", () => {
  const previous = ["AI & ML vs CSE (AI)", "Check Fees (2026–27)", "Low CET Score Options"];
  const unclearText = "What is the weather in Mumbai today?";
  const intents = detectIntents(unclearText); // []
  const nextThree = getNextRecommendations(unclearText, intents, previous);

  assert.equal(nextThree.length, 3);
  assert.equal(new Set(nextThree).size, 3);

  // For unclear questions, it must show 3 topics that differ completely from the previous set
  for (const item of nextThree) {
    assert.ok(!previous.includes(item), `${item} must differ from the previous recommendations set`);
    assert.ok(RECOMMENDATION_POOL.includes(item));
  }
});

test("Recommendations: clicking a recommendation does NOT set profile.interested_program", () => {
  // Recommendation clicks are treated as questions/inquiries, not application declarations
  for (const topic of RECOMMENDATION_POOL) {
    const profileUpdates = parseProfileUpdates(topic, {});
    assert.equal(
      profileUpdates.interested_program,
      undefined,
      `Topic '${topic}' must NOT set interested_program on applicant profile`
    );
  }
});
