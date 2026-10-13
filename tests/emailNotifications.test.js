import test from "node:test";
import assert from "node:assert/strict";
import {
  buildApplicationStatusEmail,
  buildInquiryReplyEmail,
  sendEmailNotification,
  getStatusDetails
} from "../api/email-service.js";
import updateAppStatusHandler from "../api/update-application-status.js";
import replyInquiryHandler from "../api/reply-inquiry.js";

// Mock HTTP helper
function createMockHttp({ method = "POST", headers = {}, body = {} } = {}) {
  let statusCode = 200;
  let responseData = null;
  const res = {
    setHeader: () => res,
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      responseData = data;
      return res;
    },
    end: () => res
  };

  const req = { method, headers, body };
  return { req, res, getStatus: () => statusCode, getData: () => responseData };
}

// ── 1. Unit Tests for Email Content Formatting & Accurate Wording ──────────────
test("Email Wording: scrutiny and verification stages do NOT imply admission", () => {
  const scrutinyDetails = getStatusDetails("under_scrutiny");
  assert.equal(scrutinyDetails.isFinalOffer, false);
  assert.ok(scrutinyDetails.disclaimer.includes("does not constitute an offer of admission"));

  const verifiedDetails = getStatusDetails("documents_verified");
  assert.equal(verifiedDetails.isFinalOffer, false);
  assert.ok(verifiedDetails.disclaimer.includes("does not constitute a guaranteed seat allocation or admission offer"));

  const meritDetails = getStatusDetails("merit_listed");
  assert.equal(meritDetails.isFinalOffer, false);
  assert.ok(meritDetails.disclaimer.includes("subject to seat availability"));

  // Only provisionally_approved is an official offer
  const approvedDetails = getStatusDetails("provisionally_approved");
  assert.equal(approvedDetails.isFinalOffer, true);
  assert.ok(approvedDetails.label.includes("Approved for Admission"));
});

test("Application Status Email: includes application reference, program, status and next step", () => {
  const email = buildApplicationStatusEmail({
    studentName: "Aditya Patil",
    applicationNumber: "MGMU-APP-2026-90432",
    programChoice: "B.Tech in Artificial Intelligence & Machine Learning",
    status: "under_scrutiny"
  });

  assert.ok(email.subject.includes("MGMU-APP-2026-90432"));
  assert.ok(email.subject.includes("Under Committee Scrutiny"));
  assert.ok(email.text.includes("MGMU-APP-2026-90432"));
  assert.ok(email.text.includes("Aditya Patil"));
  assert.ok(email.text.includes("B.Tech in Artificial Intelligence & Machine Learning"));
  assert.ok(email.text.includes("NEXT STEP:"));
  assert.ok(email.text.includes("IMPORTANT NOTICE:"));
  assert.ok(email.html.includes("Under Committee Scrutiny"));
});

test("Inquiry Reply Email: includes reply message and does NOT include full transcript", () => {
  const email = buildInquiryReplyEmail({
    studentName: "Snehal Kulkarni",
    referenceCode: "IICT-2026-7819",
    programInterest: "M.Tech Data Science",
    replyMessage: "Your GATE qualification makes you eligible for our departmental research stipend.",
    advisorName: "Prof. Deshmukh"
  });

  assert.ok(email.subject.includes("IICT-2026-7819"));
  assert.ok(email.text.includes("Snehal Kulkarni"));
  assert.ok(email.text.includes("Your GATE qualification makes you eligible for our departmental research stipend."));
  assert.ok(email.text.includes("Prof. Deshmukh"));
  // Ensure full previous chat turns are NOT automatically dumped in the reply body
  assert.ok(!email.text.includes("Student:"));
  assert.ok(email.html.includes("Admissions Advisor Reply"));
});

// ── 2. Unit Tests for Email Service & Delivery Provider ────────────────────────
test("Email Service: test mode / dry run returns mock_sent without network send", async () => {
  const result = await sendEmailNotification({
    to: "candidate@example.com",
    subject: "Test Subject",
    text: "Test content",
    testMode: true
  });

  assert.equal(result.delivered, true);
  assert.equal(result.status, "mock_sent");
  assert.equal(result.provider, "mock");
});

