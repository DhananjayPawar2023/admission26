import { createClient } from "@supabase/supabase-js";
import { buildInquiryReplyEmail, sendEmailNotification } from "./email-service.js";
import { getServiceRoleKey, getSupabaseUrl } from "./env-helper.js";

export default async function handler(req, res, { supabaseAdminClient, emailClient } = {}) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // 1. Enforce valid Supabase Bearer token
  const authHeader = req.headers.authorization || req.headers.Authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return res.status(401).json({
      error: "Authentication required: Missing Bearer token in Authorization header."
    });
  }

  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getServiceRoleKey();

  if (!supabaseAdminClient) {
    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({
        error: "Server configuration error: Database access credentials are not configured on the server."
      });
    }
  }

  const supabaseAdmin =
    supabaseAdminClient ||
    createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

  let callerId = "";
  let callerEmail = "";

  try {
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return res.status(401).json({ error: "Invalid or expired authorization token." });
    }
    callerId = userData.user.id;
    callerEmail = (userData.user.email || "").toLowerCase().trim();
  } catch (e) {
    return res.status(401).json({ error: "Token verification failed." });
  }

  // 2. Authorize caller as verified staff
  let isAuthorizedStaff = callerEmail === "dp844771@gmail.com";
  let staffDisplayName = callerEmail === "dp844771@gmail.com" ? "Dhananjay Pawar (Admissions Directorate)" : "";

  if (callerId) {
    try {
      const { data: profile } = await supabaseAdmin
        .from("staff_profiles")
        .select("role, display_name")
        .eq("user_id", callerId)
        .maybeSingle();

      if (profile?.role) {
        isAuthorizedStaff = true;
        if (profile.display_name) {
          staffDisplayName = profile.display_name;
        }
      }
    } catch (e) {
      console.warn("Notice checking staff profile:", e.message);
    }
  }

  if (!isAuthorizedStaff) {
    return res.status(403).json({
      error: "Permission denied: Only authorized admissions staff can send inquiry replies."
    });
  }

  // 3. Validate request parameters
  const body = req.body || {};
  const inquiryId = body.inquiryId || body.id;
  const replyMessage = (body.replyMessage || body.message || "").trim();
  const retryLastReply = Boolean(body.retryLastReply || body.retry);

  if (!inquiryId) {
    return res.status(400).json({ error: "Inquiry ID is required." });
  }

  if (!retryLastReply && (!replyMessage || replyMessage.length < 2)) {
    return res.status(400).json({ error: "A reply message of at least 2 characters is required." });
  }

  try {
    // 4. Fetch the inquiry record directly from the database
    const { data: inquiryRecord, error: fetchErr } = await supabaseAdmin
      .from("inquiries")
      .select("*")
      .eq("id", inquiryId)
      .maybeSingle();

    if (fetchErr || !inquiryRecord) {
      return res.status(404).json({ error: "Inquiry record not found in admissions database." });
    }

    const recipientEmail = inquiryRecord.email;
    const recipientName = inquiryRecord.student_name;
    const refCode = inquiryRecord.reference_code || "IICT-2026";
    const programInterest = inquiryRecord.program_interest;
    const currentTranscript = inquiryRecord.question || "";

    const advisorName = staffDisplayName || "IICT Admissions Advisor";
    const nowIso = new Date().toISOString();
    const formattedTimestamp = new Date().toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    });

    let activeReplyText = replyMessage;
    let updatedTranscript = currentTranscript;

    // 5. If this is a new reply, append to the inquiry transcript with sender and timestamp
    if (!retryLastReply) {
      const turnEntry = `\n\nAdvisor (${advisorName} · ${formattedTimestamp}): ${replyMessage}`;
      updatedTranscript = currentTranscript.trim() ? `${currentTranscript.trim()}${turnEntry}` : turnEntry.trim();

      // Save to database FIRST to preserve transcript
      const updatePayload = {
        question: updatedTranscript,
        status: inquiryRecord.status === "new" ? "contacted" : inquiryRecord.status,
        updated_at: nowIso
      };

      const { error: saveErr } = await supabaseAdmin
        .from("inquiries")
        .update(updatePayload)
        .eq("id", inquiryRecord.id);

      if (saveErr) {
        return res.status(500).json({
          error: `Failed to save reply in inquiry transcript: ${saveErr.message}`
        });
      }

      inquiryRecord.question = updatedTranscript;
      inquiryRecord.status = updatePayload.status;
      inquiryRecord.updated_at = nowIso;
    } else {
      // Retrying: extract the last Advisor reply from the transcript to avoid re-appending
      const advisorTurns = currentTranscript.split(/(?:Advisor|Counsellor)[^:]*:\s*/i);
      if (advisorTurns.length > 1) {
        activeReplyText = advisorTurns[advisorTurns.length - 1].trim();
      }
      if (!activeReplyText) {
        activeReplyText = "Your admissions inquiry is being addressed by the IICT Admissions Committee.";
      }
    }

    // 6. Build the email (only containing the counselor reply, NOT the full transcript)
    const emailContent = buildInquiryReplyEmail({
      studentName: recipientName,
      referenceCode: refCode,
      programInterest: programInterest,
      replyMessage: activeReplyText,
      advisorName
    });

    // 7. Dispatch the email notification
    let emailResult = null;
    if (emailClient && typeof emailClient.sendEmail === "function") {
      emailResult = await emailClient.sendEmail({
        to: recipientEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text
      });
    } else {
      emailResult = await sendEmailNotification({
        to: recipientEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        idempotencyKey: `inquiry-reply-${refCode}-${Date.now()}`
      });
    }

    // 8. Update notification tracking on the inquiry record
    const notificationUpdate = {
      last_reply_sent_at: nowIso,
      last_reply_email_status: emailResult.status,
      last_reply_email_error: emailResult.error || null
    };

    try {
      await supabaseAdmin
        .from("inquiries")
        .update(notificationUpdate)
        .eq("id", inquiryRecord.id);
    } catch (colErr) {
      console.warn("Notice updating notification tracking columns on inquiries:", colErr.message);
    }

    // 9. Record in notification_logs audit table if present
    try {
      await supabaseAdmin.from("notification_logs").insert({
        recipient_email: recipientEmail,
        notification_type: "inquiry_counsellor_reply",
        reference_id: refCode,
        subject: emailContent.subject,
        body_preview: activeReplyText.slice(0, 300),
        status: emailResult.status,
        provider: emailResult.provider || "none",
        error_message: emailResult.error || null,
        sent_by: callerId || null
      });
    } catch {}

    const updatedInquiry = {
      ...inquiryRecord,
      ...notificationUpdate
    };

    return res.status(200).json({
      success: true,
      inquiry: updatedInquiry,
      emailDelivery: {
        status: emailResult.status,
        delivered: emailResult.delivered,
        provider: emailResult.provider,
        sandboxRouted: Boolean(emailResult.sandboxRouted),
        intendedRecipient: emailResult.intendedRecipient || null,
        actualRecipient: emailResult.actualRecipient || null,
        message: emailResult.message,
        error: emailResult.error || null
      }
    });
  } catch (err) {
    console.error("reply-inquiry error:", err);
    return res.status(500).json({ error: err.message || "Failed to process inquiry reply." });
  }
}
