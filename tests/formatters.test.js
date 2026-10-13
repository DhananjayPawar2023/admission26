import test from "node:test";
import assert from "node:assert/strict";
import {
  formatCurrency,
  isValidEmail,
  isValidPhone,
  normalizePhone,
  calculateProfileCompleteness
} from "../src/utils/formatters.js";

test("formatCurrency: formats INR numbers accurately", () => {
  assert.equal(formatCurrency(150000), "₹1,50,000");
  assert.equal(formatCurrency(204500), "₹2,04,500");
  assert.equal(formatCurrency(0), "₹0");
});

test("isValidEmail: validates standard emails and rejects placeholder domains", () => {
  assert.equal(isValidEmail("student@gmail.com"), true);
  assert.equal(isValidEmail("aditi.deshmukh@mgmu.ac.in"), true);
  // Rejects fake placeholder email pattern
  assert.equal(isValidEmail("9822334455@temp.mgmu.ac.in"), false);
  assert.equal(isValidEmail("not-an-email"), false);
  assert.equal(isValidEmail(""), false);
  assert.equal(isValidEmail(null), false);
});

test("isValidPhone: validates 10-digit Indian numbers with or without +91", () => {
  assert.equal(isValidPhone("9822334455"), true);
  assert.equal(isValidPhone("+91 9822334455"), true);
  assert.equal(isValidPhone("91-9822334455"), true);
  assert.equal(isValidPhone("12345"), false);
  assert.equal(isValidPhone("N/A"), false);
  assert.equal(isValidPhone(""), false);
});

test("normalizePhone: returns clean 10 digits", () => {
  assert.equal(normalizePhone("+91 9822334455"), "9822334455");
  assert.equal(normalizePhone("919822334455"), "9822334455");
  assert.equal(normalizePhone("9822334455"), "9822334455");
});

test("calculateProfileCompleteness: accurately reflects valid fields", () => {
  assert.equal(calculateProfileCompleteness({}), 0);

  const partial = {
    name: "Aditi Deshmukh",
    interested_program: "B.Tech in Artificial Intelligence & Machine Learning"
  };
  assert.equal(calculateProfileCompleteness(partial), 40);

  const complete = {
    name: "Aditi Deshmukh",
    interested_program: "B.Tech in Artificial Intelligence & Machine Learning",
    marks_12th: 85.5,
    entrance_score: 92.4,
    phone: "9822334455",
    email: "aditi@gmail.com"
  };
  assert.equal(calculateProfileCompleteness(complete), 100);

  // Rejects invalid phone or fake email from counting towards completeness
  const withFakeContacts = {
    name: "Aditi Deshmukh",
    interested_program: "B.Tech in Artificial Intelligence & Machine Learning",
    phone: "N/A",
    email: "9822334455@temp.mgmu.ac.in"
  };
  assert.equal(calculateProfileCompleteness(withFakeContacts), 40);
});
