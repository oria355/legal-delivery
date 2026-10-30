/* Service worker (scope "/"): shows the admin's "new delivery" Web Push and handles taps.
   No caching, no offline mode. The ONLY registered worker is /sw.js (src/App.jsx → registerServiceWorker). */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Exact, final alert text. Deliberately contains NO customer data (lock screen safe).
const NEW_ORDER_TITLE = "מסירה חדשה";
const NEW_ORDER_BODY = "אבא תודה";

// Tap: focus the open app and tell it which order to assign; if closed, open /#assign=<ORDER_ID>.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = data.url || "/";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if ("focus" in client) {
          await client.focus();
          if (data.orderId && data.orderId !== "TEST") client.postMessage({ type: "assign", orderId: data.orderId });
          return;
        }
      }
      await self.clients.openWindow(data.orderId === "TEST" ? "/" : url);
    })()
  );
});

// Server Web Push (Supabase Edge Function notify-new-order). Payload: { orderId, url } only.
self.addEventListener("push", (event) => {
  let p = {};
  try {
    p = event.data ? event.data.json() : {};
  } catch (e) {
    /* payload is optional */
  }
  const orderId = String(p.orderId || "").slice(0, 40);
  event.waitUntil(
    (async () => {
      // If the app is open and visible, the in-app alert (same tag) already covers it: no double banner.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (windows.some((c) => c.visibilityState === "visible") && orderId !== "TEST") return;
      await self.registration.showNotification(NEW_ORDER_TITLE, {
        body: NEW_ORDER_BODY,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        dir: "rtl",
        lang: "he",
        vibrate: [200, 100, 200],
        requireInteraction: true,
        tag: `new-order-${orderId || "x"}`,
        data: { orderId, url: orderId && orderId !== "TEST" ? `/#assign=${encodeURIComponent(orderId)}` : "/" },
      });
    })()
  );
});

// The browser rotated/expired the subscription: ask any open app to register the new one.
// (A closed app re-registers the next time the admin opens it.)
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      windows.forEach((c) => c.postMessage({ type: "push-resubscribe" }));
    })()
  );
});
