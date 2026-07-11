import { redirect } from "next/navigation";

// Phase 0: single hard-coded test shop. Phase 1 replaces this with
// subdomain routing / a marketing landing page.
export default function Home() {
  redirect(`/${process.env.NEXT_PUBLIC_SHOP_SLUG ?? "corner-grind"}`);
}
