"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { CouponDoc } from "@/lib/order-types";
import { api, Badge, Card, Field, btn, btnDanger, btnGhost, fail, input, inr } from "../ui";

export default function Coupons() {
  const [rows, setRows] = useState<CouponDoc[] | null>(null);
  const [f, setF] = useState({ code: "", type: "percent", value: "", minOrderAmount: "0", usageLimit: "", expiresAt: "" });
  const load = () => api<CouponDoc[]>("/api/admin/coupons").then(setRows).catch(fail);
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/admin/coupons", { method: "POST", json: { code: f.code, type: f.type, value: Number(f.value), minOrderAmount: Number(f.minOrderAmount || 0), active: true, usageLimit: f.usageLimit ? Number(f.usageLimit) : null, expiresAt: f.expiresAt || null } });
      toast.success("Coupon created");
      setF({ code: "", type: "percent", value: "", minOrderAmount: "0", usageLimit: "", expiresAt: "" });
      load();
    } catch (err) { fail(err); }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-3">
          <Field label="Code"><input required className={input} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} /></Field>
          <Field label="Type"><select className={input} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="percent">Percent %</option><option value="fixed">Fixed ₹</option></select></Field>
          <Field label="Value"><input required type="number" min={1} className={input} value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></Field>
          <Field label="Minimum order ₹"><input type="number" min={0} className={input} value={f.minOrderAmount} onChange={(e) => setF({ ...f, minOrderAmount: e.target.value })} /></Field>
          <Field label="Usage limit (optional)"><input type="number" min={1} className={input} value={f.usageLimit} onChange={(e) => setF({ ...f, usageLimit: e.target.value })} /></Field>
          <Field label="Expires (optional)"><input type="date" className={input} value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} /></Field>
          <div className="sm:col-span-3"><button className={btn}>Create coupon</button></div>
        </form>
      </Card>
      {rows?.map((c) => (
        <Card key={c.code}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-brand-forest">{c.code} <Badge value={c.active ? "published" : "draft"} /></p>
              <p className="text-sm">{c.type === "percent" ? `${c.value}% off` : `${inr(c.value)} off`} · min {inr(c.minOrderAmount)} · used {c.usedCount}{c.usageLimit ? `/${c.usageLimit}` : ""}{c.expiresAt ? ` · expires ${c.expiresAt.slice(0, 10)}` : ""}</p>
            </div>
            <div className="flex gap-2">
              <button className={btnGhost} onClick={async () => { try { await api(`/api/admin/coupons/${encodeURIComponent(c.code)}`, { method: "PUT", json: { active: !c.active } }); load(); } catch (e) { fail(e); } }}>{c.active ? "Disable" : "Enable"}</button>
              <button className={btnDanger} onClick={async () => { if (confirm(`Delete ${c.code}?`)) { try { await api(`/api/admin/coupons/${encodeURIComponent(c.code)}`, { method: "DELETE" }); load(); } catch (e) { fail(e); } } }}>Delete</button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
