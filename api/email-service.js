/**
 * MGM UNIVERSITY - IICT ADMISSIONS
 * Server-Side Email Service & Notification Formatter
 * 
 * - Delivers emails via Resend API (standard HTTPS REST fetch, zero extra dependencies).
 * - Supports test mode / dry run without sending external network messages.
 * - Enforces strict server-side secret management: NEVER uses VITE_ prefixes or logs API keys.
 */

export function getStatusDetails(status) {
  const s = (status || "").toLowerCase().trim();
  switch (s) {
    case "submitted":
      return {
        label: "Application Received · Under Initial Review",
        color: "#1E40AF",
        bgColor: "#EFF6FF",
        nextStep: "Your application has been received by the IICT Admissions Committee. The administrative office is compiling applicant dossiers for committee scrutiny.",
        isFinalOffer: false,
        disclaimer: "This confirmation indicates that your application has been received for evaluation. It does not constitute an offer of admission."
      };
    case "under_scrutiny":
      return {
        label: "Under Committee Scrutiny",
        color: "#B45309",
        bgColor: "#FFFBEB",
        nextStep: "The faculty scrutiny committee is reviewing your qualifying marks (12th / Diploma / Entrance exam). An admissions counselor will reach out to you if any additional documents are needed.",
        isFinalOffer: false,
        disclaimer: "This status confirms active academic scrutiny. It does not constitute an offer of admission."
      };
    case "documents_verified":
      return {
        label: "Documents Verified",
        color: "#15803D",
        bgColor: "#F0FDF4",
        nextStep: "Your submitted academic credentials have been verified against MGM University eligibility norms. Your profile is queued for official merit list ranking.",
        isFinalOffer: false,
        disclaimer: "Document verification confirms eligibility for merit evaluation. It does not constitute a guaranteed seat allocation or admission offer."
      };
    case "merit_listed":
      return {
        label: "Merit Listed",
        color: "#6B21A8",
        bgColor: "#FAF5FF",
        nextStep: "You have qualified for the provisional merit list. Please attend your scheduled admissions counseling round or keep your registered mobile number accessible for faculty outreach.",
        isFinalOffer: false,
        disclaimer: "Merit listing indicates qualification for the counseling stage and seat allocation consideration subject to seat availability."
      };
    case "provisionally_approved":
      return {
        label: "Provisionally Approved for Admission",
        color: "#047857",
        bgColor: "#ECFDF5",
        nextStep: "Official provisional admission offer approved by the Directorate. Please visit the IICT Admissions Directorate with your original mark sheets and complete your seat acceptance / fee installment within the deadline to confirm your enrollment.",
        isFinalOffer: true,
        disclaimer: "This is an official provisional offer of admission subject to verification of original certificates and fee submission."
      };
    default:
      return {
        label: status || "Under Review",
        color: "#475569",
        bgColor: "#F8FAFC",
        nextStep: "Your application is being processed by the admissions department.",
        isFinalOffer: false,
        disclaimer: "Status updates reflect ongoing review stages and do not constitute an admission decision unless officially marked as Provisionally Approved."
      };
  }
}

/**
 * Builds HTML and plain text for Application Status Updates
 */
