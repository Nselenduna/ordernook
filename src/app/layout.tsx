import type { Metadata, Viewport } from "next";
import {
  DM_Sans,
  Fraunces,
  Inter,
  Plus_Jakarta_Sans,
  Poppins,
} from "next/font/google";
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
// Kupa Green (marketing site)
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: {
    default: t("app.name"),
    template: `%s · ${t("app.name")}`,
  },
  description: t("app.description"),
  manifest: "/manifest.webmanifest",
  icons: {
    // Needed for iOS "Add to Home Screen" on dashboard pages (manifest ignored by Safari).
    apple: "/icons/icon-180.png",
  },
  // Without this, iOS never treats an installed icon as a real standalone
  // app — "Add to Home Screen" degrades to an ordinary Safari bookmark, so
  // navigator.standalone/display-mode never flips and the manifest's
  // start_url is not reliably honoured either.
  appleWebApp: {
    capable: true,
    title: t("app.name"),
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#1D6F4C",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${dmSans.variable} ${jakarta.variable} ${inter.variable} ${poppins.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster position="top-center" />
        <SwRegister />
      </body>
    </html>
  );
}
