import { NextResponse } from "next/server"
import sharp from "sharp"
import { createClient } from "@/lib/supabase/server"
import { parseBranding } from "@/lib/branding"

export const runtime = "nodejs"

const SIZES = [512, 192, 180] as const
const MAX_BYTES = 4 * 1024 * 1024

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { data: staff } = await supabase
    .from("staff_users")
    .select("shop_id")
    .eq("auth_user_id", user.id)
    .limit(1)
    .maybeSingle()
  const shopId = staff?.shop_id
  if (!shopId) return NextResponse.json({ error: "no_shop" }, { status: 403 })

  const form = await request.formData()
  const file = form.get("logo")
  if (!(file instanceof File))
    return NextResponse.json({ error: "no_file" }, { status: 400 })
  if (!file.type.startsWith("image/"))
    return NextResponse.json({ error: "not_image" }, { status: 400 })
  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: "too_large" }, { status: 400 })

  const input = Buffer.from(await file.arrayBuffer())
  // Flatten alpha onto white (prevents iOS black-box on transparent PNGs).
  const base = sharp(input).flatten({ background: "#ffffff" })

  try {
    for (const size of SIZES) {
      const png = await base
        .clone()
        .resize(size, size, { fit: "cover", position: "centre" })
        .png()
        .toBuffer()
      // Pass a Blob, not a Node Buffer: a raw Buffer body is UTF-8-stringified
      // by undici on Vercel (corrupting the image); a Blob goes as multipart.
      const { error } = await supabase.storage
        .from("shop-logos")
        .upload(`${shopId}/icon-${size}.png`, new Blob([new Uint8Array(png)], { type: "image/png" }), {
          upsert: true,
        })
      if (error)
        return NextResponse.json({ error: "upload_failed" }, { status: 500 })
    }
  } catch {
    // sharp couldn't decode the file (corrupt/unsupported image that slipped
    // past the MIME-type check, which only trusts the browser's Content-Type).
    return NextResponse.json({ error: "invalid_image" }, { status: 400 })
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("shop-logos").getPublicUrl(`${shopId}/icon-512.png`)

  // Merge logo_url into existing branding jsonb (don't clobber tagline/accent).
  const { data: shop, error: readErr } = await supabase
    .from("shops")
    .select("branding")
    .eq("id", shopId)
    .single()
  if (readErr)
    return NextResponse.json({ error: "save_failed" }, { status: 500 })
  const nextBranding = { ...parseBranding(shop?.branding), logo_url: publicUrl }
  const { error: upErr } = await supabase
    .from("shops")
    .update({ branding: nextBranding })
    .eq("id", shopId)
  if (upErr)
    return NextResponse.json({ error: "save_failed" }, { status: 500 })

  return NextResponse.json({ logo_url: publicUrl })
}
