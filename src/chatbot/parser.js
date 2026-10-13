import { isValidEmail, isValidPhone, normalizePhone } from "../utils/formatters.js";

const MAHARASHTRA_CITIES = [
  "pune", "mumbai", "sambhajinagar", "aurangabad", "nashik", "nagpur",
  "kolhapur", "solapur", "nanded", "jalna", "latur", "beed", "ahmednagar",
  "satara", "thane", "navi mumbai", "amravati", "chandrapur", "parbhani",
  "dhule", "jalgaon", "akola", "sangli", "malegaon", "maharashtra"
];

const OTHER_STATES = [
  "delhi", "gujarat", "bihar", "madhya pradesh", "rajasthan", "uttar pradesh",
  "karnataka", "telangana", "andhra pradesh", "kerala", "tamil nadu", "haryana",
  "punjab", "west bengal", "odisha", "jharkhand", "chhattisgarh", "goa", "other state"
];

const STOPWORDS_NAME = [
  "a", "an", "the", "from", "in", "at", "to", "for", "with", "as", "of", "on",
  "interested", "looking", "student", "here", "ready", "applying", "admission",
  "admissions", "fee", "fees", "course", "courses", "btech", "college", "mgm",
  "iict", "university", "pune", "mumbai", "score", "cet", "jee", "marks", "pcm",
  "hostel", "placement", "placements", "scholarship", "scholarships", "want", "need",
  "tell", "can", "help", "about", "branch", "branching", "computer", "science", "data",
  "artificial", "intelligence", "nothing", "good", "better", "best", "which", "how", "what",
  "where", "why", "who", "yes", "no", "hi", "hello", "hey", "please", "sir", "madam",
  "pass", "passed", "passing", "studying", "study", "class", "standard", "std", "pursuing",
  "confused", "wondering", "curious", "asking", "inquiring", "eligible", "searching",
  "worried", "thinking", "seeking", "planning", "opting", "tense", "doubtful", "uncertain",
  "wanting", "needing", "trying", "hailing", "staying", "living", "writing", "just", "checking"
];

/**
 * Normalizes user input for robust matching against intents.
 * Converts to lowercase, strips noisy punctuation, and collapses whitespace.
 */
