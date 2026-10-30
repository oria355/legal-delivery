// Supabase Edge Function: notify-new-order
// *** REVIEW ONLY — NOT DEPLOYED ***
// Sends the admin's Web Push (title "מסירה חדשה", body "אבא תודה") with NO customer data.
// The visible text is set in public/sw.js; this function sends only { orderId, url }.
//
// Two callers, both authenticated:
//   1. Database Webhook on INSERT into public.orders → header  x-webhook-secret: <WEBHOOK_SECRET>
//   2. An admin's browser, body {"test":true}        → header  Authorization: Bearer <user JWT> (role must be admin)
//
// Secrets (Dashboard → Edge Functions → Secrets; NEVER in VITE_ variables or the repo):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@domain), WEBHOOK_SECRET
//   (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.)
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const PENDING_STATUS = "ממתין לשיוך"; // STATUS.PENDING in the app
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i += 1) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const env = Deno.env.toObject();
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) return json({ error: "vapid_not_configured" }, 500);
  const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);

  let payload = {};
  try {
    payload = await req.json();
  } catch (e) {
    payload = {};
  }

  // ---- authenticate + decide the mode --------------------------------------------------------
  let mode;
  let orderId;
  let testUserId = null;
  const secret = req.headers.get("x-webhook-secret");
  if (secret && env.WEBHOOK_SECRET && safeEqual(secret, env.WEBHOOK_SECRET)) {
    mode = "webhook";
    // Only a genuine new, unassigned delivery: INSERT into orders with the waiting status.
    if (payload.type !== "INSERT" || payload.table !== "orders" || !payload.record) return json({ skipped: "not_an_insert" });
    if (payload.record.status !== PENDING_STATUS) return json({ skipped: "not_pending" });
    orderId = String(payload.record.id || "");
    if (!orderId) return json({ skipped: "no_id" });
  } else if (payload && payload.test === true) {
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await db.auth.getUser(jwt);
    if (!u || !u.user) return json({ error: "unauthorized" }, 401);
    const { data: prof } = await db.from("profiles").select("id, role, blocked").eq("auth_id", u.user.id).maybeSingle();
    if (!prof || prof.role !== "admin" || prof.blocked) return json({ error: "forbidden" }, 403);
    mode = "test";
    orderId = "TEST";
    testUserId = prof.id;
  } else {
    return json({ error: "unauthorized" }, 401);
  }

  // ---- idempotency (webhook only): one log row per order -------------------------------------
  if (mode === "webhook") {
    const { error: insErr } = await db.from("push_log").insert({ order_id: orderId, status: "pending" });
    if (insErr) {
      const { data: prev } = await db.from("push_log").select("status, attempts, updated_at").eq("order_id", orderId).maybeSingle();
      // "sent" = done. "pending" = another invocation is working on it — unless it is stale (crashed), then retry.
      const stale = prev && Date.now() - new Date(prev.updated_at).getTime() > 120000;
      if (prev && (prev.status === "sent" || (prev.status === "pending" && !stale))) return json({ skipped: "duplicate" });
      await db.from("push_log").update({ status: "pending", attempts: ((prev && prev.attempts) || 1) + 1, updated_at: new Date().toISOString() }).eq("order_id", orderId);
    }
  }

  // ---- recipients: admin devices only --------------------------------------------------------
  let q = db.from("push_subscriptions").select("id, endpoint, p256dh, auth, user_id");
  if (testUserId) q = q.eq("user_id", testUserId);
  const { data: subs } = await q;
  const { data: admins } = await db.from("profiles").select("id").eq("role", "admin").eq("blocked", false);
  const adminIds = new Set((admins || []).map((a) => a.id));
  const targets = (subs || []).filter((s) => adminIds.has(s.user_id));

  let sent = 0;
  let failed = 0;
  let removed = 0;
  const codes = new Set();
  const message = JSON.stringify({ orderId, url: orderId === "TEST" ? "/" : `/#assign=${encodeURIComponent(orderId)}` });
  for (const s of targets) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, message, { TTL: 3600, urgency: "high" });
      sent += 1;
    } catch (e) {
      const code = e && e.statusCode ? Number(e.statusCode) : 0;
      if (code === 404 || code === 410) {
        await db.from("push_subscriptions").delete().eq("id", s.id); // expired / unsubscribed
        removed += 1;
      } else {
        failed += 1;
        codes.add(String(code || "net")); // sanitized: status code only — never the endpoint or keys
      }
    }
  }

  const status = targets.length === 0 ? "no_subscribers" : sent > 0 ? "sent" : "failed";
  if (mode === "webhook") {
    await db
      .from("push_log")
      .update({ status, sent, failed, removed, error_codes: [...codes].join(",") || null, updated_at: new Date().toISOString() })
      .eq("order_id", orderId);
  }
  // A failure is reported as a failure (the webhook shows it) — never a silent 200.
  const http = status === "failed" ? 502 : 200;
  return json({ status, sent, failed, removed }, http);
});
