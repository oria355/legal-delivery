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
