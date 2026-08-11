"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { t } from "@/lib/i18n"
import { createClient } from "@/lib/supabase/client"
import { slugify } from "@/lib/slug"
import { OnPill } from "@/components/marketing/on-logo"

// Slug is derived from the business name and resolved to a free one behind
// the scenes — the shop's link isn't shown at signup. Owners see and manage
// it later from the dashboard's QR page.
function baseSlugFor(name: string): string {
  const s = slugify(name)
  return s.length >= 3 ? s : `shop-${s || "new"}`
}

const MAX_SLUG_ATTEMPTS = 30

export default function RegisterPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [recovery, setRecovery] = useState(false) // authed but no shop
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [emailErr, setEmailErr] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // On load: authed + already has a shop → dashboard; authed + no shop → recovery.
  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !active) return
      const { data } = await supabase.from("staff_users").select("id").limit(1).maybeSingle()
      if (!active) return
      if (data) router.replace("/dashboard")
      else setRecovery(true)
    })()
    return () => { active = false }
  }, [supabase, router])

  const canSubmit =
    name.trim().length > 0 &&
    (recovery || (/.+@.+\..+/.test(email) && password.length > 0)) &&
    !submitting

  // Tries the derived slug, then -2, -3, ... until register_shop accepts one.
  // Any reserved/invalid/taken candidate just moves to the next suffix —
  // there's no slug field for the user to fix a rejection on.
  async function registerWithUniqueSlug(): Promise<boolean> {
    const base = baseSlugFor(name)
    for (let i = 0; i < MAX_SLUG_ATTEMPTS; i++) {
      const candidate = i === 0 ? base : `${base}-${i + 1}`
      const { error } = await supabase.rpc("register_shop", { p_name: name.trim(), p_slug: candidate })
      if (!error) {
        router.push("/dashboard")
        router.refresh()
        return true
      }
      if (error.message.includes("already_registered")) {
        router.replace("/dashboard")
        return true
      }
      if (
        error.message.includes("slug_taken") ||
        error.message.includes("slug_reserved") ||
        error.message.includes("slug_invalid")
      ) {
        continue
      }
      toast.error(t("register.errorGeneric"))
      return false
    }
    toast.error(t("register.errorGeneric"))
    return false
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setEmailErr(null)
    try {
      if (!recovery) {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
        if (error) {
          if (/registered|already/i.test(error.message)) setEmailErr(t("register.errorEmailTaken"))
          else if (/password/i.test(error.message)) toast.error(t("register.errorPassword"))
          else toast.error(t("register.errorGeneric"))
          return
        }
        if (!data.session) { toast.error(t("register.errorConfirmEmail")); return }
        // signUp succeeded — if registerWithUniqueSlug() below fails, a retry
        // must not re-call signUp with the now-existing email (which would
        // wrongly show "already registered"). Recovery mode retries go
        // straight to the RPC, which is correct since the account now exists.
        setRecovery(true)
      }
      await registerWithUniqueSlug()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="theme-kupa flex flex-1 flex-col items-center justify-center bg-background px-4 text-foreground">
      <Link href="/" aria-label="OrderNook home" className="mb-6">
        <OnPill height={48} />
      </Link>
      <Card className="w-full max-w-sm shadow-[0_4px_16px_rgba(29,111,76,.10)] ring-0">
        <CardHeader>
          <CardTitle className="font-heading text-xl text-[color:var(--brand-dark)]">{t("register.title")}</CardTitle>
          <CardDescription>{recovery ? t("register.recoveryNote") : t("register.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reg-name">{t("register.name")}</Label>
              <Input id="reg-name" required maxLength={80} value={name}
                onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" />
            </div>
            {!recovery && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="reg-email">{t("register.email")}</Label>
                  <Input id="reg-email" type="email" required autoComplete="email" value={email}
                    onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl" />
                  {emailErr && <p className="text-xs text-red-600">{emailErr} <Link href="/dashboard/login" className="underline">{t("register.logIn")}</Link></p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="reg-password">{t("register.password")}</Label>
                  <PasswordInput id="reg-password" required autoComplete="new-password" value={password}
                    onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-xl" />
                </div>
              </>
            )}
            <Button type="submit" disabled={!canSubmit} className="h-11 w-full rounded-full">
              {submitting ? t("register.submitting") : t("register.submit")}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t("register.haveShop")} <Link href="/dashboard/login" className="underline">{t("register.logIn")}</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
