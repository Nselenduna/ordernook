/**
 * Client-side web push helpers. Flow: register the service worker, ask
 * notification permission, subscribe with our VAPID public key, then the
 * caller attaches the subscription to the order via the
 * attach_push_subscription RPC. The private key stays server-side only.
 */

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}

/** VAPID keys are URL-safe base64; PushManager wants raw bytes.
 * (Explicit Uint8Array<ArrayBuffer> so TS accepts it as a BufferSource.) */
export function urlBase64ToUint8Array(
  base64String: string
): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Returns the subscription as JSON, or null if the user declined permission.
 * Throws on unexpected failures (caller shows a friendly error).
 */
export async function subscribeToPush(
  vapidPublicKey: string
): Promise<PushSubscriptionJSON | null> {
  const registration = await navigator.serviceWorker.register("/sw.js")
  await navigator.serviceWorker.ready

  const permission = await Notification.requestPermission()
  if (permission !== "granted") return null

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  })
  return subscription.toJSON()
}
