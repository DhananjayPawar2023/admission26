import { createClient } from "@supabase/supabase-js";
import { getServiceRoleKey, getSupabaseUrl } from "./env-helper.js";

export default async function handler(req, res, { supabaseAdminClient } = {}) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const authHeader = req.headers.authorization || req.headers.Authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return res.status(401).json({ error: "Missing authorization Bearer token." });
  }

  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getServiceRoleKey();

  if (!supabaseUrl) {
    return res.status(500).json({
      error: "Server configuration error: SUPABASE_URL is not configured."
    });
  }

  if (!serviceRoleKey) {
    return res.status(500).json({
      error: "Server configuration error: SUPABASE_SERVICE_ROLE_KEY is not configured."
    });
  }

  const supabaseAdmin =
    supabaseAdminClient ||
    createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

  try {
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) {
      return res.status(401).json({ error: "Invalid or expired user session." });
    }

    const user = userData.user;
    const userEmail = (user.email || "").toLowerCase().trim();
    const userId = user.id;

    // A. Super Admin automatic enrollment
    if (userEmail === "dp844771@gmail.com") {
      await supabaseAdmin.from("staff_profiles").upsert(
        {
          user_id: userId,
          email: userEmail,
          display_name: "Dhananjay Pawar (Super Admin)",
          role: "super_admin",
          department: "Admissions Directorate"
        },
        { onConflict: "user_id" }
      );
    }

    // B. Check if there was an explicit pending invite for this email
    try {
      const { data: invite } = await supabaseAdmin
        .from("pending_staff_invites")
        .select("*")
        .eq("email", userEmail)
        .maybeSingle();

      if (invite) {
        await supabaseAdmin.from("staff_profiles").upsert(
          {
            user_id: userId,
            email: userEmail,
            display_name: invite.display_name,
            role: invite.role,
            department: invite.department || "IICT Faculty",
            created_by: invite.created_by
          },
          { onConflict: "user_id" }
        );

        await supabaseAdmin.from("pending_staff_invites").delete().eq("email", userEmail);
      }
    } catch (e) {
      console.warn("Notice checking pending invites:", e.message);
    }

    // C. Retrieve the active profile for this authenticated user
    const { data: currentProfile } = await supabaseAdmin
      .from("staff_profiles")
      .select("*")
      .or(`user_id.eq.${userId},email.eq.${userEmail}`)
      .maybeSingle();

    // D. If not registered in staff_profiles and not super admin, do NOT auto-create a staff profile!
    if (!currentProfile) {
      return res.status(200).json({
        success: true,
        isStaff: false,
        profile: null,
        staffList: [],
        message: "User is authenticated but does not possess an authorized staff role."
      });
    }

    // If user_id is mismatched (e.g. invited by email before signing up), sync user_id
    if (currentProfile.user_id !== userId) {
      await supabaseAdmin
        .from("staff_profiles")
        .update({ user_id: userId })
        .eq("email", userEmail);
      currentProfile.user_id = userId;
    }

    // E. Fetch full staff list only if caller is Super Admin
    let staffList = [];
    if (currentProfile.role === "super_admin" || userEmail === "dp844771@gmail.com") {
      const { data: allStaff } = await supabaseAdmin
        .from("staff_profiles")
        .select("*")
        .order("created_at", { ascending: false });
      staffList = allStaff || [];
    }

    return res.status(200).json({
      success: true,
      isStaff: true,
      profile: currentProfile,
      staffList
    });
  } catch (err) {
    console.error("sync-staff handler error:", err);
    return res.status(500).json({ error: err.message || "Failed to sync staff session." });
  }
}
