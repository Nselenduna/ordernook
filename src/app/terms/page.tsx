import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc, H, Fine } from "@/components/marketing/legal-doc";

export const metadata: Metadata = {
  title: "Terms of Service — OrderNook",
  description:
    "The terms that govern use of OrderNook by shops and their customers.",
};

// NOTE: Written to match what the product actually does (single £12 tier,
// 30-day trial, zero commission, Stripe Connect direct charges). Have a UK
// solicitor review before relying on it.
export default function TermsPage() {
  return (
    <LegalDoc title="Terms of Service" updated="August 2026">
      <p>
        These terms govern your use of OrderNook, a product of{" "}
        <strong>ZIZWE IT LIMITED</strong> (&quot;we&quot;, &quot;us&quot;),
        a company registered in England and Wales, company number{" "}
        <strong>14987632</strong>. By creating an account you agree to them.
      </p>

      <H>The service</H>
      <p>
        OrderNook gives a shop its own branded ordering page and a live
        dashboard, so its customers can order ahead from their phone — usually
        by scanning a QR code on the counter. We provide the software. The shop
        is responsible for its menu, prices, allergen and ingredient
        information, opening hours, and for preparing and honouring the orders
        it accepts.
      </p>

      <H>Who sells what</H>
      <p>
        When a customer places an order, the contract for that food or drink is
        between the <strong>customer and the shop</strong>. We are not the
        seller, and we do not prepare, handle, or deliver anything. Questions,
        complaints, allergy queries, and refunds relating to an order are
        matters for the shop.
      </p>

      <H>Trial and billing</H>
      <p>
        A new shop gets a <strong>30-day free trial with no card required</strong>.
        After that, continued use requires a subscription at{" "}
        <strong>£12 per month</strong>, billed monthly in advance through
        Stripe, renewing automatically until cancelled. There is no setup fee
        and no minimum term.
      </p>
      <p>
        If the trial ends without a subscription, the shop&apos;s ordering page
        is paused and new orders are refused, but its menu and settings are kept
        so it can pick up where it left off by subscribing.
      </p>

      <H>Zero commission</H>
      <p>
        We take <strong>no commission on any order</strong>, on any plan. Where
        a shop enables online card payment, the payment is made directly to that
        shop&apos;s own Stripe account — customer money never passes through us
        and we take no fee from it. Stripe&apos;s own fees and{" "}
        <a
          href="https://stripe.com/gb/legal/connect-account"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-primary underline underline-offset-2"
        >
          connected account agreement
        </a>{" "}
        apply between the shop and Stripe.
      </p>

      <H>Cancellation and refunds</H>
      <p>
        <strong>Your subscription.</strong> You can cancel at any time from the
        billing portal in your dashboard. Access continues until the end of the
        period you have already paid for. Subscription fees already paid are
        non-refundable except where the law requires otherwise.
      </p>
      <p>
        <strong>Customer orders.</strong> If a shop rejects an order that the
        customer already paid for online, OrderNook refunds that customer{" "}
        <strong>in full, automatically</strong>, back to the original payment
        method. Any other refund — a change of mind, a problem with the order, a
        goodwill gesture — is issued by the shop from its own Stripe account,
        and the shop&apos;s own refund policy and consumer law apply.
      </p>

      <H>Your account</H>
      <p>
        Keep your login details secure; you are responsible for activity under
        your account. One account runs one shop. Tell us promptly at{" "}
        <a
          href="mailto:support@zizweit.uk"
          className="font-medium text-primary underline underline-offset-2"
        >
          support@zizweit.uk
        </a>{" "}
        if you believe your account has been accessed by someone else.
      </p>

      <H>Acceptable use</H>
      <p>
        Don&apos;t use OrderNook for anything unlawful, to misrepresent a
        business you do not run, to sell age-restricted goods without meeting
        your legal obligations, to send spam, or to interfere with the
        service&apos;s security or operation. We may suspend or end an account
        that breaches these terms.
      </p>

      <H>Customer data</H>
      <p>
        Customer details collected through your ordering page belong to your
        business, and you are responsible for handling them lawfully, including
        under UK GDPR. We process them only to run the service for you, as set
        out in our{" "}
        <Link
          href="/privacy"
          className="font-medium text-primary underline underline-offset-2"
        >
          Privacy Policy
        </Link>
        .
      </p>

      <H>Availability and liability</H>
      <p>
        We work to keep OrderNook running, but we do not guarantee
        uninterrupted availability, and parts of the service depend on
        third parties such as Stripe, Supabase, and Vercel. Push notifications
        depend on the customer&apos;s browser and device and are not guaranteed
        to arrive. To the extent permitted by law, our total liability for any
        claim relating to the service is limited to the fees you paid us in the
        three months before the claim. Nothing here limits liability that cannot
        be limited by law.
      </p>

      <H>Ending the agreement</H>
      <p>
        You may stop using OrderNook at any time by cancelling your
        subscription. We may end or suspend an account for a serious or repeated
        breach of these terms, and will tell you why unless we are prevented
        from doing so.
      </p>

      <H>Changes</H>
      <p>
        We may update these terms. Where a change materially affects you, we
        will let you know. Continuing to use OrderNook after a change means you
        accept the updated terms.
      </p>

      <H>Governing law</H>
      <p>
        These terms are governed by the law of England and Wales, and the courts
        of England and Wales have jurisdiction. If you are a consumer, this does
        not remove protections you have under the law of the country you live
        in.
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
