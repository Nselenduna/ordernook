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

  // Dashboard menu (availability toggle)
  "menu.available": "Available",
  "menu.markSoldOut": "Sold out",
  "menu.updateFailed": "Couldn't update — try again.",
  "menu.emptyMenu": "No menu items yet.",

  // Dashboard settings
  "settings.acceptingOrders": "Accepting orders",
  "settings.acceptingOn": "Customers can order now.",
  "settings.acceptingOff": "Ordering is paused — the shop page shows a paused message.",
  "settings.acceptingOffLabel": "Paused",
  "settings.prepTime": "Prep time (minutes)",
  "settings.prepHint": "Shown to customers as the estimated ready time.",
  "settings.saved": "Saved.",
  "settings.saveButton": "Save",
  "settings.saveFailed": "Couldn't save — try again.",

  // Dashboard nav
  "nav.orders": "Orders",
  "nav.menu": "Menu",
  "nav.settings": "Settings",
  "nav.qr": "QR code",
  "nav.profile": "Profile",

  // Dashboard shop profile (name, tagline, brand colour, logo)
  "profile.title": "Shop profile",
  "profile.name": "Shop name",
  "profile.tagline": "Tagline",
  "profile.taglinePlaceholder": "e.g. Skip the queue.",
  "profile.brandColour": "Brand colour",
  "profile.brandColourHint": "Used for buttons and highlights on your customer page.",
  "profile.contrastWarning": "Too light — white button text won't be readable. Pick a darker shade.",
  "profile.logo": "Logo",
  "profile.logoHint": "Square works best. Shown on your page and as your app icon.",
  "profile.uploadLogo": "Upload logo",
  "profile.uploading": "Uploading…",
  "profile.save": "Save",
  "profile.saved": "Saved.",
  "profile.saveFailed": "Couldn't save — try again.",
  "profile.logoTooLarge": "That image is over 4MB — pick a smaller one.",
  "profile.logoFailed": "Logo upload failed — try again.",

  // Dashboard QR code panel + printable poster
  "qr.title": "Your QR code",
  "qr.subtitle": "Print this and put it on the counter. Customers scan to order.",
  "qr.download": "Download QR (PNG)",
  "qr.copyLink": "Copy link",
  "qr.copied": "Link copied.",
  "qr.openPoster": "Open printable poster",
  "qr.posterHeadline": "Skip the queue",
  "qr.posterSub": "Scan to order ahead & collect",
  "qr.print": "Print poster",

  // Web push payload (rendered server-side in /api/notify-ready)
  "push.readyTitle": "{shop} — order #{number}",
  "push.readyBody": "Your order is ready to collect!",

  // Menu editor
  "editor.addCategory": "Add category",
  "editor.newCategory": "New category name",
  "editor.noCategories": "No categories yet. Add one to start your menu.",
  "editor.categoryName": "Category name",
  "editor.categoryNotEmpty": "Empty the category before deleting it.",
  "editor.deleteCategory": "Delete category",
  "editor.addItem": "Add item",
  "editor.editItem": "Edit item",
  "editor.deleteItem": "Delete item",
  "editor.itemFormHint": "Set the name, price, category and allergens.",
  "editor.name": "Name",
  "editor.description": "Description",
  "editor.priceLabel": "Price (£)",
  "editor.category": "Category",
  "editor.allergens": "Allergens",
  "editor.save": "Save",
  "editor.saving": "Saving…",
  "editor.saved": "Saved.",
  "editor.saveFailed": "Couldn't save — try again.",
  "editor.nameRequired": "Please enter a name.",
  "editor.priceInvalid": "Enter a valid price (e.g. 3.50).",
  "editor.moveUp": "Move up",
  "editor.moveDown": "Move down",
  "editor.deleteItemTitle": "Delete this item?",
  "editor.deleteItemBody": "\"{name}\" will be removed from your menu. Past orders keep their record.",
  "editor.cancel": "Cancel",
  "editor.confirmDelete": "Delete",
  "editor.options": "Options",
  "editor.optionsTitle": "Options — {name}",
  "editor.optionsHint": "Add choices like size, milk or extras. Changes save as you go.",
  "editor.noGroups": "No option groups yet. Add one for size, milk or extras.",
  "editor.addGroup": "Add option group",
  "editor.newGroupName": "New group",
  "editor.groupName": "Group name",
  "editor.typeSingle": "Choose one",
  "editor.typeMulti": "Choose any",
  "editor.groupRequired": "Required",
  "editor.groupOptional": "Optional",
  "editor.deleteGroup": "Delete option group",
  "editor.deleteGroupTitle": "Delete this option group?",
  "editor.deleteGroupBody": "\"{name}\" and its options will be removed. Past orders keep their record.",
  "editor.addOption": "Add option",
  "editor.newOptionName": "New option",
  "editor.optionName": "Option name",
  "editor.optionDelta": "Price change (£)",
  "editor.deleteOption": "Delete option",
  "editor.requiredNoOptions": "Add at least one option, or customers can't order this item.",
  "editor.photo": "Photo",
  "editor.choosePhoto": "Add photo",
  "editor.changePhoto": "Change photo",
  "editor.removePhoto": "Remove",
  "editor.photoTooLarge": "That image is too large (max 10 MB).",
  "editor.photoFailed": "Couldn't upload the photo — try again.",
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