export function normalizeText(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .toLowerCase()
    .replace(/[?!.,;:()[\]{}"'`~*_/\-\\–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Separates applicant profile data extraction from informational questions.
 * Informational queries (e.g. "What are the fees?") must NOT be mistaken for candidate profile data.
 */
export function parseProfileUpdates(text, currentProfile = {}) {
  const updates = {};
  if (!text || typeof text !== "string") return updates;
  const raw = text.trim();
  const normalized = normalizeText(raw);

  // Determine if the message is an inquiry/question
  const isQuestion = (
    raw.includes("?") ||
    /\b(what|how|why|which|where|when|who|can i|could you|tell me|compare|difference|vs|versus|fees?|cost|charges|details|syllabus|explain|info|scope)\b/i.test(raw)
  );

  // 1. Phone extraction (10-digit Indian numbers starting with 6-9)
  const phoneMatch = raw.match(/(?:\+?91[\-\s]?)?([6-9]\d{9})\b/);
  if (phoneMatch && isValidPhone(phoneMatch[1])) {
    updates.phone = normalizePhone(phoneMatch[1]);
  }

  // 2. Email extraction
  const emailMatch = raw.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch && isValidEmail(emailMatch[1])) {
    updates.email = emailMatch[1].toLowerCase();
  }

  // 3. Name extraction (ONLY on explicit, unambiguous declarations)
  // If the message is a question, do NOT extract names from "i am / i'm" unless "my name is" is explicitly used.
  const explicitNameMatch = raw.match(/(?:my name is|name is|call me|name's)\s+([a-zA-Z][a-zA-Z\s'.]{1,35})/i);
  const conversationalNameMatch = !isQuestion
    ? raw.match(/^(?:i am|i'm|myself)\s+([a-zA-Z][a-zA-Z\s'.]{1,35})/i)
    : null;

  const candidateMatch = explicitNameMatch || conversationalNameMatch;
  if (candidateMatch) {
    const candidate = candidateMatch[1].trim();
    const candidateWords = candidate.split(/\s+/).filter(Boolean);
    const hasStopword = candidateWords.some((w) => STOPWORDS_NAME.includes(w.toLowerCase()));
    const allWordsValidLength = candidateWords.every((w) => w.length >= 2 || (w.length === 1 && w === w.toUpperCase()));
    const notSingleArticle = candidateWords.length > 0 && !["a", "i"].includes(candidate.toLowerCase());

    if (!hasStopword && allWordsValidLength && notSingleArticle && candidateWords.length >= 1 && candidateWords.length <= 4) {
      updates.name = candidateWords
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
    }
  }

  // 4. Program interest extraction
  // CRITICAL SEPARATION OF INTENT FROM APPLICANT PROFILE UPDATES:
  // Inquiring about, discussing, comparing, or asking for recommendations about programs
  // must NEVER set or change profile.interested_program!
  //
  // Specifically:
  // - Comparisons (e.g. "compare AI & ML and IT", "AI & ML vs IT", "Which is better, AI & ML or IT?")
  // - Questions (containing '?' or interrogative words like 'what', 'how', 'which', 'can i', etc.)
  // - Explanation/detail requests ("explain AI & ML", "Data Science Details", "syllabus of IT")
  // - Recommendation requests ("which branch should I choose", "recommend a program")
  // - Plain mentions or discussion ("AI & ML", "B.Tech in IT", "Information Technology")
  // - Action pills / buttons ("Check B.Tech IT Fees", "Data Science vs AI")
  // MUST NEVER set or update profile.interested_program!
  //
  // ONLY set the selected program when the applicant makes a CLEAR statement of choice or application intent,
  // such as:
  //   - "I've chosen AI & ML" / "I have chosen AI & ML"
  //   - "I want to apply for IT" / "I am applying for IT" / "Applying for Data Science"
  //   - "My preferred program is Data Science" / "My preferred branch is AI & ML"
  //   - "I choose IT" / "My target program is Data Science"
  //
  // AND: An already selected program must NEVER be overwritten because a later chat message merely discusses another program.
  const isComparisonQuery = (
    /\b(vs|versus|compare|comparing|comparison|difference|differences|which is better|which one|between)\b/i.test(raw) ||
    (/\b(or|and)\b/i.test(raw) && (
      (/\b(ai|aiml)\b/i.test(raw) && /\b(it|information technology)\b/i.test(raw)) ||
      (/\b(ai|aiml)\b/i.test(raw) && /\b(cse|computer science)\b/i.test(raw) && !/\bcse\s*\(?ai\)?\b/i.test(raw)) ||
      (/\b(ai|aiml)\b/i.test(raw) && /\b(data science|ds)\b/i.test(raw)) ||
      (/\b(it|information technology)\b/i.test(raw) && /\b(cse|computer science)\b/i.test(raw))
    ))
  );

  const isQuestionQuery = (
    raw.includes("?") ||
    /\b(what|how|why|which|where|when|who|whose|whom|can i|could you|is there|do you|should i|would|will|may i|tell me|tell us|know about)\b/i.test(raw)
  );

  const isExplanationQuery = (
    /\b(explain|explanation|overview|details|describe|description|syllabus|curriculum|subjects|info\s+(?:about|on)|information\s+(?!technology)|guide|brief|walk me through|learn more|know more|features|highlights)\b/i.test(raw)
  );

  const isRecommendationQuery = (
    /\b(recommend|recommendation|recommending|suggest|suggestion|suggesting|advise|advice|which branch|which course|which program|which to choose|should i choose|scope of|future of|worth it)\b/i.test(raw)
  );

  // Explicit, unambiguous statement of choice or application intent
  const hasExplicitChoiceStatement = (
    /\b(?:i(?:['’`]?ve| have)? chosen|i chose|chosen (?:program|branch|course) is|my choice is)\b/i.test(raw) ||
    /\b(?:interested in applying for|i(?:['’`]?d| would)? like to apply for|i want to apply for|want to apply for|applying for|i am applying for|i['’`]?m applying for)\b/i.test(raw) ||
    /\b(?:my preferred (?:program|branch|course) is|preferred (?:program|branch|course) is|my preference is|my priority is)\b/i.test(raw) ||
    /\b(?:my target (?:program|branch|course) is|target (?:program|branch|course) is)\b/i.test(raw) ||
    /\b(?:i choose|i have decided on|i decided on|i am selecting|i select|selected (?:program|branch|course) is)\b/i.test(raw) ||
    /\b(?:i want admission in|want admission in|take admission in|admit me in|admit me to|enroll (?:me )?in|register (?:me )?for)\b/i.test(raw) ||
    /\b(?:set my (?:target )?program to|change my (?:target )?program to|switch my (?:target )?program to)\b/i.test(raw)
  );

  // If the message is a question, comparison, explanation, or recommendation, it CANNOT be a program choice statement
  const isEligibleChoice = hasExplicitChoiceStatement && !isQuestionQuery && !isComparisonQuery && !isExplanationQuery && !isRecommendationQuery;

  if (isEligibleChoice) {
    // Only set if not ambiguous between multiple programs
    if (!/\b(or|between)\b/i.test(raw)) {
      if (/\b(m\.?tech\s*(?:in\s*)?(?:data science|ds))\b/i.test(raw)) {
        updates.interested_program = "M.Tech in Data Science";
      } else if (/\b(m\.?tech\s*(?:in\s*)?(?:ai|aiml|artificial intelligence))\b/i.test(raw)) {
        updates.interested_program = "M.Tech in Artificial Intelligence and Machine Learning";
      } else if (/\b(m\.?tech)\b/i.test(raw)) {
        updates.interested_program = "M.Tech in Artificial Intelligence and Machine Learning";
      } else if (/\b(cyber\s*security|digital forensics|diploma\s*in\s*cyber)\b/i.test(raw)) {
        updates.interested_program = "Diploma in Cyber Security and Digital Forensics";
      } else if (/\b(direct second year|dsy|lateral entry|polytechnic diploma|diploma holder)\b/i.test(raw)) {
        updates.interested_program = "B.Tech Direct Second Year (Lateral Entry)";
      } else if (/\b(agentic|agentic ai)\b/i.test(raw)) {
        updates.interested_program = "Certificate Course in Agentic AI";
      } else if (/\b(ai\s*(?:&|and)\s*ml|aiml|b\.?tech\s*ai|artificial intelligence\s*(?:&|and)\s*machine learning)\b/i.test(raw)) {
        updates.interested_program = "B.Tech in Artificial Intelligence & Machine Learning";
      } else if (/\b(cse\s*\(?ai\)?|computer science\s*(?:and|&)?\s*engineering|cse branch|cse program)\b/i.test(raw)) {
        updates.interested_program = "B.Tech in Computer Science & Engineering (Artificial Intelligence)";
      } else if (/\b(data science|datascience|b\.?tech\s*ds|big data)\b/i.test(raw)) {
        updates.interested_program = "B.Tech in Data Science";
      } else if (/\b(information technology|b\.?tech\s*it|it branch|it department|it engineering|\bit\b)/i.test(raw)) {
        updates.interested_program = "B.Tech in Information Technology";
      } else if (/\b(artificial intelligence|\bai\b)\b/i.test(raw)) {
        updates.interested_program = "B.Tech in Artificial Intelligence & Machine Learning";
      }
    }
  }

  // 5. 12th Marks / Percentage extraction (Strictly prevent "12th standard" matching as 12%!)
  const explicitPercentMatch = raw.match(/(\d{1,2}(?:\.\d{1,2})?)\s*%/);
  const scoreWithKeywordMatch = raw.match(/(?:scored|got|obtained|marks?|percentage|pcm|12th score|hsc score)\s*[:=]?\s*(\d{1,2}(?:\.\d{1,2})?)\b/i);

  if (explicitPercentMatch) {
    const val = parseFloat(explicitPercentMatch[1]);
    if (val >= 35 && val <= 100) {
      updates.academic_background = `12th · ${val}%`;
      updates.marks_12th = val;
    }
  } else if (scoreWithKeywordMatch && !/\b(12th|10th)\s*(standard|std|class|pass|passed|appearing)\b/i.test(raw)) {
    const val = parseFloat(scoreWithKeywordMatch[1]);
    if (val >= 35 && val <= 100) {
      updates.academic_background = `12th · ${val}%`;
      updates.marks_12th = val;
    }
  }

  // 6. Entrance exam scores (CET / JEE)
  const cetPercentileMatch =
    raw.match(/(?:mht[\s\-]?cet|cet)\s*(?:percentile|score|marks)?\s*(?:[:=]|\bis\b)?\s*(\d{1,2}(?:\.\d{1,2})?)\s*(?:percentile|%tile|score)?/i) ||
    raw.match(/(\d{1,2}(?:\.\d{1,2})?)\s*(?:percentile|%tile)\s*(?:in\s*)?(?:mht[\s\-]?cet|cet)/i);

  const jeePercentileMatch =
    raw.match(/(?:jee\s*(?:main)?)\s*(?:percentile|score|marks)?\s*(?:[:=]|\bis\b)?\s*(\d{1,2}(?:\.\d{1,2})?)\s*(?:percentile|%tile|score)?/i) ||
    raw.match(/(\d{1,2}(?:\.\d{1,2})?)\s*(?:percentile|%tile)\s*(?:in\s*)?(?:jee\s*(?:main)?)/i);

  if (cetPercentileMatch) {
    const scoreVal = parseFloat(cetPercentileMatch[1]);
    if (scoreVal >= 0 && scoreVal <= 100) {
      updates.entrance_exam = `MHT-CET · ${scoreVal} percentile`;
      updates.entrance_score = scoreVal;
    }
  } else if (jeePercentileMatch) {
    const scoreVal = parseFloat(jeePercentileMatch[1]);
    if (scoreVal >= 0 && scoreVal <= 100) {
      updates.entrance_exam = `JEE (Main) · ${scoreVal} percentile`;
      updates.entrance_score = scoreVal;
    }
  }

  // 7. Location extraction
  const locationPhraseMatch = raw.match(/(?:i am from|from|living in|staying in|resident of|located at|based in)\s+([a-zA-Z\s]{2,25})/i);
  if (locationPhraseMatch) {
    const locSnippet = locationPhraseMatch[1].toLowerCase();
    if (MAHARASHTRA_CITIES.some((city) => locSnippet.includes(city))) {
      updates.location = "Maharashtra";
    } else if (OTHER_STATES.some((state) => locSnippet.includes(state)) || locSnippet.includes("outside")) {
      updates.location = "Other State (All India)";
    }
  }

  // 8. Topics noted
  const notes = [];
  if (/\b(fee|fees|tuition|cost|installment)\b/i.test(normalized)) notes.push("Fees");
  if (/\b(scholarship|scholarships|waiver|concession|mahadbt)\b/i.test(normalized)) notes.push("Scholarships");
  if (/\b(hostel|mess|accommodation|stay|food)\b/i.test(normalized)) notes.push("Hostel");
  if (/\b(placement|placements|recruit|recruiter|package|salary)\b/i.test(normalized)) notes.push("Placements");
  if (/\b(eligibility|cutoff|cut-off|mgmu-cet|entrance)\b/i.test(normalized)) notes.push("Eligibility");
  if (notes.length > 0) {
    const existing = currentProfile.questions_noted ? currentProfile.questions_noted.split(" · ") : [];
    const merged = Array.from(new Set([...existing, ...notes]));
    updates.questions_noted = merged.join(" · ");
  }

  return updates;
}

/**
 * Robust intent detection supporting normalized typed variations and multi-intent queries.
 * Prevents false positives by enforcing word boundaries.
 */
export function detectIntents(text) {
  if (!text || typeof text !== "string") return [];
  const raw = normalizeText(text);
  const intents = [];

  // 1. Comparison: AI & ML vs CSE (AI)
  if (
    (/\b(ai|aiml|artificial\s*intelligence)\b/i.test(raw) && /\b(cse|computer\s*science)\b/i.test(raw)) &&
    (/\b(vs|versus|compare|comparison|difference|better|choose|or)\b/i.test(raw) || raw === "ai ml vs cse ai" || raw.includes("ai ml vs cse"))
  ) {
    intents.push("compare_ai_cse");
  }

  // 2. Comparison: Data Science vs AI
  if (
    (/\b(data\s*science|datascience|\bds\b)\b/i.test(raw) && /\b(ai|aiml|artificial\s*intelligence)\b/i.test(raw)) &&
    (/\b(vs|versus|compare|comparison|difference|better|choose|or)\b/i.test(raw) || raw === "data science vs ai" || raw.includes("ds vs ai"))
  ) {
    intents.push("compare_ai_ds");
  }

  // 3. Comparison: AI & ML vs IT
  if (
    (/\b(ai|aiml|artificial\s*intelligence)\b/i.test(raw) && /\b(information\s*technology|\bit\b)\b/i.test(raw)) &&
    (/\b(vs|versus|compare|comparison|difference|better|choose|or|and|between)\b/i.test(raw) || raw.includes("ai vs it") || raw.includes("it vs ai"))
  ) {
    intents.push("compare_ai_it");
  }

  // 4. Comparison: IT vs CSE
  if (
    (/\b(information\s*technology|\bit\b)\b/i.test(raw) && /\b(cse|computer\s*science)\b/i.test(raw)) &&
    (/\b(vs|versus|compare|comparison|difference|better|choose|or|and|between)\b/i.test(raw) || raw.includes("it vs cse") || raw.includes("cse vs it"))
  ) {
    intents.push("compare_it_cse");
  }

  // 4. Comparison: B.Tech vs BCA / B.Sc
  if (
    /\b(bca|bsc|b\s*sc)\b/i.test(raw) &&
    /\b(b\s*tech|engineering)\b/i.test(raw)
  ) {
    intents.push("compare_btech_bca");
  }

  // 5. Best branch inquiry
  if (
    /\b(best\s*(?:branch|course|stream|field|program)|which\s*(?:branch|course|program)\s*(?:is\s*best|to\s*choose|should\s*i)|future\s*scope|career\s*scope)\b/i.test(raw)
  ) {
    intents.push("best_branch");
  }

  // 6. MGMU-CET Entrance Exam Information vs Low CET/JEE score
  const isMgmuCet = /\b(mgmu[\s\-]?cet|mgm\s*cet)\b/i.test(raw);
  const isLowScoreQuery = (
    /\b(low|less|poor|bad|kam|dropped|minimum|failed|can\s*i\s*get\s*admission\s*with|can\s*i\s*get\s*seat\s*with|marks\s*less|low\s*score)\b/i.test(raw) &&
    /\b(cet|jee|percentile|marks|score|rank|grade)\b/i.test(raw)
  );

  if (isLowScoreQuery) {
    intents.push("low_score_solutions");
  } else if (isMgmuCet) {
    intents.push("mgmu_cet_info");
  }

  // 7. Academic Eligibility criteria
  if (
    /\b(eligib\w*|criteria|qualif\w*|minimum\s*marks|min\s*marks|pcm\s*(?:percentage|criteria|marks|aggregate)|who\s*can\s*apply|admission\s*requirements?)\b/i.test(raw)
  ) {
    intents.push("eligibility");
  }

  // 8. Institutional / Direct admission / Management Quota
  if (
    /\b(direct\s*admission|management\s*quota|institutional\s*quota|donation|capitation|without\s*cet|without\s*jee|without\s*entrance)\b/i.test(raw)
  ) {
    intents.push("direct_admission");
  }

  // 9. Official Fees & Payment Schedules
  if (
    /\b(fee|fees|tuition|cost|costs|pricing|price|charge|charges|installment|installments|expense|expenses|how\s*much\s*to\s*pay)\b/i.test(raw)
  ) {
    intents.push("fees");
  }

  // 10. Scholarships & Financial Waivers
  if (
    /\b(scholarship|scholarships|waiver|waivers|concession|concessions|mahadbt|ebc|freeship|financial\s*aid|fee\s*concession)\b/i.test(raw)
  ) {
    intents.push("scholarships");
  }

  // 11. Placements, Recruiters, and Packages
  if (
    /\b(placement|placements|package|packages|salary|salaries|lpa|recruit\w*|hiring|companies|campus\s*drive|jobs?|sde)\b/i.test(raw)
  ) {
    intents.push("placements");
  }

  // 12. Hostel, Mess, & Student Amenities
  if (
    /\b(hostel|hostels|mess|accommodation|staying|stay|food|living\s*facility|canteen|rooms?)\b/i.test(raw)
  ) {
    intents.push("hostel");
  }

  // 13. Lateral entry (DSY) & Branch change
  if (
    /\b(branch\s*change|change\s*branch|switch\s*branch|internal\s*sliding|branch\s*sliding)\b/i.test(raw)
  ) {
    intents.push("branch_change_dsy");
  }

  // 14. Dates, Deadlines, & Document checklist
  if (
    /\b(documents?|certificate|certificates|checklist|last\s*date|deadline|schedule|dates|how\s*to\s*apply|application\s*process|procedure|steps\s*to\s*apply)\b/i.test(raw)
  ) {
    intents.push("dates_documents");
  }

  // 15. Degree Recognition & UGC approval
  if (
    /\b(ugc|naac|valid\w*|recogni\w*|accredit\w*|govt\s*job|government\s*job|upsc|mpsc|gate|abroad|wes)\b/i.test(raw)
  ) {
    intents.push("recognition");
  }

  // 16. Coding for beginners / Non-CS
  if (
    /\b(never\s*coded|beginner\s*in\s*coding|don'?t\s*know\s*coding|no\s*coding\s*background|non\s*cs|biology\s*student|learn\s*code\s*from\s*scratch)\b/i.test(raw)
  ) {
    intents.push("coding_beginner");
  }

  // 17. Campus Location & In-Person Visit
  if (
    /\b(where\s*is\s*(?:the\s*)?(?:campus|college|iict|university)|location|address|how\s*to\s*reach|campus\s*visit|visit\s*campus|tour)\b/i.test(raw)
  ) {
    intents.push("location_visit");
  }

  // 18. Official Contact & Helplines
  if (
    /\b(contact|helpline|helplines|phone\s*number|call\s*number|telephone|email\s*id|office\s*number|helpdesk|talk\s*to\s*counsellor)\b/i.test(raw)
  ) {
    intents.push("contact_helpline");
  }

  // 19. Why choose MGM IICT
  if (
    /\b(why\s*mgm|why\s*iict|why\s*choose\s*(?:mgm|iict)|advantages\s*of\s*iict)\b/i.test(raw)
  ) {
    intents.push("why_mgm");
  }

  // 20. Dedicated program inquiries with degree level detection (M.Tech vs B.Tech vs Diploma)
  const isMTech = /\b(m\s*tech|masters?|post\s*grad\w*|pg\s*course|pg\s*program|pg\s*admissions?)\b/i.test(raw);

  const hasAiml = /\b(ai\s*(?:&|and)\s*ml|aiml|artificial\s*intelligence\s*(?:&|and)\s*machine\s*learning|\bai\b|artificial\s*intelligence)\b/i.test(raw);
  const hasDs = /\b(data\s*science|datascience|\bds\b|big\s*data)\b/i.test(raw);
  const hasCse = /\b(cse\s*\(?ai\)?|computer\s*science\s*(?:and|&)?\s*engineering|\bcse\b)\b/i.test(raw);
  const hasIt = /\b(information\s*technology|\bit\s*branch|\bit\s*engineering|\bit\s*program|\bit\b)\b/i.test(raw);
  const hasDsy = /\b(dsy|direct\s*second\s*year|lateral\s*entry|polytechnic|after\s*diploma)\b/i.test(raw);
  const hasCyber = /\b(cyber\s*security|digital\s*forensics|diploma\s*in\s*cyber)\b/i.test(raw);

  if (!intents.includes("compare_ai_cse") && !intents.includes("compare_ai_ds") && !intents.includes("compare_ai_it") && !intents.includes("compare_it_cse") && !intents.includes("compare_btech_bca")) {
    if (isMTech) {
      if (hasDs && !hasAiml) {
        intents.push("program_mtech_ds");
      } else if (hasAiml && !hasDs) {
        intents.push("program_mtech_aiml");
      } else {
        intents.push("program_mtech");
      }
    } else {
      // B.Tech / Undergraduate / Diploma
      if (hasCyber) {
        intents.push("program_cyber");
      } else if (hasDsy && !intents.includes("branch_change_dsy")) {
        intents.push("program_dsy");
      } else if (hasDs && !hasAiml) {
        intents.push("program_ds");
      } else if (hasAiml && !hasCse && !hasDs) {
        intents.push("program_aiml");
      } else if (hasCse && !hasAiml) {
        intents.push("program_cse");
      } else if (hasIt && !hasCse) {
        intents.push("program_it");
      }
    }
  }

  return Array.from(new Set(intents));
}
