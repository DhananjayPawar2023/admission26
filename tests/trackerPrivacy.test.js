import test from "node:test";
import assert from "node:assert/strict";
import { normalizePhone } from "../src/utils/formatters.js";

// Helper simulating privacy-safe database verification for applications and inquiries
function verifyTrackingStatus(records, { referenceId, phone, type = "application" }) {
  const cleanRef = (referenceId || "").trim().toUpperCase();
  const cleanPhone = normalizePhone(phone);

  if (!cleanRef) {
    return { found: false, error: "Reference ID is required." };
  }
  if (!cleanPhone || cleanPhone.length < 10) {
    return { found: false, error: "10-digit registered mobile number is required for privacy verification." };
  }

  // Lookup record matching BOTH reference ID and registered phone
  const record = records.find((r) => {
    const idMatch = type === "application"
      ? (r.application_number || "").toUpperCase() === cleanRef
      : (r.reference_code || "").toUpperCase() === cleanRef;
    const phoneMatch = normalizePhone(r.phone) === cleanPhone;
    return idMatch && phoneMatch;
  });

  if (!record) {
    return {
      found: false,
      error: "No matching record found for this reference code and registered mobile number."
    };
  }

  // PRIVACY GUARANTEE: Never reveal private residential address, exact marks, category, or DOB
  if (type === "application") {
    return {
      found: true,
      type: "application",
      application_number: record.application_number,
      program_choice: record.program_choice,
      status: record.status || "submitted",
      created_at: record.created_at,
      updated_at: record.updated_at
    };
  } else {
    return {
      found: true,
      type: "inquiry",
      reference_code: record.reference_code,
      program_interest: record.program_interest,
      status: record.status || "new",
      created_at: record.created_at
    };
  }
}

const mockApplications = [
  {
    id: "app-1",
    application_number: "MGMU-APP-2026-X8K9M",
    student_name: "Aarav Deshmukh",
    phone: "9822012345",
    email: "aarav@example.com",
    dob: "2006-04-18",
    category: "General",
    program_choice: "B.Tech Artificial Intelligence & Machine Learning",
    marks_percentage: 91.2,
    entrance_exam: "MGMU-CET",
    entrance_score: "162/200",
    address: "Plot 42, Samarth Nagar",
    city: "Chhatrapati Sambhajinagar",
    status: "under_scrutiny",
    created_at: "2026-03-15T10:00:00Z"
  }
];

const mockInquiries = [
  {
    id: "inq-1",
    reference_code: "IICT-2026-78AF90",
    student_name: "Pooja Jadhav",
    phone: "9404494299",
    email: "pooja@example.com",
    program_interest: "B.Tech Data Science",
    question: "Do you have merit scholarships for girls?",
    status: "contacted",
    created_at: "2026-03-14T09:30:00Z"
  }
];

test("Tracker Privacy: rejects lookup when mobile number is missing", () => {
  const result = verifyTrackingStatus(mockApplications, {
    referenceId: "MGMU-APP-2026-X8K9M",
    phone: "",
    type: "application"
  });

  assert.equal(result.found, false);
  assert.ok(result.error.includes("mobile number is required"));
});

test("Tracker Privacy: rejects lookup when mobile number does not match candidate record", () => {
  const result = verifyTrackingStatus(mockApplications, {
    referenceId: "MGMU-APP-2026-X8K9M",
    phone: "9999999999", // Wrong phone guessing attack
    type: "application"
  });

  assert.equal(result.found, false);
  assert.ok(result.error.includes("No matching record found"));
  // Ensure private data is NOT exposed
  assert.equal(result.student_name, undefined);
  assert.equal(result.address, undefined);
  assert.equal(result.marks_percentage, undefined);
});

test("Tracker Privacy: returns only safe milestone status on successful dual-key verification", () => {
  const result = verifyTrackingStatus(mockApplications, {
    referenceId: "MGMU-APP-2026-X8K9M",
    phone: "9822012345",
    type: "application"
  });

  assert.equal(result.found, true);
  assert.equal(result.application_number, "MGMU-APP-2026-X8K9M");
  assert.equal(result.program_choice, "B.Tech Artificial Intelligence & Machine Learning");
  assert.equal(result.status, "under_scrutiny");

  // CRITICAL PRIVACY CHECKS: Candidate private particulars must NEVER be present in tracker output
  assert.equal(result.address, undefined, "Address must be hidden from tracker");
  assert.equal(result.marks_percentage, undefined, "Marks must be hidden from tracker");
  assert.equal(result.dob, undefined, "DOB must be hidden from tracker");
  assert.equal(result.category, undefined, "Category must be hidden from tracker");
  assert.equal(result.entrance_score, undefined, "Score must be hidden from tracker");
});

test("Tracker Privacy: inquiry tracking works securely with dual-key verification", () => {
  const result = verifyTrackingStatus(mockInquiries, {
    referenceId: "IICT-2026-78AF90",
    phone: "9404494299",
    type: "inquiry"
  });

  assert.equal(result.found, true);
  assert.equal(result.reference_code, "IICT-2026-78AF90");
  assert.equal(result.program_interest, "B.Tech Data Science");
  assert.equal(result.status, "contacted");

  // Private candidate question and contact must be hidden
  assert.equal(result.question, undefined, "Candidate question must be hidden from tracker");
  assert.equal(result.email, undefined, "Email must be hidden from tracker");
});
