"use client";

import { useEffect, useState } from "react";
import type { CustomerDoc } from "@/lib/indira-firestore";
import { whatsappDigits } from "@/lib/whatsapp";
import { api, Card, fail, fmtDate, input, inr } from "../ui";

export default function Customers() {
  const [rows, setRows] = useState<CustomerDoc[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => { api<CustomerDoc[]>("/api/admin/customers").then(setRows).catch(fail); }, []);
  if (!rows) return <p className="py-10 text-center text-brand-charcoal/50">Loading customers…</p>;
  const n = q.trim().toLowerCase();
  const list = rows.filter((c) => !n || `${c.name} ${c.phone} ${c.city} ${c.email}`.toLowerCase().includes(n));
  return (
    <div className="flex flex-col gap-3">
      <input className={input} placeholder="Search name, phone, city…" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.length === 0 && <p className="py-8 text-center text-brand-charcoal/50">No customers yet. They appear automatically when someone orders.</p>}
      {list.map((c) => (
        <Card key={c.phone}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-brand-forest">{c.name}</p>
              <p className="text-sm">{c.phone} · {c.email}</p>
              <p className="text-xs text-brand-charcoal/60">{c.addressLine1}, {c.city}, {c.state} – {c.pincode}</p>
              <p className="text-xs text-brand-charcoal/50">Last order {fmtDate(c.lastOrderAt)}</p>
            </div>
            <div className="text-right">
              <p className="font-serif text-lg">{inr(c.totalSpent)}</p>
              <p className="text-xs text-brand-charcoal/60">{c.ordersCount} order(s)</p>
              <a className="text-xs font-semibold text-[#128C7E] underline" href={`https://wa.me/${whatsappDigits(c.phone)}`} target="_blank" rel="noreferrer">WhatsApp</a>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
