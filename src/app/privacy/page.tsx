import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc, H, Fine } from "@/components/marketing/legal-doc";

export const metadata: Metadata = {
  title: "Privacy Policy — OrderNook",
  description:
    "What personal data OrderNook handles, why, and who processes it.",
};

// NOTE: Tailored to what the app actually collects — customer name (required),
// phone (optional), and an optional push subscription. No card data ever
// reaches this app; Stripe hosts the checkout. Have a UK solicitor review
// before relying on it. Controller: ZIZWE IT LIMITED.
export default function PrivacyPage() {
  return (
    <LegalDoc title="Privacy Policy" updated="August 2026">
      <p>
        OrderNook is a product of <strong>ZIZWE IT LIMITED</strong>{" "}
        (&quot;we&quot;, &quot;us&quot;), a company registered in England and
        Wales, company number <strong>14987632</strong>. This policy explains
        what personal data we handle and why. Questions:{" "}
        <a
          href="mailto:support@zizweit.uk"
          className="font-medium text-primary underline underline-offset-2"
        >
          support@zizweit.uk
        </a>
        .
      </p>

      <H>Two kinds of people, two roles</H>
      <p>
        <strong>Shops</strong> who sign up — the café, deli, bakery, food truck.
        For them we are the data controller.
      </p>
      <p>
        <strong>Customers</strong> who place an order. Their details are
        collected on behalf of the shop they are ordering from. That shop is the
        controller of its own customer data, and we act as its processor,
        providing the ordering tool.
      </p>

      <H>What we collect from shops</H>
      <p>
        An email address, a password (stored hashed by our authentication
        provider, never in plain text), and the shop details you enter — name,
        slug, brand colour, logo, menu items, prices, options, and opening
        settings. Subscription payment is handled by Stripe; we store only a
        Stripe customer and subscription reference, and where you enable online
        payments, your Stripe connected account ID. We never see or store your
        card number.
      </p>

      <H>What we collect from customers</H>
      <p>
        A <strong>name</strong> (required, so staff can call the order out) and
        a <strong>mobile number</strong> (optional, so the shop can reach you if
        there is a problem), plus the items ordered, the total, and the time.
        Nothing else is required — there is no customer account and no password.
      </p>
      <p>
        If you choose to turn on &quot;notify me when it&apos;s ready&quot;,
        your browser gives us a push subscription — a device-specific address
        your browser generates for this purpose. It is stored against that one
        order and used only to send that one notification. Declining costs you
        nothing but the notification.
      </p>
      <p>
        <strong>We never receive your card details.</strong> Paying online takes
        you to a checkout page hosted by Stripe, and the card data goes straight
        to Stripe and to the shop&apos;s own Stripe account. It does not pass
        through OrderNook.
      </p>

      <H>Why we use it (lawful basis)</H>
      <p>
        To provide the ordering service and the account you asked for
        (performance of a contract); to send the &quot;order ready&quot;
        notification where the customer switched it on (consent, which they can
        withdraw by clearing site permissions in their browser); to take
        subscription payments and meet our accounting obligations (contract and
        legal obligation); and to keep the service secure and prevent abuse
        (legitimate interests).
      </p>

      <H>Who processes it for us</H>
      <p>
        We use a small number of providers, strictly to run the service:{" "}
        <strong>Supabase</strong> (database, login, and image storage, hosted in
        London), <strong>Vercel</strong> (hosting), <strong>Stripe</strong>{" "}
        (shop subscriptions and customer card payments), and{" "}
        <strong>Sentry</strong> (error monitoring, EU region). Each receives
        only what it needs for its task. Sentry is configured not to send
        personal data, and session recording is switched off.
      </p>

      <H>Analytics and advertising</H>
      <p>
        We do not use analytics or advertising trackers, we do not build
        profiles of customers, and we do not sell or share personal data with
        anyone for marketing.
      </p>

      <H>Cookies and local storage</H>
      <p>
        We use essential cookies to keep shop staff signed in to the dashboard,
        and your browser&apos;s local storage to remember your basket while you
        are ordering. Both are needed for the service to work, so there is no
        tracking-cookie banner to click through — there is nothing to opt out
        of.
      </p>

      <H>Retention</H>
      <p>
        Order details are kept so the shop has a record of its trade, and for
        the periods UK tax and accounting rules require. Shop account data is
        kept while the account is active and for a reasonable period afterwards
        for legal and accounting purposes, then deleted. A push subscription is
        discarded once the order it belongs to is complete.
      </p>

      <H>Your rights</H>
      <p>
        You can ask to access, correct, or delete your personal data, or object
        to certain processing. Customers should contact the shop they ordered
        from first, since that shop controls its own order records; shops, and
        customers who cannot reach a shop, can contact us at{" "}
        <a
          href="mailto:support@zizweit.uk"
          className="font-medium text-primary underline underline-offset-2"
        >
          support@zizweit.uk
        </a>
        . You can also complain to the UK Information Commissioner&apos;s
        Office at{" "}
        <a
          href="https://ico.org.uk"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-primary underline underline-offset-2"
        >
          ico.org.uk
        </a>
        .
      </p>

      <H>Changes</H>
      <p>
        We may update this policy. Where a change materially affects you, we
        will let you know. See also our{" "}
        <Link
          href="/terms"
          className="font-medium text-primary underline underline-offset-2"
        >
          Terms of Service
        </Link>
        .
      </p>

      <Fine>
        ZIZWE IT LIMITED · Company No. 14987632 · England and Wales ·{" "}
        <a
          href="mailto:support@zizweit.uk"
          className="underline underline-offset-2"
        >
          support@zizweit.uk
        </a>
      </Fine>
    </LegalDoc>
  );
}
