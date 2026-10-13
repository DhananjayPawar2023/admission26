import test from "node:test";
import assert from "node:assert/strict";

// Helper parsing inline markdown tokens
function parseInlineTokens(text) {
  if (!text) return [];
  const tokens = [];
  const regex = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    tokens.push(match[0]);
  }
  return tokens;
}

// Helper parsing conversation turns mirroring CounsellingTranscriptViewer
function parseTranscriptTurns(transcript) {
  if (!transcript || !transcript.trim()) {
    return { turns: [], profileContext: null };
  }

  let rawText = transcript.trim();
  let profileContext = null;

  const profileMatch = rawText.match(/^(?:Counsellor Chat Profile:|\[Chat Context:|\[Chat Profile:)[^\n]+/i);
  if (profileMatch) {
    profileContext = profileMatch[0].replace(/^\[|\]$/g, "").trim();
    rawText = rawText.slice(profileMatch[0].length).trim();
  }

  const turnRegex = /(Advisor|Student|Counsellor|Candidate|Assistant|User):\s*/gi;
  const turns = [];
  const splitIndices = [];
  let match;

  while ((match = turnRegex.exec(rawText)) !== null) {
    splitIndices.push({
      role: match[1].toLowerCase(),
      index: match.index,
      tagLength: match[0].length
    });
  }

  if (splitIndices.length > 0) {
    for (let i = 0; i < splitIndices.length; i++) {
      const current = splitIndices[i];
      const nextIndex = i + 1 < splitIndices.length ? splitIndices[i + 1].index : rawText.length;
      const content = rawText.slice(current.index + current.tagLength, nextIndex).trim();

      const isStudent =
        current.role === "student" ||
        current.role === "candidate" ||
        current.role === "user";

      turns.push({
        role: isStudent ? "student" : "advisor",
        label: isStudent ? "Student / Candidate" : "IICT Admissions Advisor",
        content
      });
    }
  }

  return { turns, profileContext };
}

// Helper checking explicit test markers (never hides real applicants by name or email pattern)
function isExplicitTestRecord(record) {
  if (!record) return false;
  return Boolean(record.is_demo || record.is_test || record.is_synthetic);
}

test("TranscriptViewer: separates Student and Advisor conversation turns cleanly", () => {
  const sampleTranscript = `Counsellor Chat Profile: 12th: 90.5%, Entrance: MHT-CET - 94 percentile, Location: Maharashtra
Advisor: Thank you, Rahul! I can provide accurate details on 2026-27 intake fees.
Student: My 12th PCM is 90.5% and MHT-CET score is 94 percentile.
Advisor: You qualify for our 50% merit scholarship waiver.
Student: My phone number is 9404494299 and email is applicant@gmail.com.`;

  const parsed = parseTranscriptTurns(sampleTranscript);
  assert.equal(parsed.turns.length, 4);
  assert.equal(parsed.turns[0].role, "advisor");
  assert.equal(parsed.turns[1].role, "student");
  assert.equal(parsed.turns[2].role, "advisor");
  assert.equal(parsed.turns[3].role, "student");

  assert.ok(parsed.profileContext.includes("12th: 90.5%"));
  assert.ok(parsed.turns[1].content.includes("MHT-CET score is 94 percentile"));
});

test("TranscriptViewer: inline parsing handles bold, bold-italic, and code safely without raw markers", () => {
  const tokens1 = parseInlineTokens("Hello **Rahul Sharma**, your eligibility is verified.");
  assert.equal(tokens1.length, 1);
  assert.equal(tokens1[0], "**Rahul Sharma**");

  const tokens2 = parseInlineTokens("***Official IICT Summary***");
  assert.equal(tokens2.length, 1);
  assert.equal(tokens2[0], "***Official IICT Summary***");
});

test("Test Record Marker: identifies explicit test fixtures and never filters genuine applicants by name/email", () => {
  const markedDemo = { student_name: "Demo Candidate", is_demo: true };
  const markedUnitTest = { student_name: "Rahul Sharma", is_test: true };
  const markedSynthetic = { student_name: "Synthetic Lead", is_synthetic: true };
  const genuineApplicant1 = { student_name: "Rahul Sharma", email: "rahul.sharma@gmail.com", phone: "9076543210" };
  const genuineApplicant2 = { student_name: "Priya Sharma", email: "priya.sharma@gmail.com", phone: "9876543210" };
  const genuineApplicant3 = { student_name: "Snehal Kulkarni", email: "snehal.kulkarni@gmail.com", phone: "9404494299" };

  assert.equal(isExplicitTestRecord(markedDemo), true);
  assert.equal(isExplicitTestRecord(markedUnitTest), true);
  assert.equal(isExplicitTestRecord(markedSynthetic), true);
  // Real applicants MUST NOT be filtered out even if their name is Rahul Sharma or Priya Sharma
  assert.equal(isExplicitTestRecord(genuineApplicant1), false);
  assert.equal(isExplicitTestRecord(genuineApplicant2), false);
  assert.equal(isExplicitTestRecord(genuineApplicant3), false);
});
