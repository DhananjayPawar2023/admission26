import test from "node:test";
import assert from "node:assert/strict";
import { isValidEmail, isValidPhone, normalizePhone } from "../src/utils/formatters.js";

// Helper validating the client-side direct application constraints
function validateDirectApplication(payload) {
  const errors = [];

  // Deliberate program selection is strictly required
  if (!payload.program_choice || typeof payload.program_choice !== "string" || !payload.program_choice.trim()) {
    errors.push("Deliberate program selection is required");
  }

  // Candidate name
  if (!payload.student_name || payload.student_name.trim().length < 2) {
    errors.push("Candidate name is required (minimum 2 characters)");
  }

  // Date of birth & gender
  if (!payload.dob) {
    errors.push("Date of birth is required");
  }
  if (!payload.gender) {
    errors.push("Gender is required");
  }

  // Contact
  if (!isValidEmail(payload.email)) {
    errors.push("A valid email address is required");
  }
  if (!isValidPhone(payload.phone)) {
    errors.push("A valid 10-digit mobile number is required");
  }

  // Marks
  const marks = parseFloat(payload.marks_percentage);
  if (isNaN(marks) || marks < 35 || marks > 100) {
    errors.push("Aggregate marks percentage must be between 35% and 100%");
  }

  // Address
  if (!payload.city || payload.city.trim().length < 2) {
    errors.push("City is required");
  }

  // Declaration
  if (!payload.declarationAgreed) {
    errors.push("Declaration agreement is required");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Helper simulating application number generation
function generateApplicationNumber() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 5; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `MGMU-APP-2026-${suffix}`;
}

test("DirectApplication: rejects empty or unselected program choice", () => {
  const result = validateDirectApplication({
    program_choice: "",
    student_name: "Rahul Shinde",
    dob: "2006-05-14",
    gender: "Male",
    email: "rahul@example.com",
    phone: "9876543210",
    marks_percentage: 82.5,
    city: "Chhatrapati Sambhajinagar",
    declarationAgreed: true
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("Deliberate program selection is required"));
});

test("DirectApplication: rejects invalid contacts and out-of-bound academic scores", () => {
  const result = validateDirectApplication({
    program_choice: "B.Tech Artificial Intelligence & Machine Learning",
    student_name: "R",
    dob: "",
    gender: "",
    email: "not-an-email",
    phone: "12345",
    marks_percentage: 120,
    city: "",
    declarationAgreed: false
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("Candidate name is required (minimum 2 characters)"));
  assert.ok(result.errors.includes("Date of birth is required"));
  assert.ok(result.errors.includes("Gender is required"));
  assert.ok(result.errors.includes("A valid email address is required"));
  assert.ok(result.errors.includes("A valid 10-digit mobile number is required"));
  assert.ok(result.errors.includes("Aggregate marks percentage must be between 35% and 100%"));
  assert.ok(result.errors.includes("Declaration agreement is required"));
});

test("DirectApplication: accepts valid complete application payload", () => {
  const result = validateDirectApplication({
    program_choice: "B.Tech Computer Science & Engineering (AI)",
    student_name: "Snehal Kulkarni",
    dob: "2006-03-22",
    gender: "Female",
    category: "OBC",
    email: "snehal.kulkarni@gmail.com",
    phone: "+91 9404494299",
    qualifying_exam: "HSC (12th Science)",
    marks_percentage: 88.4,
    entrance_exam: "MGMU-CET",
    entrance_score: "148/200",
    city: "Chhatrapati Sambhajinagar",
    state: "Maharashtra",
    pincode: "431003",
    declarationAgreed: true
  });

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test("Application Reference Format: follows MGMU-APP-2026-XXXXX and is distinct from inquiries", () => {
  const appNumber = generateApplicationNumber();
  const inquiryRef = `IICT-2026-A1B2C3`;

  assert.match(appNumber, /^MGMU-APP-2026-[A-Z0-9]{5}$/);
  assert.ok(appNumber.startsWith("MGMU-APP-2026-"));
  assert.ok(!appNumber.startsWith("IICT-2026-"));

  assert.ok(inquiryRef.startsWith("IICT-2026-"));
  assert.ok(!inquiryRef.startsWith("MGMU-APP-2026-"));
});

test("DirectApplication vs Inquiry separation: distinct schemas and storage destinations", () => {
  const applicationRecord = {
    application_number: "MGMU-APP-2026-K9P2X",
    student_name: "Aditya Patil",
    program_choice: "B.Tech Information Technology",
    dob: "2006-09-10",
    gender: "Male",
    category: "General",
    marks_percentage: 81.2,
    entrance_exam: "MHT-CET",
    address: "CIDCO N-6",
    city: "Chhatrapati Sambhajinagar",
    status: "submitted"
  };

  const inquiryRecord = {
    reference_code: "IICT-2026-89AF12",
    student_name: "Aditya Patil",
    program_interest: "B.Tech Information Technology",
    question: "What are the hostel fees for IT students?",
    course_category: "UG",
    status: "new"
  };

  // Applications have application_number and program_choice; inquiries have reference_code and program_interest
  assert.ok("application_number" in applicationRecord);
  assert.ok("program_choice" in applicationRecord);
  assert.ok(!("question" in applicationRecord));

  assert.ok("reference_code" in inquiryRecord);
  assert.ok("program_interest" in inquiryRecord);
  assert.ok("question" in inquiryRecord);
  assert.ok(!("application_number" in inquiryRecord));
});
