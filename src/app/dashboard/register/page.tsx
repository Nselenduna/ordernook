"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { t } from "@/lib/i18n"
import { createClient } from "@/lib/supabase/client"
import { slugify, validateSlug } from "@/lib/slug"

type SlugState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok" }
  | { kind: "bad"; msg: string }

export default function RegisterPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [recovery, setRecovery] = useState(false) // authed but no shop
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [emailErr, setEmailErr] = useState<string | null>(null)
  const [slugState, setSlugState] = useState<SlugState>({ kind: "idle" })
  const [submitting, setSubmitting] = useState(false)
  const checkSeq = useRef(0)

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

  // Auto-derive slug from name until the user edits the slug themselves.
  function onName(v: string) {
    setName(v)
    if (!slugTouched) setSlug(slugify(v))
  }
  function onSlug(v: string) {
    setSlugTouched(true)
    setSlug(slugify(v))
  }

  // Debounced availability check.
  useEffect(() => {
    const s = slug
    const fmt = validateSlug(s)
    if (fmt) {
      const map: Record<string, string> = {
        too_short: t("register.slugTooShort"),
        too_long: t("register.slugInvalid"),
        bad_format: t("register.slugInvalid"),
        reserved: t("register.slugReserved"),
      }
      setSlugState({ kind: "bad", msg: map[fmt] })
      return
    }
    setSlugState({ kind: "checking" })
    const seq = ++checkSeq.current
    const id = setTimeout(async () => {
      const { data } = await supabase.from("shops").select("slug").eq("slug", s).maybeSingle()
      if (seq !== checkSeq.current) return // superseded
      setSlugState(data ? { kind: "bad", msg: t("register.slugTaken") } : { kind: "ok" })
    }, 400)
    return () => clearTimeout(id)
  }, [slug, supabase])

  const canSubmit =
    name.trim().length > 0 &&
    slugState.kind === "ok" &&
    (recovery || (/.+@.+\..+/.test(email) && password.length > 0)) &&
    !submitting

  function mapRpcError(message: string) {
    if (message.includes("slug_taken")) return setSlugState({ kind: "bad", msg: t("register.slugTaken") })
    if (message.includes("slug_reserved")) return setSlugState({ kind: "bad", msg: t("register.slugReserved") })
    if (message.includes("slug_invalid")) return setSlugState({ kind: "bad", msg: t("register.slugInvalid") })
    if (message.includes("already_registered")) return router.replace("/dashboard")
    toast.error(t("register.errorGeneric"))
  }

  async function createShop() {
    const { error } = await supabase.rpc("register_shop", { p_name: name.trim(), p_slug: slug })
    if (error) { mapRpcError(error.message); return false }
    router.push("/dashboard")
    router.refresh()
    return true
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
        // signUp succeeded — if createShop() below fails (e.g. slug lost the race),
        // a retry must not re-call signUp with the now-existing email (which would
        // wrongly show "already registered"). Recovery mode retries go straight to
        // the RPC with just name+slug, which is correct since the account now exists.
        setRecovery(true)
      }
      await createShop()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="theme-travo flex flex-1 flex-col items-center justify-center bg-background px-4 text-foreground">
      <Card className="w-full max-w-sm shadow-[0_4px_16px_rgba(123,97,255,.10)] ring-0">
        <CardHeader>
          <CardTitle className="font-heading text-xl">{t("register.title")}</CardTitle>
          <CardDescription>{recovery ? t("register.recoveryNote") : t("register.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reg-name">{t("register.name")}</Label>
              <Input id="reg-name" required maxLength={80} value={name} placeholder={t("register.namePlaceholder")}
                onChange={(e) => onName(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reg-slug">{t("register.slug")}</Label>
              <div className="flex items-center gap-1 rounded-xl border px-3 h-11">
                <span className="text-sm text-muted-foreground">ordernook.uk/</span>
                <input id="reg-slug" value={slug} onChange={(e) => onSlug(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm" autoCapitalize="none" autoCorrect="off" />
              </div>
              <p className="text-xs h-4" data-testid="slug-status">
                {slugState.kind === "checking" && t("register.slugChecking")}
                {slugState.kind === "ok" && <span className="text-green-600">{t("register.slugAvailable")}</span>}
                {slugState.kind === "bad" && <span className="text-red-600">{slugState.msg}</span>}
              </p>
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
                  <Input id="reg-password" type="password" required autoComplete="new-password" value={password}
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
