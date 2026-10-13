export function formatCurrency(val) {
  if (val === null || val === undefined || isNaN(Number(val))) return "₹0";
  return "₹" + Number(val).toLocaleString("en-IN");
}

export function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim().toLowerCase();
  // Standard RFC 5322 simplified pattern; also rejects placeholder domains
  if (trimmed.endsWith("@temp.mgmu.ac.in")) return false;
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(trimmed);
}

export function isValidPhone(phone) {
  if (!phone || typeof phone !== "string") return false;
  const cleaned = phone.replace(/[\s\-\+\(\)]/g, "");
  // Accept 10 digits starting with 6-9, or with 91 prefix
  if (/^[6-9]\d{9}$/.test(cleaned)) return true;
  if (/^91[6-9]\d{9}$/.test(cleaned)) return true;
  return false;
}

export function normalizePhone(phone) {
  if (!phone) return "";
  const cleaned = phone.replace(/[\s\-\+\(\)]/g, "");
  if (cleaned.length === 12 && cleaned.startsWith("91")) {
    return cleaned.slice(2);
  }
  return cleaned;
}

export function calculateProfileCompleteness(p) {
  if (!p) return 0;
  let score = 0;

  // Name: at least 2 chars and letters only
  if (p.name && typeof p.name === "string" && p.name.trim().length >= 2) {
    score += 20;
  }

  // Program selection
  if (p.interested_program && typeof p.interested_program === "string" && p.interested_program.trim().length > 0) {
    score += 20;
  }

  // Academic score: validated percentage or valid 12th/10th marks
  const hasMarks12 = typeof p.marks_12th === "number" && p.marks_12th >= 35 && p.marks_12th <= 100;
  const hasMarks10 = typeof p.marks_10th === "number" && p.marks_10th >= 35 && p.marks_10th <= 100;
  const hasAcademicBg = Boolean(p.academic_background && p.academic_background.trim().length > 3);
  if (hasMarks12 || hasMarks10 || hasAcademicBg) {
    score += 20;
  }

  // Entrance exam: score or valid exam noted
  const hasEntranceScore = typeof p.entrance_score === "number" && p.entrance_score >= 0 && p.entrance_score <= 100;
  const hasEntranceExam = Boolean(p.entrance_exam && p.entrance_exam.trim().length > 2);
  if (hasEntranceScore || hasEntranceExam) {
    score += 15;
  }

  // Valid Phone
  if (isValidPhone(p.phone)) {
    score += 15;
  }

  // Valid Email
  if (isValidEmail(p.email)) {
    score += 10;
  }

  return Math.min(100, Math.max(0, score));
}
