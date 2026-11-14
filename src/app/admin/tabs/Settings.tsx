"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { SiteSettings } from "@/lib/order-types";
import { api, Card, Field, btn, fail, input } from "../ui";

export default function SettingsTab() {
  const [s, setS] = useState<SiteSettings | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api<SiteSettings>("/api/admin/settings").then(setS).catch(fail); }, []);
  if (!s) return <p className="py-10 text-center text-brand-charcoal/50">Loading settings…</p>;
  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) => setS({ ...s, [k]: v });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/admin/settings", { method: "PUT", json: { ...s, instagramUrl: s!.instagramUrl ?? "", facebookUrl: s!.facebookUrl ?? "" } });
      toast.success("Settings saved");
    } catch (err) { fail(err); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <Card className="grid gap-3 sm:grid-cols-2">
        <p className="font-semibold text-brand-forest sm:col-span-2">WhatsApp &amp; contact</p>
        <Field label="WhatsApp order number (with country code, digits only)"><input required className={input} value={s.whatsappNumber} onChange={(e) => set("whatsappNumber", e.target.value.replace(/\D/g, ""))} /></Field>
        <Field label="Phone shown on website"><input required className={input} value={s.supportPhone} onChange={(e) => set("supportPhone", e.target.value)} /></Field>
        <Field label="Support email"><input required type="email" className={input} value={s.supportEmail} onChange={(e) => set("supportEmail", e.target.value)} /></Field>
        <Field label="Business address"><input required className={input} value={s.businessAddress} onChange={(e) => set("businessAddress", e.target.value)} /></Field>
        <Field label="Instagram URL"><input className={input} value={s.instagramUrl ?? ""} onChange={(e) => set("instagramUrl", e.target.value)} /></Field>
        <Field label="Facebook URL"><input className={input} value={s.facebookUrl ?? ""} onChange={(e) => set("facebookUrl", e.target.value)} /></Field>
      </Card>
      <Card className="grid gap-3 sm:grid-cols-2">
        <p className="font-semibold text-brand-forest sm:col-span-2">Delivery &amp; payment</p>
        <Field label="Free delivery above ₹"><input type="number" min={0} className={input} value={s.freeShippingThreshold} onChange={(e) => set("freeShippingThreshold", Number(e.target.value))} /></Field>
        <Field label="Delivery charge ₹"><input type="number" min={0} className={input} value={s.flatShippingRate} onChange={(e) => set("flatShippingRate", Number(e.target.value))} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.codEnabled} onChange={(e) => set("codEnabled", e.target.checked)} /> Accept orders (Cash on Delivery)</label>
      </Card>
      <Card className="grid gap-3">
        <p className="font-semibold text-brand-forest">Website text</p>
        <Field label="Top announcement bar"><input required className={input} value={s.announcementText} onChange={(e) => set("announcementText", e.target.value)} /></Field>
        <Field label="Hero headline"><input required className={input} value={s.heroHeadline} onChange={(e) => set("heroHeadline", e.target.value)} /></Field>
        <Field label="Hero sub-text"><textarea required rows={2} className={input} value={s.heroSubtext} onChange={(e) => set("heroSubtext", e.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Primary button"><input required className={input} value={s.heroCtaPrimaryLabel} onChange={(e) => set("heroCtaPrimaryLabel", e.target.value)} /></Field>
          <Field label="Secondary button"><input required className={input} value={s.heroCtaSecondaryLabel} onChange={(e) => set("heroCtaSecondaryLabel", e.target.value)} /></Field>
        </div>
      </Card>
      <div><button className={btn} disabled={busy}>{busy ? "Saving…" : "Save settings"}</button></div>
    </form>
  );
}
