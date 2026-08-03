import { NextResponse } from "next/server"
import sharp from "sharp"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const MAX_BYTES = 10 * 1024 * 1024

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const form = await request.formData()
  const file = form.get("file")
  const itemId = form.get("item_id")
  if (!(file instanceof File))
    return NextResponse.json({ error: "no_file" }, { status: 400 })
  if (typeof itemId !== "string")
    return NextResponse.json({ error: "no_item" }, { status: 400 })
  if (!file.type.startsWith("image/"))
    return NextResponse.json({ error: "not_image" }, { status: 400 })
  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: "too_large" }, { status: 400 })

  // Resolve the item's shop and verify the caller staffs it — the client
  // never dictates the shop folder.
  const { data: item } = await supabase
    .from("menu_items")
    .select("shop_id")
    .eq("id", itemId)
    .single()
  if (!item) return NextResponse.json({ error: "no_item" }, { status: 404 })
  const { data: staff } = await supabase
    .from("staff_users")
    .select("shop_id")
    .eq("auth_user_id", user.id)
    .eq("shop_id", item.shop_id)
    .maybeSingle()
  if (!staff) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const input = Buffer.from(await file.arrayBuffer())
  let webp: Buffer
  try {
    webp = await sharp(input)
      .rotate() // honour EXIF orientation
      .resize(800, 800, { fit: "cover", position: "centre" })
      .webp({ quality: 80 })
      .toBuffer()
  } catch {
    // sharp couldn't decode (corrupt/unsupported image past the MIME check).
    return NextResponse.json({ error: "invalid_image" }, { status: 400 })
  }

  const path = `${item.shop_id}/${itemId}.webp`
  // Pass a Blob, not a Node Buffer: supabase-js sends a Blob as multipart
  // form-data (binary-safe), whereas a raw Buffer body is UTF-8-stringified by
  // undici on Vercel — corrupting the image (the "broken image" bug).
  const { error: upErr } = await supabase.storage
    .from("menu-photos")
    .upload(path, new Blob([new Uint8Array(webp)], { type: "image/webp" }), {
      upsert: true,
    })
  if (upErr)
    return NextResponse.json({ error: "upload_failed" }, { status: 500 })

  const {
    data: { publicUrl },
  } = supabase.storage.from("menu-photos").getPublicUrl(path)
  // Re-uploads reuse the same path, so version the stored URL to bust caches
  // everywhere (customers included).
  const photo_url = `${publicUrl}?v=${Date.now()}`
  const { error: saveErr } = await supabase
    .from("menu_items")
    .update({ photo_url })
    .eq("id", itemId)
  if (saveErr)
    return NextResponse.json({ error: "save_failed" }, { status: 500 })

  return NextResponse.json({ photo_url })
}
