import fs from "fs";
import path from "path";

/**
 * Robust server environment variable resolver with synchronous file fallback
 * for local dev environments where Node process.env may not have been re-seeded.
 */
export function getServiceRoleKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.SERVICE_ROLE_KEY) return process.env.SERVICE_ROLE_KEY;
  if (process.env.SUPABASE_SERVICE_KEY) return process.env.SUPABASE_SERVICE_KEY;
  if (process.env.SUPABASE_SERVICE_ROLE) return process.env.SUPABASE_SERVICE_ROLE;
  if (process.env.SERVICE_ROLE) return process.env.SERVICE_ROLE;

  const candidateFiles = [".env.local", ".env"];
  for (const file of candidateFiles) {
    try {
      const fullPath = path.resolve(process.cwd(), file);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf8");
        const match = content.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*([^\r\n]+)/);
        if (match && match[1]) {
          const val = match[1].trim().replace(/^['"]|['"]$/g, "");
          if (val) {
            process.env.SUPABASE_SERVICE_ROLE_KEY = val;
            return val;
          }
        }
      }
    } catch {}
  }
  return "";
}

export function getSupabaseUrl() {
  if (process.env.VITE_SUPABASE_URL) return process.env.VITE_SUPABASE_URL;
  if (process.env.SUPABASE_URL) return process.env.SUPABASE_URL;

  const candidateFiles = [".env.local", ".env"];
  for (const file of candidateFiles) {
    try {
      const fullPath = path.resolve(process.cwd(), file);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf8");
        const match = content.match(/(?:VITE_)?SUPABASE_URL\s*=\s*([^\r\n]+)/);
        if (match && match[1]) {
          const val = match[1].trim().replace(/^['"]|['"]$/g, "");
          if (val) {
            process.env.SUPABASE_URL = val;
            return val;
          }
        }
      }
    } catch {}
  }
  return "https://hwonxgtqessyuakdgyfw.supabase.co";
}

export function getResendApiKey() {
  if (process.env.RESEND_API_KEY) return process.env.RESEND_API_KEY;

  const candidateFiles = [".env.local", ".env"];
  for (const file of candidateFiles) {
    try {
      const fullPath = path.resolve(process.cwd(), file);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf8");
        const match = content.match(/RESEND_API_KEY\s*=\s*([^\r\n]+)/);
        if (match && match[1]) {
          const val = match[1].trim().replace(/^['"]|['"]$/g, "");
          if (val) {
            process.env.RESEND_API_KEY = val;
            return val;
          }
        }
      }
    } catch {}
  }
  return "";
}
