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

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Health check endpoint (does not perform any mutations)
  if (req.method === "GET") {
    const serviceRoleKey = getServiceRoleKey();
    const hasKey = Boolean(serviceRoleKey);
    return res.status(200).json({
      status: "online",
      hasServiceRoleKey: hasKey
    });
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

  // 2. Authorize ONLY verified Super Admin from database or trusted email
  let isSuperAdmin = callerEmail === "dp844771@gmail.com";

  if (!isSuperAdmin && callerId) {
    try {
      const { data: profile } = await supabaseAdmin
        .from("staff_profiles")
        .select("role")
        .eq("user_id", callerId)
        .maybeSingle();

      if (profile?.role === "super_admin") {
        isSuperAdmin = true;
      }
    } catch (e) {
      console.warn("Error checking caller staff profile:", e.message);
    }
  }

  if (!isSuperAdmin) {
    return res.status(403).json({
      error: "Permission denied: Only Super Admin can grant or manage staff access."
    });
  }

  // 3. Validate request payload (ignoring any callerEmail passed in body)
  const body = req.body || {};
  const cleanEmail = (body.email || "").toLowerCase().trim();
  const cleanName = (body.displayName || body.display_name || "").trim();
  const rawRole = (body.role || "teacher").toLowerCase().trim();
  const department = (body.department || "IICT Faculty").trim();

  const allowedRoles = ["super_admin", "teacher", "counsellor", "manager", "admin"];
  const role = allowedRoles.includes(rawRole) ? rawRole : "teacher";

  if (!cleanEmail || !cleanEmail.includes("@") || cleanEmail.length < 5) {
    return res.status(400).json({ error: "A valid email address is required." });
  }

  if (!cleanName || cleanName.length < 2) {
    return res.status(400).json({ error: "A valid display name (at least 2 characters) is required." });
  }

  try {
    // 4. Ensure Super Admin profile itself exists in staff_profiles
    if (callerId && callerEmail === "dp844771@gmail.com") {
      await supabaseAdmin.from("staff_profiles").upsert(
        {
          user_id: callerId,
          email: "dp844771@gmail.com",
          display_name: "Dhananjay Pawar (Super Admin)",
          role: "super_admin",
          department: "Admissions Directorate"
        },
        { onConflict: "user_id" }
      );
    }

    // 5. Look up target user in Supabase Auth
    const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });

    if (listError) {
      console.error("Supabase admin.listUsers error:", listError);
      return res.status(500).json({
        error: `Supabase Auth Admin Error: ${listError.message}`
      });
    }

    let targetUser = null;
    if (userList?.users) {
      targetUser = userList.users.find(
        (u) => (u.email || "").toLowerCase().trim() === cleanEmail
      );
    }

    if (targetUser) {
      // User is registered in Supabase Auth: activate them in staff_profiles
      const { error: upsertErr } = await supabaseAdmin.from("staff_profiles").upsert(
        {
          user_id: targetUser.id,
          email: cleanEmail,
          display_name: cleanName,
          role: role,
          department: department,
          created_by: callerId
        },
        { onConflict: "user_id" }
      );

      if (upsertErr) {
        console.error("staff_profiles upsert error:", upsertErr);
        throw upsertErr;
      }

      // Remove from pending_staff_invites if present
      try {
        await supabaseAdmin.from("pending_staff_invites").delete().eq("email", cleanEmail);
      } catch {}

      return res.status(200).json({
        success: true,
        status: "granted",
        message: `Success! ${cleanName} (${cleanEmail}) has been activated as ${role}.`,
        user: {
          id: targetUser.id,
          email: cleanEmail,
          display_name: cleanName,
          role: role
        }
      });
    } else {
      // User has not registered in Supabase Auth yet: record pre-authorized invite
      const { error: inviteErr } = await supabaseAdmin.from("pending_staff_invites").upsert(
        {
          email: cleanEmail,
          display_name: cleanName,
          role: role,
          department: department,
          created_by: callerId
        },
        { onConflict: "email" }
      );

      if (inviteErr) {
        console.error("pending_staff_invites upsert error:", inviteErr);
        throw inviteErr;
      }

      return res.status(200).json({
        success: true,
        status: "invited",
        message: `Pre-authorization recorded! ${cleanName} (${cleanEmail}) has been pre-authorized. When they register with this email, staff access will activate automatically.`,
        email: cleanEmail
      });
    }
  } catch (err) {
    console.error("grant-staff handler error:", err);
    return res.status(500).json({ error: err.message || "Failed to grant staff access." });
  }
}
