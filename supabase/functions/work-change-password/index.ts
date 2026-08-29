import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://sayampreecha-ux.github.io",
]);

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
  if (caller.app_metadata?.must_change_password !== true) {
    return reply(req, 409, { ok: false, code: "PASSWORD_CHANGE_NOT_REQUIRED", message: "บัญชีนี้ไม่ต้องเปลี่ยนรหัสเริ่มต้นแล้ว" });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return reply(req, 400, { ok: false, code: "INVALID_JSON" }); }

  const newPassword = String(body.newPassword || "");
  if (newPassword.length < 10) return reply(req, 400, { ok: false, code: "PASSWORD_TOO_SHORT", message: "รหัสผ่านใหม่ต้องอย่างน้อย 10 ตัวอักษร" });
  if (newPassword.length > 128) return reply(req, 400, { ok: false, code: "PASSWORD_TOO_LONG", message: "รหัสผ่านยาวเกินไป" });

  const { data: memberships, error: membershipError } = await admin
    .from("organization_memberships")
    .select("organization_id, department_id")
    .eq("user_id", caller.id)
    .eq("active", true);
  if (membershipError) return reply(req, 500, { ok: false, code: "MEMBERSHIP_LOOKUP_FAILED" });
  if (!memberships?.length) return reply(req, 403, { ok: false, code: "MEMBERSHIP_REQUIRED", message: "บัญชีนี้ยังไม่มีสิทธิองค์กร" });

  const nextAppMetadata = {
    ...(caller.app_metadata || {}),
    must_change_password: false,
    initial_password_changed_at: new Date().toISOString(),
  };
  const { error: updateError } = await admin.auth.admin.updateUserById(caller.id, {
    password: newPassword,
    app_metadata: nextAppMetadata,
  });
  if (updateError) return reply(req, 400, { ok: false, code: "PASSWORD_UPDATE_FAILED", message: "เปลี่ยนรหัสผ่านไม่สำเร็จ" });

  const auditRows = memberships.map((membership) => ({
    organization_id: membership.organization_id,
    department_id: membership.department_id,
    actor_user_id: caller.id,
    action: "INITIAL_PASSWORD_CHANGED",
    entity_type: "MEMBERSHIP",
    entity_id: caller.id,
    request_id: crypto.randomUUID(),
    metadata_json: { auth_mode: "first_login_password_rotation" },
  }));
  const { error: auditError } = await admin.from("audit_events").insert(auditRows);
  if (auditError) {
    await admin.auth.admin.updateUserById(caller.id, {
      app_metadata: { ...(caller.app_metadata || {}), must_change_password: true },
    });
    return reply(req, 500, { ok: false, code: "AUDIT_CREATE_FAILED", message: "รหัสผ่านเปลี่ยนแล้ว แต่ยังเปิดใช้งานไม่สำเร็จ กรุณาลองอีกครั้งด้วยรหัสใหม่" });
  }

  return reply(req, 200, { ok: true, changed: true });
});