export function buildApplicationStatusEmail({ studentName, applicationNumber, programChoice, status }) {
  const details = getStatusDetails(status);
  const portalUrl = process.env.PUBLIC_APP_URL || "https://admission.mgmu.ac.in";

  const subject = `MGM University IICT: Application Update [${applicationNumber}] - ${details.label}`;

  const text = `
Dear ${studentName || "Applicant"},

Greetings from the Institute of Information and Communication Technology (IICT), MGM University.

This is an official status update regarding your direct application for admission:

Application Reference: ${applicationNumber}
Selected Program: ${programChoice || "Engineering Program"}
Current Status: ${details.label}

NEXT STEP:
${details.nextStep}

IMPORTANT NOTICE:
${details.disclaimer}

You can track your application status anytime using your Application Reference and registered 10-digit mobile number at:
${portalUrl}

Admissions Helpline: +91 940 449 4299 (Mon–Sat, 10 AM – 5 PM)
Email: admissions@mgmu.ac.in
MGM University Campus, Chhatrapati Sambhajinagar, Maharashtra
`.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #001E32;">
  <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,30,50,0.04);">
    
    <!-- Header -->
    <div style="background-color: #001E32; padding: 24px 30px; text-align: left; border-bottom: 3px solid #C05A21;">
      <h1 style="margin: 0; font-size: 18px; color: #ffffff; font-weight: 700; letter-spacing: 0.5px;">MGM UNIVERSITY</h1>
      <p style="margin: 4px 0 0; font-size: 13px; color: #CBD5E1;">Institute of Information & Communication Technology (IICT)</p>
    </div>

    <!-- Body -->
    <div style="padding: 30px;">
      <p style="font-size: 15px; line-height: 1.5; margin-top: 0;">Dear <strong>${studentName || "Applicant"}</strong>,</p>
      
      <p style="font-size: 14px; line-height: 1.6; color: #334155;">
        Your direct application for the <strong>2026–27 Academic Intake</strong> at IICT has been reviewed by the admissions committee.
      </p>

      <!-- Details Card -->
      <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 18px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 6px 0; color: #64748B; width: 40%;">Application ID:</td>
            <td style="padding: 6px 0; font-weight: 700; color: #001E32; font-family: monospace; font-size: 14px;">${applicationNumber}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748B;">Academic Program:</td>
            <td style="padding: 6px 0; font-weight: 600; color: #001E32;">${programChoice || "Engineering Program"}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748B;">Application Status:</td>
            <td style="padding: 6px 0;">
              <span style="display: inline-block; background-color: ${details.bgColor}; color: ${details.color}; font-weight: 700; font-size: 12px; padding: 4px 10px; border-radius: 6px; border: 1px solid ${details.color}33;">
                ${details.label}
              </span>
            </td>
          </tr>
        </table>
      </div>

      <!-- Next Steps -->
      <div style="margin: 22px 0;">
        <h3 style="font-size: 14px; color: #001E32; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.5px;">Next Step for Applicant</h3>
        <p style="font-size: 13.5px; line-height: 1.6; color: #1E293B; margin: 0; background-color: #F1F5F9; padding: 14px; border-radius: 6px; border-left: 3px solid #C05A21;">
          ${details.nextStep}
        </p>
      </div>

      <!-- Disclaimer Note -->
      <div style="margin: 20px 0; padding: 12px 14px; background-color: #FFFBEB; border: 1px solid #FDE68A; border-radius: 6px;">
        <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #92400E;">
          <strong>Notice:</strong> ${details.disclaimer}
        </p>
      </div>

      <!-- Action Button -->
      <div style="text-align: center; margin: 30px 0 10px;">
        <a href="${portalUrl}" style="display: inline-block; background-color: #C05A21; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 13px;">
          Track Application on Portal &rarr;
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #F1F5F9; padding: 20px 30px; font-size: 11.5px; color: #64748B; line-height: 1.5; border-top: 1px solid #E2E8F0;">
      <p style="margin: 0;"><strong>IICT Admissions Directorate</strong> &middot; MGM University Campus</p>
      <p style="margin: 4px 0 0;">Helpline: +91 940 449 4299 (10 AM &ndash; 5 PM) &middot; admissions@mgmu.ac.in</p>
      <p style="margin: 4px 0 0;">Chhatrapati Sambhajinagar (Aurangabad), Maharashtra 431003</p>
    </div>

  </div>
</body>
</html>
`.trim();

  return { subject, text, html };
}

/**
 * Builds HTML and plain text for Inquiry Counselor Replies
 * Note: Only includes the counselor's reply message and context; does NOT send full transcript.
 */
export function buildInquiryReplyEmail({ studentName, referenceCode, programInterest, replyMessage, advisorName }) {
  const portalUrl = process.env.PUBLIC_APP_URL || "https://admission.mgmu.ac.in";
  const advisor = advisorName || "IICT Admissions Advisor";

  const subject = `MGM University IICT: Counsellor Response to Inquiry [${referenceCode || "IICT"}]`;

  const text = `
Dear ${studentName || "Student"},

Greetings from MGM University Institute of Information and Communication Technology (IICT).

An admissions advisor has responded to your admissions inquiry regarding ${programInterest || "programs"}:

ADVISOR RESPONSE:
"${replyMessage}"
— ${advisor}, IICT Admissions Committee

Inquiry Reference: ${referenceCode || "IICT-2026"}
Program Topic: ${programInterest || "Admissions Guidance"}

If you have additional questions or wish to schedule an in-person campus visit, feel free to reply to this email or contact our helpline:
Admissions Helpline: +91 940 449 4299 (Mon–Sat, 10 AM – 5 PM)
Admissions Portal: ${portalUrl}

