"use client";

import { useEffect, useState } from "react";
import type { MessageDoc, ReviewDoc } from "@/lib/indira-firestore";
import { api, Badge, Card, btnDanger, btnGhost, fail, fmtDate } from "../ui";

export default function Inbox() {
  const [sub, setSub] = useState<"reviews" | "messages" | "subscribers">("reviews");
  const [reviews, setReviews] = useState<ReviewDoc[]>([]);
  const [messages, setMessages] = useState<MessageDoc[]>([]);
  const [subs, setSubs] = useState<{ email: string; createdAt: string }[]>([]);

  const load = () => {
    api<ReviewDoc[]>("/api/admin/reviews").then(setReviews).catch(fail);
    api<MessageDoc[]>("/api/admin/messages").then(setMessages).catch(fail);
    api<{ email: string; createdAt: string }[]>("/api/admin/newsletter").then(setSubs).catch(fail);
  };
  useEffect(load, []);

  const act = async (fn: () => Promise<unknown>) => { try { await fn(); load(); } catch (e) { fail(e); } };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5">
        {(["reviews", "messages", "subscribers"] as const).map((t) => (
          <button key={t} onClick={() => setSub(t)} className={`rounded-full px-4 py-1.5 text-sm capitalize ${sub === t ? "bg-brand-forest text-brand-ivory" : "bg-white"}`}>
            {t} ({t === "reviews" ? reviews.length : t === "messages" ? messages.length : subs.length})
          </button>
        ))}
      </div>

      {sub === "reviews" && reviews.map((r) => (
        <Card key={r.id}>
          <div className="flex justify-between gap-2"><p className="font-semibold">{r.customerName} · {"★".repeat(r.rating)}</p><Badge value={r.status} /></div>
          <p className="text-xs text-brand-charcoal/50">{r.productName} · {fmtDate(r.createdAt)}</p>
          {r.title && <p className="mt-1 font-medium">{r.title}</p>}
          <p className="text-sm">{r.body}</p>
          <div className="mt-2 flex gap-2">
            {r.status !== "approved" && <button className={btnGhost} onClick={() => act(() => api(`/api/admin/reviews/${r.id}`, { method: "PATCH", json: { status: "approved" } }))}>Approve</button>}
            {r.status !== "rejected" && <button className={btnGhost} onClick={() => act(() => api(`/api/admin/reviews/${r.id}`, { method: "PATCH", json: { status: "rejected" } }))}>Reject</button>}
            <button className={btnDanger} onClick={() => confirm("Delete review?") && act(() => api(`/api/admin/reviews/${r.id}`, { method: "DELETE" }))}>Delete</button>
          </div>
        </Card>
      ))}

      {sub === "messages" && messages.map((m) => (
        <Card key={m.id}>
          <div className="flex justify-between gap-2"><p className="font-semibold">{m.subject}</p><Badge value={m.status} /></div>
          <p className="text-xs text-brand-charcoal/50">{m.name} · {m.email}{m.phone ? ` · ${m.phone}` : ""} · {fmtDate(m.createdAt)}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{m.message}</p>
          <div className="mt-2 flex gap-2">
            {m.status !== "read" && <button className={btnGhost} onClick={() => act(() => api(`/api/admin/messages/${m.id}`, { method: "PATCH", json: { status: "read" } }))}>Mark read</button>}
            {m.status !== "resolved" && <button className={btnGhost} onClick={() => act(() => api(`/api/admin/messages/${m.id}`, { method: "PATCH", json: { status: "resolved" } }))}>Resolved</button>}
          </div>
        </Card>
      ))}

      {sub === "subscribers" && (
        <Card>{subs.length === 0 ? "No subscribers yet." : subs.map((s) => <p key={s.email} className="flex justify-between border-b border-brand-brown/10 py-1 text-sm last:border-0"><span>{s.email}</span><span className="text-xs text-brand-charcoal/50">{fmtDate(s.createdAt)}</span></p>)}</Card>
      )}
      {sub !== "subscribers" && (sub === "reviews" ? reviews : messages).length === 0 && <p className="py-8 text-center text-brand-charcoal/50">Nothing here yet.</p>}
    </div>
  );
}