test("Email Service: reports not_configured gracefully when server secret is absent", async () => {
  const originalKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;

  const result = await sendEmailNotification({
    to: "realstudent@gmail.com",
    subject: "Live Notification",
    text: "Sample update",
    testMode: false
  });

  assert.equal(result.delivered, false);
  assert.equal(result.status, "not_configured");
  assert.ok(result.message.includes("RESEND_API_KEY"));

  if (originalKey) process.env.RESEND_API_KEY = originalKey;
});

// ── 3. Unit Tests for update-application-status Server Route ────────────────────
test("update-application-status: rejects unauthenticated caller with 401", async () => {
  const { req, res, getStatus } = createMockHttp({
    method: "POST",
    headers: {},
    body: { applicationNumber: "MGMU-APP-2026-00001", nextStatus: "under_scrutiny" }
  });

  await updateAppStatusHandler(req, res);
  assert.equal(getStatus(), 401);
});

test("update-application-status: saves status, prevents duplicates, and allows retry", async () => {
  let savedStatus = "submitted";
  let savedNotes = "";
  let lastNotificationStatus = null;

  const mockAppRecord = {
    id: "app-uuid-1234",
    application_number: "MGMU-APP-2026-11223",
    student_name: "Rohan Deshpande",
    email: "rohan@example.com",
    program_choice: "B.Tech Information Technology",
    status: "submitted",
    scrutiny_notes: ""
  };

  const mockAdminClient = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "admin-id-1", email: "dp844771@gmail.com" } },
        error: null
      })
    },
    from: (table) => {
      if (table === "applications") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { ...mockAppRecord, status: savedStatus, scrutiny_notes: savedNotes },
                error: null
              })
            })
          }),
          update: (payload) => ({
            eq: async () => {
              if (payload.status) savedStatus = payload.status;
              if (payload.scrutiny_notes !== undefined) savedNotes = payload.scrutiny_notes;
              if (payload.last_notification_status) lastNotificationStatus = payload.last_notification_status;
              return { data: null, error: null };
            }
          })
        };
      }
      return {
        insert: async () => ({ data: null, error: null })
      };
    }
  };

  const mockEmailClient = {
    sendEmail: async ({ to, subject }) => {
      return { delivered: true, status: "sent", provider: "mock", message: `Sent to ${to}` };
    }
  };

  // Case A: Status change from submitted -> under_scrutiny
  const { req: req1, res: res1, getStatus: getStatus1, getData: getData1 } = createMockHttp({
    method: "POST",
    headers: { authorization: "Bearer valid-superadmin-token" },
    body: {
      applicationNumber: "MGMU-APP-2026-11223",
      nextStatus: "under_scrutiny",
      scrutinyNotes: "12th marksheet verified."
    }
  });

  await updateAppStatusHandler(req1, res1, {
    supabaseAdminClient: mockAdminClient,
    emailClient: mockEmailClient
  });

  assert.equal(getStatus1(), 200);
  assert.equal(savedStatus, "under_scrutiny");
  assert.equal(savedNotes, "12th marksheet verified.");
  assert.equal(getData1()?.emailDelivery?.status, "sent");

  // Case B: Repeat request with SAME status ("under_scrutiny") -> Must skip duplicate email!
  const { req: req2, res: res2, getStatus: getStatus2, getData: getData2 } = createMockHttp({
    method: "POST",
    headers: { authorization: "Bearer valid-superadmin-token" },
    body: {
      applicationNumber: "MGMU-APP-2026-11223",
      nextStatus: "under_scrutiny"
    }
  });

  await updateAppStatusHandler(req2, res2, {
    supabaseAdminClient: mockAdminClient,
    emailClient: mockEmailClient
  });

  assert.equal(getStatus2(), 200);
  assert.equal(getData2()?.updated, false);
  assert.equal(getData2()?.emailDelivery?.status, "skipped_duplicate");

  // Case C: Explicit force-retry -> allows re-sending notification without corrupting status
  const { req: req3, res: res3, getStatus: getStatus3, getData: getData3 } = createMockHttp({
    method: "POST",
    headers: { authorization: "Bearer valid-superadmin-token" },
    body: {
      applicationNumber: "MGMU-APP-2026-11223",
      nextStatus: "under_scrutiny",
      forceRetryEmail: true
    }
  });

  await updateAppStatusHandler(req3, res3, {
    supabaseAdminClient: mockAdminClient,
    emailClient: mockEmailClient
  });

  assert.equal(getStatus3(), 200);
  assert.equal(getData3()?.emailDelivery?.status, "sent");
});

