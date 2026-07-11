import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Next 16 proxy (replaces middleware.ts). Runs on /dashboard routes only:
 * refreshes the Supabase auth session cookie and gates access —
 * unauthenticated users go to /dashboard/login, signed-in users skip it.
 */
export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() validates the JWT against Supabase (not just the cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isLoginPage = request.nextUrl.pathname.startsWith("/dashboard/login")

  if (!user && !isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard/login", request.url))
  }
  if (user && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return response
}

export const config = {
  // :path* matches zero or more segments, so this covers /dashboard itself too.
  matcher: ["/dashboard/:path*"],
}
