/* Minimal service worker: lets the admin app show native notification banners
   (reg.showNotification) and handles taps on them. No caching, no offline mode. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Tap on the "מסירה חדשה" banner: focus the open app and tell it which order to
// assign; if the app is closed, open https://<site>/#assign=<ORDER_ID>.
// The "שבץ שליח עכשיו" action button and a tap on the body do the same thing.
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
          client.postMessage({ type: "assign", orderId: data.orderId });
          return;
        }
      }
      await self.clients.openWindow(data.orderId === "TEST" ? "/" : url);
    })()
  );
});

// Optional server Web Push (future): same WhatsApp-style banner from a JSON payload
// { orderId, client, address }. Not used by the in-app notifications above.
self.addEventListener("push", (event) => {
  let p = {};
  try {
    p = event.data ? event.data.json() : {};
  } catch (e) {
    /* plain text push */
  }
  event.waitUntil(
    self.registration.showNotification("מסירות משפטיות — מסירה חדשה ממתינה לשיבוץ", {
      body: `מסירה חדשה (#${p.orderId || ""}) מאת ${p.client || "—"} לכתובת ${p.address || "—"} ממתינה לשיבוץ שליח`,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      dir: "rtl",
      lang: "he",
      vibrate: [200, 100, 200],
      requireInteraction: true,
      actions: [{ action: "assign", title: "שבץ שליח עכשיו" }],
      tag: `new-order-${p.orderId || "x"}`,
      data: { orderId: p.orderId, url: `/#assign=${p.orderId || ""}` },
    })
  );
});
