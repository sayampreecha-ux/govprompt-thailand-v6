import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://sayampreecha-ux.github.io",
]);
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const WORKSPACE_DOMAIN = "workspace.govprompt.local";
const ALLOWED_ROLES = new Set(["OFFICER", "DIRECTOR", "EXECUTIVE", "AUDITOR"]);
const SCOPED_ROLES = new Set(["OFFICER", "DIRECTOR"]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://sayampreecha-ux.github.io";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function reply(req: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });
}

function normalizeUsername(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return reply(req, 405, { ok: false, code: "METHOD_NOT_ALLOWED" });

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return reply(req, 401, { ok: false, code: "AUTH_REQUIRED" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return reply(req, 500, { ok: false, code: "SERVER_CONFIG_MISSING" });

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const caller = userData?.user;
  if (userError || !caller?.id) return reply(req, 401, { ok: false, code: "INVALID_SESSION" });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return reply(req, 400, { ok: false, code: "INVALID_JSON" }); }

  const organizationId = String(body.organizationId || "").trim();
  const username = normalizeUsername(body.username);
  const displayName = String(body.displayName || "").trim().slice(0, 120);
  const password = String(body.password || "");
  const role = String(body.role || "").trim().toUpperCase();
  const requestedDepartmentId = body.departmentId ? String(body.departmentId).trim() : null;

  if (!organizationId) return reply(req, 400, { ok: false, code: "ORGANIZATION_REQUIRED" });
  if (!USERNAME_RE.test(username)) return reply(req, 400, { ok: false, code: "INVALID_USERNAME", message: "ชื่อผู้ใช้ใช้ a-z, 0-9, จุด, ขีดกลาง หรือขีดล่าง และยาว 3-32 ตัว" });
  if (!displayName) return reply(req, 400, { ok: false, code: "DISPLAY_NAME_REQUIRED" });
  if (password.length < 8) return reply(req, 400, { ok: false, code: "PASSWORD_TOO_SHORT", message: "รหัสผ่านต้องอย่างน้อย 8 ตัวอักษร" });
  if (!ALLOWED_ROLES.has(role)) return reply(req, 400, { ok: false, code: "INVALID_ROLE" });

  const { data: callerMembership, error: membershipError } = await admin
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", caller.id)
    .eq("active", true)
    .maybeSingle();
  if (membershipError) return reply(req, 500, { ok: false, code: "MEMBERSHIP_LOOKUP_FAILED" });
  if (!callerMembership || callerMembership.role !== "ORG_ADMIN") return reply(req, 403, { ok: false, code: "ORG_ADMIN_REQUIRED" });

  let departmentId: string | null = null;
  if (SCOPED_ROLES.has(role)) {
    if (!requestedDepartmentId) return reply(req, 400, { ok: false, code: "DEPARTMENT_REQUIRED" });
    const { data: department, error: departmentError } = await admin
      .from("departments")
      .select("id")
      .eq("id", requestedDepartmentId)
      .eq("organization_id", organizationId)
      .eq("active", true)
      .maybeSingle();
    if (departmentError || !department) return reply(req, 400, { ok: false, code: "INVALID_DEPARTMENT" });
    departmentId = requestedDepartmentId;
  }

  const syntheticEmail = `${username}@${WORKSPACE_DOMAIN}`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: syntheticEmail,
    password,
    email_confirm: true,
    user_metadata: { workspace_username: username, display_name: displayName, organization_id: organizationId },
  });

  if (createError || !created?.user?.id) {
    const duplicate = /already|registered|exists|duplicate/i.test(String(createError?.message || ""));
    return reply(req, duplicate ? 409 : 400, {
      ok: false,
      code: duplicate ? "USERNAME_TAKEN" : "AUTH_USER_CREATE_FAILED",
      message: duplicate ? "ชื่อผู้ใช้นี้ถูกใช้แล้ว" : "สร้างบัญชีไม่สำเร็จ",
    });
  }

  const newUserId = created.user.id;
  const { error: membershipInsertError } = await admin.from("organization_memberships").insert({
    organization_id: organizationId,
    user_id: newUserId,
    department_id: departmentId,
    role,
    active: true,
    display_name: displayName,
  });
  if (membershipInsertError) {
    await admin.auth.admin.deleteUser(newUserId);
    return reply(req, 500, { ok: false, code: "MEMBERSHIP_CREATE_FAILED" });
  }

  const { error: auditError } = await admin.from("audit_events").insert({
    organization_id: organizationId,
    department_id: departmentId,
    actor_user_id: caller.id,
    action: "WORKSPACE_USER_CREATED",
    entity_type: "MEMBERSHIP",
    entity_id: newUserId,
    request_id: crypto.randomUUID(),
    metadata_json: {
      username,
      display_name: displayName,
      role,
      department_id: departmentId,
      auth_mode: "admin_created_username_password",
    },
  });
  if (auditError) {
    await admin.from("organization_memberships").delete().eq("organization_id", organizationId).eq("user_id", newUserId);
    await admin.auth.admin.deleteUser(newUserId);
    return reply(req, 500, { ok: false, code: "AUDIT_CREATE_FAILED" });
  }

  return reply(req, 201, { ok: true, username, userId: newUserId, displayName, role, departmentId });
});
