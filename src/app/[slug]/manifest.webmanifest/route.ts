import { createClient } from "@/lib/supabase/server"
import { parseBranding, DEFAULT_BRANDING } from "@/lib/branding"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: shop } = await supabase
    .from("shops")
    .select("name, branding")
    .eq("slug", slug)
    .maybeSingle()

  if (!shop) return new Response("Not found", { status: 404 })

  const b = parseBranding(shop.branding)
  const icons = b.logo_url
    ? [
        {
          src: b.logo_url.replace("icon-512", "icon-192"),
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        { src: b.logo_url, sizes: "512x512", type: "image/png", purpose: "any" },
      ]
    : [{ src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" }]

  const manifest = {
    name: shop.name,
    short_name: shop.name,
    description: b.tagline ?? "Order ahead and skip the queue.",
    start_url: `/${slug}?src=pwa`,
    scope: `/${slug}`,
    display: "standalone",
    theme_color: b.primary ?? b.accent ?? DEFAULT_BRANDING.primary,
    background_color: b.background ?? DEFAULT_BRANDING.background,
    icons,
  }

  return Response.json(manifest, {
    headers: { "Content-Type": "application/manifest+json" },
  })
}
