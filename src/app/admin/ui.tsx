"use client";

import type { ReactNode } from "react";
import { toast } from "sonner";

export async function api<T = Record<string, unknown>>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    cache: "no-store",
  });
  if (res.status === 401) {
    window.dispatchEvent(new Event("admin-auth-lost"));
    throw new Error("Session expired. Please sign in again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Request failed");
  return data as T;
}

export const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : "Something went wrong");

export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** Date key (YYYY-MM-DD) in Indian time. */
export const istDay = (iso: string) => new Date(new Date(iso).getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
export const todayIst = () => istDay(new Date().toISOString());

export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));

export const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-sky-100 text-sky-800",
  processing: "bg-indigo-100 text-indigo-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-700",
  new: "bg-amber-100 text-amber-800",
  read: "bg-sky-100 text-sky-800",
  resolved: "bg-green-100 text-green-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-700",
  published: "bg-green-100 text-green-800",
  draft: "bg-gray-200 text-gray-700",
  paid: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-700",
  refunded: "bg-gray-200 text-gray-700",
};

export function Badge({ value }: { value: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${STATUS_STYLE[value] ?? "bg-gray-100 text-gray-700"}`}>
      {value}
    </span>
  );
}

export const input =
  "w-full rounded-lg border border-brand-brown/30 bg-white px-3 py-2 text-sm outline-none focus:border-brand-forest";
export const btn =
  "rounded-full bg-brand-forest px-4 py-2 text-sm font-semibold text-brand-ivory hover:bg-brand-leaf disabled:opacity-50";
export const btnGhost =
  "rounded-full border border-brand-forest/40 px-4 py-2 text-sm font-semibold text-brand-forest hover:bg-brand-forest hover:text-brand-ivory disabled:opacity-50";
export const btnDanger =
  "rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-600 hover:text-white disabled:opacity-50";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-brand-brown/10 bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

export function Stat({ label, value, sub, onClick }: { label: string; value: ReactNode; sub?: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="rounded-2xl border border-brand-brown/10 bg-white p-4 text-left shadow-sm enabled:hover:border-brand-forest"
    >
      <p className="text-xs uppercase tracking-wide text-brand-charcoal/50">{label}</p>
      <p className="mt-1 font-serif text-2xl text-brand-forest">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-brand-charcoal/50">{sub}</p>}
    </button>
  );
}

export function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-brand-charcoal/60">{label}</span>
      {children}
    </label>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-brand-ivory p-5 sm:rounded-3xl ${wide ? "sm:max-w-3xl" : "sm:max-w-xl"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-xl text-brand-forest">{title}</h3>
          <button onClick={onClose} className="rounded-full px-3 py-1 text-xl leading-none text-brand-charcoal/60 hover:bg-black/5" aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
