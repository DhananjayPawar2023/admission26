import { createClient } from "@supabase/supabase-js";
import { buildApplicationConfirmationEmail, sendEmailNotification } from "./email-service.js";
import { getServiceRoleKey, getSupabaseUrl } from "./env-helper.js";

export default async function handler(req, res, { supabaseAdminClient, emailClient } = {}) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "OPTIONS,POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const applicationNumber = String(req.body?.application_number || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const phone = String(req.body?.phone || "").replace(/\D/g, "").slice(-10);

  if (!/^MGMU-APP-\d{4}-[A-Z0-9]{5}$/i.test(applicationNumber) || !email.includes("@") || phone.length !== 10) {
    return res.status(400).json({ error: "A valid application reference, email, and registered mobile number are required." });
  }

  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getServiceRoleKey();
  if (!supabaseAdminClient && (!supabaseUrl || !serviceRoleKey)) {
    return res.status(500).json({ error: "Server configuration error: application email service is unavailable." });
  }

  const supabaseAdmin = supabaseAdminClient || createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    // Confirm all lookup fields against the saved record; never accept a client-supplied recipient.
    const { data: application, error: lookupError } = await supabaseAdmin
      .from("applications")
      .select("id, application_number, student_name, email, phone, program_choice, degree_level, category, qualifying_exam, marks_percentage, entrance_exam, entrance_score, city, state, status")
      .eq("application_number", applicationNumber)
      .eq("email", email)
      .eq("phone", phone)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!application) return res.status(404).json({ error: "No matching application was found." });

    const { data: previousLog } = await supabaseAdmin
      .from("notification_logs")
      .select("status")
      .eq("reference_id", application.application_number)
      .eq("notification_type", "application_submission_confirmation")
      .in("status", ["sent", "mock_sent"])
      .limit(1)
      .maybeSingle();

    if (previousLog) {
      return res.status(200).json({
        success: true,
        emailDelivery: { status: "skipped_duplicate", delivered: true, message: "Application confirmation was already sent." }
      });
    }

    const emailContent = buildApplicationConfirmationEmail(application);
    const emailResult = emailClient && typeof emailClient.sendEmail === "function"
      ? await emailClient.sendEmail({
          to: application.email,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
          idempotencyKey: `application-confirmation-${application.id}`
        })
      : await sendEmailNotification({
          to: application.email,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
          idempotencyKey: `application-confirmation-${application.id}`
        });

    try {
      await supabaseAdmin.from("notification_logs").insert({
        recipient_email: application.email,
        notification_type: "application_submission_confirmation",
        reference_id: application.application_number,
        subject: emailContent.subject,
        body_preview: emailContent.text.slice(0, 300),
        status: emailResult.status || "failed",
        provider: emailResult.provider || "none",
        error_message: emailResult.error || null
      });
    } catch (logError) {
      console.warn("Could not record application confirmation email:", logError.message);
    }

    return res.status(200).json({
      success: true,
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
  } catch (error) {
    console.error("application-confirmation error:", error);
    return res.status(500).json({ error: "Could not process the application confirmation email." });
  }
}
