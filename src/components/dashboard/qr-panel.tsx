"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import QRCode from "qrcode"
import { toast } from "sonner"
import { Button, buttonVariants } from "@/components/ui/button"
import { t } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export function shopUrl(slug: string): string {
  return `https://ordernook.uk/${slug}?src=qr`
}

export function QrPanel({ slug }: { slug: string }) {
  const url = shopUrl(slug)
  const [png, setPng] = useState<string>("")

  useEffect(() => {
    QRCode.toDataURL(url, { width: 512, margin: 2 }).then(setPng).catch(() => {})
  }, [url])

  const copy = async () => {
    await navigator.clipboard.writeText(url)
    toast.success(t("qr.copied"))
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-4 px-4 py-6 text-center">
      <div>
        <h2 className="font-heading text-xl font-semibold">{t("qr.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("qr.subtitle")}</p>
      </div>
      {png && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={png}
          alt="QR code"
          className="size-56 rounded-2xl border border-border bg-white p-3"
        />
      )}
      <p className="break-all text-sm text-muted-foreground">{url}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {/* Button (base-ui) has no `asChild` prop, so these two links are
            styled manually with buttonVariants to match Button's look. */}
        <a
          href={png}
          download={`ordernook-${slug}-qr.png`}
          className={cn(buttonVariants(), "h-11 rounded-full px-5")}
        >
          {t("qr.download")}
        </a>
        <Button variant="secondary" className="h-11 rounded-full px-5" onClick={copy}>
          {t("qr.copyLink")}
        </Button>
        <Link
          href="/dashboard/qr/poster"
          className={cn(buttonVariants({ variant: "ghost" }), "h-11 rounded-full px-5")}
        >
          {t("qr.openPoster")}
        </Link>
      </div>
    </main>
  )
}
