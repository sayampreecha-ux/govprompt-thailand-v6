import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const WORKSPACE_URL = "https://sayampreecha-ux.github.io/govprompt-thailand-v6/pilot/";

Deno.serve((req: Request) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response(JSON.stringify({
      code: "WORKSPACE_MOVED",
      message: "Workspace องค์กรใช้หน้าเดียวที่ GP Work Tracking Pilot",
      url: WORKSPACE_URL,
    }), {
      status: 410,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: WORKSPACE_URL,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
