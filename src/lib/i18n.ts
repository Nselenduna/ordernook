/**
 * Minimal typed i18n dictionary. English only for now, but every UI string
 * lives here so adding a language later is a translation job, not a refactor.
 * Usage: t("cart.title") or t("order.number", { number: 42 }).
 */
const dict = {
  // App-wide
  "app.name": "OrderNook",
  "app.description": "Order ahead and skip the queue.",

  // Customer menu page
  "menu.soldOut": "Sold out",
  "menu.viewOrder": "View order",
  "menu.paused.title": "Ordering is paused",
  "menu.paused.body":
    "{shop} isn't taking orders right now. Please check back soon.",
  "menu.customise": "Make it yours",
  "menu.required": "Required",
  "menu.optional": "Optional",
  "menu.chooseOne": "Choose one",
  "menu.chooseMany": "Choose any",
  "menu.qty": "Quantity",
  "menu.decreaseQty": "Decrease quantity",
  "menu.increaseQty": "Increase quantity",
  "menu.addToOrder": "Add to order — {total}",
  "menu.added": "Added to your order",
  "menu.allergens": "Allergens",
  "menu.allergensNone": "No allergen info — please ask staff before collecting.",

  // Cart / checkout
  "cart.title": "Your order",
  "cart.empty": "Your order is empty.",
  "cart.allergenReminder":
    "Allergies? Check each item's allergens or ask staff before you collect.",
  "cart.remove": "Remove",
  "cart.nameLabel": "Your name",
  "cart.namePlaceholder": "e.g. Sam",
  "cart.phoneLabel": "Phone (optional)",
  "cart.phoneHint": "So the shop can reach you about your order if needed.",
  "cart.total": "Total",
  "cart.placeOrder": "Place order — pay at pickup",
  "cart.placing": "Placing your order…",
  "cart.payNote": "You pay at the counter when you collect.",

  // Order placement errors (mapped from create_order DB exceptions)
  "errors.nameRequired":
    "Please add your name so the shop knows whose order it is.",
  "errors.shop_paused": "The shop has paused ordering — please try again soon.",
  "errors.item_unavailable":
    "One of your items just sold out. Please remove it and try again.",
  "errors.missing_required_option":
    "One of your items is missing a required choice (like size). Please remove and re-add it.",
  "errors.generic": "Something went wrong placing your order. Please try again.",

  // Customer order status page
  "order.loading": "Loading your order…",
  "order.notFound.title": "Order not found",
  "order.notFound.body":
    "This order link doesn't look right. Please check the link and try again.",
  "order.number": "Order #{number}",
  "order.step.placed": "Placed",
  "order.step.accepted": "Accepted",
  "order.step.preparing": "Preparing",
  "order.step.ready": "Ready",
  "order.step.collected": "Collected",
  "order.status.new": "Waiting for the shop to accept your order",
  "order.status.accepted": "The shop has accepted your order",
  "order.status.preparing": "Your order is being prepared",
  "order.status.ready": "Your order is ready — go and grab it!",
  "order.status.collected": "Collected — enjoy!",
  "order.eta": "Estimated ready around {time}",
  "order.payAtCounter": "Pay at the counter when you collect.",
  "order.rejected.title": "Order rejected",
  "order.rejected.body": "Sorry, the shop couldn't take this order.",
  "order.rejected.reason": "Reason: {reason}",
  "order.items": "Your items",
  "order.total": "Total",
  "order.push.title": "Get notified when your order is ready",
  "order.push.body":
    "Turn on notifications and we'll ping your phone the moment it's ready.",
  "order.push.button": "Notify me",
  "order.push.enabled": "Notifications on — we'll ping you when it's ready.",
  "order.push.denied": "Notifications are blocked in your browser settings.",
  "order.push.error":
    "Couldn't turn on notifications. You can still check back here.",
  "order.backToMenu": "Back to the menu",

  // Dashboard login
  "login.title": "Shop dashboard",
  "login.subtitle": "Sign in to manage today's orders.",
  "login.email": "Email",
  "login.password": "Password",
  "login.signIn": "Sign in",
  "login.signingIn": "Signing in…",
  "login.error": "Sign-in failed. Check your email and password.",

  // Dashboard
  "dash.live": "Live",
  "dash.connecting": "Connecting…",
  "dash.signOut": "Sign out",
  "dash.notLinked":
    "This account isn't linked to a shop yet. Contact support@zizweit.uk.",
  "dash.enableSound": "Tap to enable the new-order sound",
  "dash.soundOn": "Sound on",
  "dash.soundOff": "Muted",
  "dash.tab.all": "All",
  "dash.tab.new": "New",
  "dash.tab.inProgress": "In progress",
  "dash.tab.ready": "Ready",
  "dash.tab.done": "Done today",
  "dash.empty": "No orders here yet.",
  "dash.payAtCounter": "Pay at counter",
  "dash.accept": "Accept",
  "dash.reject": "Reject",
  "dash.startPreparing": "Start preparing",
  "dash.markReady": "Ready",
  "dash.markCollected": "Collected",
  "dash.reject.title": "Reject order #{number}",
  "dash.reject.reasonLabel": "Reason (shown to the customer)",
  "dash.reject.placeholder": "e.g. We've just sold out of oat milk",
  "dash.reject.confirm": "Reject order",
  "dash.cancel": "Cancel",
  "dash.justNow": "just now",
  "dash.minAgo": "{m}m ago",
  "dash.hourAgo": "{h}h {m}m ago",
  "dash.updateFailed": "Couldn't update the order. Try again.",
  "dash.status.new": "New",
  "dash.status.accepted": "Accepted",
  "dash.status.preparing": "Preparing",
  "dash.status.ready": "Ready",
  "dash.status.collected": "Collected",
  "dash.status.rejected": "Rejected",
  "dash.status.pending_payment": "Awaiting payment",
  "dash.status.refunded": "Refunded",

  // Dashboard nav
  "nav.orders": "Orders",
  "nav.menu": "Menu",
  "nav.settings": "Settings",
  "nav.qr": "QR code",

  // Web push payload (rendered server-side in /api/notify-ready)
  "push.readyTitle": "{shop} — order #{number}",
  "push.readyBody": "Your order is ready to collect!",
} as const

export type I18nKey = keyof typeof dict

export function t(
  key: I18nKey,
  vars?: Record<string, string | number>
): string {
  let text: string = dict[key]
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value))
    }
  }
  return text
}
