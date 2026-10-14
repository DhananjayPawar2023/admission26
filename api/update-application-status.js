import { createClient } from "@supabase/supabase-js";
import { buildApplicationStatusEmail, sendEmailNotification } from "./email-service.js";
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

  if (!isAuthorizedStaff && callerId) {
    try {
      const { data: profile } = await supabaseAdmin
        .from("staff_profiles")
        .select("role")
        .eq("user_id", callerId)
        .maybeSingle();

      if (profile?.role) {
        isAuthorizedStaff = true;
      }
    } catch (e) {
      console.warn("Notice checking staff profile:", e.message);
    }
  }

  if (!isAuthorizedStaff) {
    return res.status(403).json({
      error: "Permission denied: Only authorized staff can update application statuses and send notifications."
    });
  }

  // 3. Parse and validate request parameters
  const body = req.body || {};
  const applicationId = body.applicationId || body.id;
  const applicationNumber = (body.applicationNumber || body.application_number || "").trim();
  const nextStatus = (body.nextStatus || body.status || "").toLowerCase().trim();
  const scrutinyNotes = body.scrutinyNotes !== undefined ? body.scrutinyNotes : body.scrutiny_notes;
  const assignedTo = body.assignedTo !== undefined ? body.assignedTo : body.assigned_to;
  const forceRetryEmail = Boolean(body.forceRetryEmail || body.force_retry);

  if (!applicationId && !applicationNumber) {
    return res.status(400).json({ error: "Application ID or Application Number is required." });
  }

  if (!nextStatus && !forceRetryEmail && assignedTo === undefined && scrutinyNotes === undefined) {
    return res.status(400).json({ error: "A valid target status or update field is required." });
  }

  try {
    // 4. Fetch the application record directly from the database (trusted source for recipient email)
    let query = supabaseAdmin.from("applications").select("*");
    if (applicationId) {
      query = query.eq("id", applicationId);
    } else {
      query = query.eq("application_number", applicationNumber);
    }

    const { data: appRecord, error: fetchErr } = await query.maybeSingle();

    if (fetchErr || !appRecord) {
      return res.status(404).json({ error: "Application record not found in admissions database." });
    }

    const currentStatus = appRecord.status;
    const targetStatus = nextStatus || currentStatus;
    const isStatusChanged = targetStatus !== currentStatus;
    const notesToSave = scrutinyNotes !== undefined ? scrutinyNotes : (appRecord.scrutiny_notes || "");
    const isAssignChanged = assignedTo !== undefined && assignedTo !== appRecord.assigned_to;

    // 5. Prevent duplicate emails: if status is unchanged and this is not a force-retry, skip email
    if (!isStatusChanged && !forceRetryEmail) {
      // If only notes or reviewer assigned changed, update DB without emailing
      const partialUpdate = {};
      if (scrutinyNotes !== undefined && scrutinyNotes !== appRecord.scrutiny_notes) {
        partialUpdate.scrutiny_notes = notesToSave;
      }
      if (isAssignChanged) {
        partialUpdate.assigned_to = assignedTo || null;
      }

      if (Object.keys(partialUpdate).length > 0) {
        partialUpdate.updated_at = new Date().toISOString();
        await supabaseAdmin
          .from("applications")
          .update(partialUpdate)
          .eq("id", appRecord.id);
        Object.assign(appRecord, partialUpdate);
      }

      return res.status(200).json({
        success: true,
        updated: Object.keys(partialUpdate).length > 0,
        application: { ...appRecord, scrutiny_notes: notesToSave, ...(assignedTo !== undefined ? { assigned_to: assignedTo || null } : {}) },
        emailDelivery: {
          status: "skipped_duplicate",
          message: "Application status was not changed. Email notification skipped to avoid duplicate applicant messages."
        }
      });
    }

    // 6. Save new status in database FIRST to preserve status regardless of email delivery
    const updatePayload = {
      status: targetStatus,
      scrutiny_notes: notesToSave,
      ...(assignedTo !== undefined ? { assigned_to: assignedTo || null } : {}),
      updated_at: new Date().toISOString()
    };

    const { error: updateErr } = await supabaseAdmin
      .from("applications")
      .update(updatePayload)
      .eq("id", appRecord.id);

    if (updateErr) {
      return res.status(500).json({
        error: `Failed to save application status: ${updateErr.message}`
      });
    }

    // 7. Format and dispatch the status update email to the applicant's registered address
    const recipientEmail = appRecord.email;
    const recipientName = appRecord.student_name;
    const programChoice = appRecord.program_choice;
    const appNum = appRecord.application_number;

    const emailContent = buildApplicationStatusEmail({
      studentName: recipientName,
      applicationNumber: appNum,
      programChoice: programChoice,
      status: targetStatus,
      previousStatus: currentStatus
    });

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
        idempotencyKey: `app-status-${appNum}-${targetStatus}-${forceRetryEmail ? Date.now() : "initial"}`
      });
    }

    // 8. Update notification tracking metadata on the application record
    const notificationUpdate = {
      last_notification_status: emailResult.status,
      last_notification_error: emailResult.error || null,
      last_notification_at: new Date().toISOString(),
      ...(emailResult.delivered ? { notified_status: targetStatus } : {})
    };

    try {
      await supabaseAdmin
        .from("applications")
        .update(notificationUpdate)
        .eq("id", appRecord.id);
    } catch (colErr) {
      console.warn("Notice updating notification tracking columns on applications:", colErr.message);
    }

    // 9. Record in notification_logs audit table if present
    try {
      await supabaseAdmin.from("notification_logs").insert({
        recipient_email: recipientEmail,
        notification_type: "application_status_update",
        reference_id: appNum,
        subject: emailContent.subject,
        body_preview: emailContent.text.slice(0, 300),
        status: emailResult.status,
        provider: emailResult.provider || "none",
        error_message: emailResult.error || null,
        sent_by: callerId || null
      });
    } catch {}

    const updatedApplication = {
      ...appRecord,
      ...updatePayload,
      ...notificationUpdate
    };

    return res.status(200).json({
      success: true,
      updated: true,
      application: updatedApplication,
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
    console.error("update-application-status error:", err);
    return res.status(500).json({ error: err.message || "Failed to process application status update." });
  }
}