MGM University, Chhatrapati Sambhajinagar, Maharashtra
`.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #001E32;">
  <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,30,50,0.04);">
    
    <!-- Header -->
    <div style="background-color: #001E32; padding: 24px 30px; text-align: left; border-bottom: 3px solid #C05A21;">
      <h1 style="margin: 0; font-size: 18px; color: #ffffff; font-weight: 700; letter-spacing: 0.5px;">MGM UNIVERSITY</h1>
      <p style="margin: 4px 0 0; font-size: 13px; color: #CBD5E1;">Institute of Information & Communication Technology (IICT)</p>
    </div>

    <!-- Body -->
    <div style="padding: 30px;">
      <p style="font-size: 15px; line-height: 1.5; margin-top: 0;">Dear <strong>${studentName || "Student"}</strong>,</p>
      
      <p style="font-size: 14px; line-height: 1.6; color: #334155;">
        Thank you for your inquiry regarding admissions at IICT MGM University. An official admissions counselor has reviewed your query and shared the response below:
      </p>

      <!-- Counsellor Reply Card -->
      <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-left: 4px solid #16A34A; border-radius: 8px; padding: 20px; margin: 22px 0;">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #15803D; letter-spacing: 0.5px; margin-bottom: 8px;">
          Admissions Advisor Reply
        </div>
        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #064E3B; white-space: pre-wrap;">
          ${replyMessage.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
        </p>
        <div style="margin-top: 14px; font-size: 12px; color: #047857; font-weight: 600;">
          &mdash; ${advisor}
        </div>
      </div>

      <!-- Reference Metadata -->
      <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 12px 16px; margin: 18px 0; font-size: 12.5px; color: #475569;">
        <div><strong>Inquiry Reference:</strong> ${referenceCode || "IICT-2026"}</div>
        <div style="margin-top: 4px;"><strong>Academic Interest:</strong> ${programInterest || "Engineering Admissions"}</div>
      </div>

      <!-- Action Button -->
      <div style="text-align: center; margin: 26px 0 10px;">
        <a href="${portalUrl}" style="display: inline-block; background-color: #C05A21; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 13px;">
          Visit Admissions Portal &rarr;
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #F1F5F9; padding: 20px 30px; font-size: 11.5px; color: #64748B; line-height: 1.5; border-top: 1px solid #E2E8F0;">
      <p style="margin: 0;"><strong>IICT Admissions Helpdesk</strong> &middot; MGM University Campus</p>
      <p style="margin: 4px 0 0;">Helpline: +91 940 449 4299 (10 AM &ndash; 5 PM) &middot; admissions@mgmu.ac.in</p>
      <p style="margin: 4px 0 0;">Chhatrapati Sambhajinagar, Maharashtra 431003</p>
    </div>

  </div>
</body>
</html>
`.trim();

  return { subject, text, html };
}

/**
 * Sends an email notification using configured server provider
 * Supports: Resend REST API, Test Mode (dry run/mock), or Graceful Unconfigured State.
 */
export async function sendEmailNotification({
  to,
  subject,
  html,
  text,
  idempotencyKey,
  testMode = false,
  customFetch = null
}) {
  const fetchFn = customFetch || globalThis.fetch;
  const isTestMode = testMode || process.env.EMAIL_TEST_MODE === "true";

  // Validate recipient email
  const cleanEmail = (to || "").trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return {
      delivered: false,
      status: "failed",
      error: "Invalid recipient email address."
    };
  }

  // 1. Dry run / Test Mode: do not send real network emails during automated tests or synthetic runs
  if (
    isTestMode ||
    cleanEmail.endsWith("@example.com") ||
    cleanEmail.endsWith("@test.com")
  ) {
    return {
      delivered: true,
      status: "mock_sent",
      provider: "mock",
      message: `[TEST MODE] Notification prepared for ${cleanEmail} (mock delivery).`,
      id: `mock-${Date.now()}`
    };
  }

  // 2. Check Resend API Key
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || "IICT Admissions <onboarding@resend.dev>";

  if (resendApiKey) {
    try {
      const response = await fetchFn("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [cleanEmail],
          subject,
          html,
          text
        })
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        return {
          delivered: true,
          status: "sent",
          provider: "resend",
          id: data?.id,
          message: `Email successfully delivered to ${cleanEmail}.`
        };
      } else {
        const errorMsg = data?.message || data?.error || `Resend API error (HTTP ${response.status})`;
        return {
          delivered: false,
          status: "failed",
          provider: "resend",
          error: errorMsg,
          message: `Email delivery failed: ${errorMsg}`
        };
      }
    } catch (netErr) {
      return {
        delivered: false,
        status: "failed",
        provider: "resend",
        error: netErr.message,
        message: `Network error connecting to email provider: ${netErr.message}`
      };
    }
  }

  // 3. No email provider configured
  return {
    delivered: false,
    status: "not_configured",
    provider: "none",
    error: "No email provider configured in server environment.",
    message: "Email provider is not configured. Set RESEND_API_KEY in server environment variables to enable live delivery."
  };
}
