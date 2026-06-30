self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      
      // Broadcast the push notification to all open tabs/windows
      if (self.clients) {
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
          clientList.forEach(function(client) {
            client.postMessage({
              type: 'PUSH_NOTIFICATION_RECEIVED',
              title: data.title || 'Academy Alert',
              body: data.body,
              url: data.url || '/student-dashboard'
            });
          });
        });
      }

      const options = {
        body: data.body,
        icon: '/favicon.png',
        badge: '/favicon.png',
        tag: data.tag || 'class-session',
        vibrate: [100, 50, 100],
        sound: 'default',
        data: {
          url: data.url || '/student-dashboard'
        }
      };
      event.waitUntil(
        self.registration.showNotification(data.title || 'Academy Alert', options)
      );
    } catch (e) {
      console.error('Error parsing push data:', e);
      const text = event.data.text();
      
      // Broadcast message event as fallback
      if (self.clients) {
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
          clientList.forEach(function(client) {
            client.postMessage({
              type: 'PUSH_NOTIFICATION_RECEIVED',
              title: 'Class Started',
              body: text,
              url: '/student-dashboard'
            });
          });
        });
      }

      event.waitUntil(
        self.registration.showNotification('Class Started', {
          body: text,
          icon: '/favicon.png',
          badge: '/favicon.png'
        })
      );
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/student-dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