// ── 4. Unit Tests for reply-inquiry Server Route ───────────────────────────────
test("reply-inquiry: appends reply to transcript, emails reply, and retry does not duplicate turn", async () => {
  let savedQuestion = "Student: What is the fee for B.Tech AI & ML?";

  const mockInquiryRecord = {
    id: "inq-uuid-5566",
    reference_code: "IICT-2026-9900",
    student_name: "Kavita Rao",
    email: "kavita@example.com",
    program_interest: "B.Tech AI & ML",
    question: savedQuestion,
    status: "new"
  };

  const mockAdminClient = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "teacher-id-2", email: "teacher@mgmu.ac.in" } },
        error: null
      })
    },
    from: (table) => {
      if (table === "staff_profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { role: "teacher", display_name: "Prof. Anjali Mehta" },
                error: null
              })
            })
          })
        };
      }
      if (table === "inquiries") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { ...mockInquiryRecord, question: savedQuestion },
                error: null
              })
            })
          }),
          update: (payload) => ({
            eq: async () => {
              if (payload.question) savedQuestion = payload.question;
              return { data: null, error: null };
            }
          })
        };
      }
      return {
        insert: async () => ({ data: null, error: null })
      };
    }
  };

  let emailSentCount = 0;
  let lastEmailedBody = "";
  const mockEmailClient = {
    sendEmail: async ({ to, text }) => {
      emailSentCount++;
      lastEmailedBody = text;
      return { delivered: true, status: "sent", provider: "mock", message: `Sent to ${to}` };
    }
  };

  // Step 1: Send reply
  const { req: req1, res: res1, getStatus: getStatus1 } = createMockHttp({
    method: "POST",
    headers: { authorization: "Bearer valid-teacher-token" },
    body: {
      inquiryId: "inq-uuid-5566",
      replyMessage: "The annual tuition fee for B.Tech AI & ML is ₹1,50,000 per year."
    }
  });

  await replyInquiryHandler(req1, res1, {
    supabaseAdminClient: mockAdminClient,
    emailClient: mockEmailClient
  });

  assert.equal(getStatus1(), 200);
  assert.equal(emailSentCount, 1);
  assert.ok(savedQuestion.includes("Advisor (Prof. Anjali Mehta"));
  assert.ok(savedQuestion.includes("₹1,50,000 per year"));
  assert.ok(lastEmailedBody.includes("₹1,50,000 per year"));

  const transcriptLengthAfterFirstReply = savedQuestion.length;

  // Step 2: Retry sending email (retryLastReply: true) -> Must NOT re-append reply to transcript!
  const { req: req2, res: res2, getStatus: getStatus2 } = createMockHttp({
    method: "POST",
    headers: { authorization: "Bearer valid-teacher-token" },
    body: {
      inquiryId: "inq-uuid-5566",
      retryLastReply: true
    }
  });

  await replyInquiryHandler(req2, res2, {
    supabaseAdminClient: mockAdminClient,
    emailClient: mockEmailClient
  });

  assert.equal(getStatus2(), 200);
  assert.equal(emailSentCount, 2);
  // Transcript length MUST be identical (no duplicate message turn added!)
  assert.equal(savedQuestion.length, transcriptLengthAfterFirstReply);
});
