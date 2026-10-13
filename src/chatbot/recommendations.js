/**
 * Recommendation topics pool and dynamic follow-up algorithm for IICT Admissions.
 * Exactly three unique recommendations are maintained and rotated dynamically.
 */

export const RECOMMENDATION_POOL = [
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

export const INITIAL_RECOMMENDATIONS = [
  "AI & ML vs CSE (AI)",
  "Check Fees (2026–27)",
  "Low CET Score Options"
];

const TOPIC_FOLLOW_UPS = {
  "Check Fees (2026–27)": [
    "Scholarships (Up to 100%)",
    "Admission Dates & Documents",
    "AI & ML vs CSE (AI)"
  ],
  "Scholarships (Up to 100%)": [
    "Check Fees (2026–27)",
    "Admission Dates & Documents",
    "Low CET Score Options"
  ],
  "AI & ML vs CSE (AI)": [
    "Data Science vs AI",
    "Check Fees (2026–27)",
    "Placements Overview"
  ],
  "Data Science vs AI": [
    "AI & ML vs CSE (AI)",
    "Placements Overview",
    "Check Fees (2026–27)"
  ],
  "Low CET Score Options": [
    "Admission Dates & Documents",
    "Check Fees (2026–27)",
    "Scholarships (Up to 100%)"
  ],
  "Placements Overview": [
    "Degree Recognition & Govt Jobs",
    "Check Fees (2026–27)",
    "AI & ML vs CSE (AI)"
  ],
  "Hostel & Campus Life": [
    "Check Fees (2026–27)",
    "Placements Overview",
    "Admission Dates & Documents"
  ],
  "Degree Recognition & Govt Jobs": [
    "Placements Overview",
    "Admission Dates & Documents",
    "Check Fees (2026–27)"
  ],
  "Non-CS Beginner Coding": [
    "AI & ML vs CSE (AI)",
    "Placements Overview",
    "Hostel & Campus Life"
  ],
  "Admission Dates & Documents": [
    "Low CET Score Options",
    "Check Fees (2026–27)",
    "Scholarships (Up to 100%)"
  ]
};

/**
 * Maps input message and/or detected intents to its matching recommendation pool topic.
 */
export function mapIntentToPoolQuestion(text, intents = []) {
  if (!text && (!intents || intents.length === 0)) return null;
  const normalizedText = (text || "").toLowerCase().trim();

  // 1. Direct or partial string match against recommendation pool
  for (const q of RECOMMENDATION_POOL) {
    const qLower = q.toLowerCase();
    if (normalizedText === qLower || normalizedText.includes(qLower) || qLower.includes(normalizedText)) {
      return q;
    }
  }

  // 2. Intent-based match
  if (intents.includes("compare_ai_cse")) return "AI & ML vs CSE (AI)";
  if (intents.includes("compare_ai_ds")) return "Data Science vs AI";
  if (intents.includes("low_score_solutions") || intents.includes("mgmu_cet_info")) return "Low CET Score Options";
  if (intents.includes("fees")) return "Check Fees (2026–27)";
  if (intents.includes("scholarships")) return "Scholarships (Up to 100%)";
  if (intents.includes("placements")) return "Placements Overview";
  if (intents.includes("hostel")) return "Hostel & Campus Life";
  if (intents.includes("recognition")) return "Degree Recognition & Govt Jobs";
  if (intents.includes("coding_beginner")) return "Non-CS Beginner Coding";
  if (intents.includes("dates_documents") || intents.includes("eligibility")) return "Admission Dates & Documents";

  return null;
}

/**
 * Produces exactly three unique recommendations:
 * - Does not immediately show the question the user just asked.
 * - Chooses relevant follow-up recommendations based on the topic and assistant reply.
 * - For unclear queries, rotates to three useful admissions topics that differ from the previous set.
 */
export function getNextRecommendations(text, intents = [], previousRecs = []) {
  const asked = mapIntentToPoolQuestion(text, intents);
  const picked = [];

  const add = (q) => {
    if (picked.length < 3 && q && q !== asked && RECOMMENDATION_POOL.includes(q) && !picked.includes(q)) {
      picked.push(q);
    }
  };

  // 1. If topic has predefined relevant follow-ups, prioritize them
  if (asked && TOPIC_FOLLOW_UPS[asked]) {
    for (const f of TOPIC_FOLLOW_UPS[asked]) {
      add(f);
    }
  } else if (intents.some((i) => i.startsWith("program_") || i.startsWith("compare_"))) {
    // For specific program overviews/comparisons, recommend fees, placements, and alternate comparison
    for (const f of ["Check Fees (2026–27)", "Placements Overview", "AI & ML vs CSE (AI)"]) {
      add(f);
    }
  }

  // 2. Unclear query or need more items: pick fresh topics that were not in previousRecs and not asked
  const freshFromPool = RECOMMENDATION_POOL.filter((q) => q !== asked && !previousRecs.includes(q));
  for (const f of freshFromPool) {
    add(f);
  }

  // 3. Fallback fill from entire pool (excluding asked) if still under 3
  for (const f of RECOMMENDATION_POOL) {
    add(f);
  }

  return picked.slice(0, 3);
}
