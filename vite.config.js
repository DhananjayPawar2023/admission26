import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import grantHandler from "./api/grant-staff.js";
import syncHandler from "./api/sync-staff.js";
import updateAppStatusHandler from "./api/update-application-status.js";
import replyInquiryHandler from "./api/reply-inquiry.js";

function apiMiddleware(env = {}) {
  return {
    name: "api-middleware",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Populate server environment variables for local API routes
        if (env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
          process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
        }
        if (env.VITE_SUPABASE_URL && !process.env.SUPABASE_URL) {
          process.env.SUPABASE_URL = env.VITE_SUPABASE_URL;
        }
        if (env.RESEND_API_KEY && !process.env.RESEND_API_KEY) {
          process.env.RESEND_API_KEY = env.RESEND_API_KEY;
        }

        const url = req.url ? req.url.split("?")[0] : "";
        const apiRoutes = {
          "/api/grant-staff": grantHandler,
          "/api/sync-staff": syncHandler,
          "/api/update-application-status": updateAppStatusHandler,
          "/api/reply-inquiry": replyInquiryHandler
        };

        if (apiRoutes[url]) {
          let bodyData = {};
          if (req.method === "POST") {
            const buffers = [];
            for await (const chunk of req) {
              buffers.push(chunk);
            }
            const rawBody = Buffer.concat(buffers).toString();
            try {
              bodyData = JSON.parse(rawBody);
            } catch {}
          }
          req.body = bodyData;

          // Polyfill res.status and res.json for Vercel handler compatibility
          res.status = (code) => {
            res.statusCode = code;
            return res;
          };
          res.json = (data) => {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(data));
            return res;
          };

          return apiRoutes[url](req, res);
        }
        next();
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), apiMiddleware(env)]
  };
});
