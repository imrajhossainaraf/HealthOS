/* HealthOS service worker — shows push notifications even when the site is
   fully closed. The browser's push service wakes this worker on a push. */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data && event.data.text ? event.data.text() : "" };
  }
  const title = data.title || "HealthOS alert";
  const options = {
    body: data.body || "",
    tag: "healthos-alert",
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [300, 120, 300, 120, 300, 120, 300],
    data: { url: data.url || "/" },
  };
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      // If any tab is open (even backgrounded), ask it to sound the loud siren.
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) client.postMessage({ type: "healthos:push-siren", data });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          if ("navigate" in client) client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
