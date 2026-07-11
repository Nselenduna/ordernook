import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces, Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SwRegister } from "@/components/pwa/sw-register";
import { t } from "@/lib/i18n";
import "./globals.css";

// Latte Glass (customer pages)
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
// Travo Purple (dashboard)
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: t("app.name"),
    template: `%s · ${t("app.name")}`,
  },
  description: t("app.description"),
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  // Phase 0: hardcoded test-shop brand colour (per-tenant in Phase 1).
  themeColor: "#6F4E37",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${dmSans.variable} ${jakarta.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster position="top-center" />
        <SwRegister />
      </body>
    </html>
  );
}
