"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { Button } from "@/components/ui/button"
import { shopUrl } from "@/components/dashboard/qr-panel"
import { t } from "@/lib/i18n"

export function QrPoster({ slug, shopName }: { slug: string; shopName: string }) {
  const [png, setPng] = useState<string>("")
  useEffect(() => {
    QRCode.toDataURL(shopUrl(slug), { width: 800, margin: 2 })
      .then(setPng)
      .catch(() => {})
  }, [slug])

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 p-8 text-center">
      <Button
        className="h-11 rounded-full px-6 print:hidden"
        onClick={() => window.print()}
      >
        {t("qr.print")}
      </Button>
      <h1 className="font-heading text-4xl font-bold">{shopName}</h1>
      <p className="text-2xl font-semibold">{t("qr.posterHeadline")}</p>
      {png && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={png} alt="QR code" className="size-72 bg-white p-4" />
      )}
      <p className="text-lg text-muted-foreground">{t("qr.posterSub")}</p>
    </main>
  )
}
