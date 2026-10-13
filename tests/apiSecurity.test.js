import test from "node:test";
import assert from "node:assert/strict";
import grantStaffHandler from "../api/grant-staff.js";
import syncStaffHandler from "../api/sync-staff.js";

// Ensure dummy test key is set for unit testing mock server
process.env.SUPABASE_SERVICE_ROLE_KEY = "dummy-test-service-role-key-for-unit-test";
process.env.SUPABASE_URL = "https://hwonxgtqessyuakdgyfw.supabase.co";

// Mock helper for HTTP request and response
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

  const req = {
    method,
    headers,
    body
  };

  return { req, res, getStatus: () => statusCode, getData: () => responseData };
}

test("grant-staff: requires Bearer token and rejects missing auth header with 401", async () => {
  const { req, res, getStatus, getData } = createMockHttp({
    method: "POST",
    headers: {},
    body: {
      email: "teacher@mgmu.ac.in",
      displayName: "Prof. Test",
      callerEmail: "dp844771@gmail.com"
    }
  });

  await grantStaffHandler(req, res);
  assert.equal(getStatus(), 401);
  assert.ok(getData()?.error?.includes("Authentication required") || getData()?.error?.includes("Missing Bearer token"));
});

test("grant-staff: does NOT authorize caller via body.callerEmail", async () => {
  const { req, res, getStatus } = createMockHttp({
    method: "POST",
    headers: {
      authorization: "Bearer invalid-tampered-token-12345"
    },
    body: {
      email: "attacker@gmail.com",
      displayName: "Attacker",
      callerEmail: "dp844771@gmail.com"
    }
  });

  // Provide mock admin client where getUser returns error
  const mockAdminClient = {
    auth: {
      getUser: async () => ({ data: null, error: new Error("Invalid JWT") })
    }
  };

  await grantStaffHandler(req, res, { supabaseAdminClient: mockAdminClient });
  // Must fail with 401 since token is invalid; body.callerEmail must be ignored
  assert.equal(getStatus(), 401);
});

test("sync-staff: rejects missing Bearer token with 401", async () => {
  const { req, res, getStatus, getData } = createMockHttp({
    method: "POST",
    headers: {},
    body: {}
  });

  await syncStaffHandler(req, res);
  assert.equal(getStatus(), 401);
  assert.ok(getData()?.error?.includes("Missing authorization Bearer token"));
});

test("sync-staff: rejects invalid or expired token with 401", async () => {
  const { req, res, getStatus, getData } = createMockHttp({
    method: "POST",
    headers: {
      authorization: "Bearer expired-token-xyz"
    },
    body: {}
  });

  const mockAdminClient = {
    auth: {
      getUser: async () => ({ data: null, error: new Error("Token expired") })
    }
  };

  await syncStaffHandler(req, res, { supabaseAdminClient: mockAdminClient });
  assert.equal(getStatus(), 401);
  assert.ok(getData()?.error?.includes("Invalid or expired user session"));
});

test("sync-staff: returns isStaff: false for authenticated non-staff account", async () => {
  const { req, res, getStatus, getData } = createMockHttp({
    method: "POST",
    headers: {
      authorization: "Bearer valid-student-token"
    },
    body: {}
  });

  const mockAdminClient = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "student-user-123", email: "student@example.com" } },
        error: null
      })
    },
    from: (table) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null })
        }),
        or: () => ({
          maybeSingle: async () => ({ data: null, error: null })
        })
      })
    })
  };

  await syncStaffHandler(req, res, { supabaseAdminClient: mockAdminClient });
  assert.equal(getStatus(), 200);
  const data = getData();
  assert.equal(data.success, true);
  assert.equal(data.isStaff, false);
  assert.equal(data.profile, null);
  assert.ok(data.message?.includes("does not possess an authorized staff role"));
});

test("sync-staff: returns isStaff: true for authorized staff account", async () => {
  const { req, res, getStatus, getData } = createMockHttp({
    method: "POST",
    headers: {
      authorization: "Bearer valid-teacher-token"
    },
    body: {}
  });

  const staffProfile = {
    user_id: "teacher-user-456",
    email: "teacher@mgmu.ac.in",
    display_name: "Prof. Sharma",
    role: "teacher",
    department: "Computer Science"
  };

  const mockAdminClient = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "teacher-user-456", email: "teacher@mgmu.ac.in" } },
        error: null
      })
    },
    from: (table) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null })
        }),
        or: () => ({
          maybeSingle: async () => ({ data: staffProfile, error: null })
        })
      })
    })
  };

  await syncStaffHandler(req, res, { supabaseAdminClient: mockAdminClient });
  assert.equal(getStatus(), 200);
  const data = getData();
  assert.equal(data.success, true);
  assert.equal(data.isStaff, true);
  assert.equal(data.profile.role, "teacher");
  assert.equal(data.profile.display_name, "Prof. Sharma");
});

test("sync-staff: recognizes Super Admin account dp844771@gmail.com", async () => {
  const { req, res, getStatus, getData } = createMockHttp({
    method: "POST",
    headers: {
      authorization: "Bearer valid-super-admin-token"
    },
    body: {}
  });

  const superAdminProfile = {
    user_id: "admin-user-001",
    email: "dp844771@gmail.com",
    display_name: "Dhananjay Pawar (Super Admin)",
    role: "super_admin",
    department: "Admissions Directorate"
  };

  const mockAdminClient = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "admin-user-001", email: "dp844771@gmail.com" } },
        error: null
      })
    },
    from: (table) => {
      if (table === "staff_profiles") {
        return {
          upsert: async () => ({ data: null, error: null }),
          select: () => ({
            or: () => ({
              maybeSingle: async () => ({ data: superAdminProfile, error: null })
            }),
            order: async () => ({ data: [superAdminProfile], error: null })
          })
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null })
          })
        })
      };
    }
  };

  await syncStaffHandler(req, res, { supabaseAdminClient: mockAdminClient });
  assert.equal(getStatus(), 200);
  const data = getData();
  assert.equal(data.success, true);
  assert.equal(data.isStaff, true);
  assert.equal(data.profile.role, "super_admin");
  assert.ok(Array.isArray(data.staffList));
});
