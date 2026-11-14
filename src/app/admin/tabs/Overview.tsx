"use client";

import { useEffect, useState } from "react";
import { api, Badge, Card, Stat, fail, inr } from "../ui";

type Bucket = { key: string; orders: number; revenue: number; pending: number; delivered: number; cancelled: number };
type Stats = {
  totalOrders: number;
  totalRevenue: number;
  deliveredRevenue: number;
  pendingOrders: number;
  ordersByStatus: Record<string, number>;
  todayOrders: number;
  todayRevenue: number;
  monthOrders: number;
  monthRevenue: number;
  codToCollect: number;
  productCount: number;
  outOfStockVariants: number;
  lowStock: { productId: number; productName: string; variantLabel: string; stock: number }[];
  customerCount: number;
  pendingReviewCount: number;
  newMessageCount: number;
  daily: Bucket[];
  monthly: Bucket[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (k: string) => `${MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`;
const dayLabel = (k: string) => `${k.slice(8, 10)} ${MONTHS[Number(k.slice(5, 7)) - 1]}`;

export default function Overview({ goOrders, goProducts }: { goOrders: (f: string) => void; goProducts: () => void }) {
  const [s, setS] = useState<Stats | null>(null);
  const [view, setView] = useState<"daily" | "monthly">("daily");

  useEffect(() => {
    api<Stats>("/api/admin/stats").then(setS).catch(fail);
  }, []);

  if (!s) return <p className="py-10 text-center text-brand-charcoal/50">Loading dashboard…</p>;

  const rows = view === "daily" ? [...s.daily].reverse() : [...s.monthly].reverse();
  const max = Math.max(1, ...s.daily.map((d) => d.revenue));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Today's orders" value={s.todayOrders} sub={inr(s.todayRevenue)} onClick={() => goOrders("today")} />
        <Stat label="Pending (to confirm)" value={s.pendingOrders} sub="Tap to review" onClick={() => goOrders("pending")} />
        <Stat label="This month" value={s.monthOrders} sub={inr(s.monthRevenue)} onClick={() => goOrders("month")} />
        <Stat label="Delivered" value={s.ordersByStatus.delivered ?? 0} sub={inr(s.deliveredRevenue)} onClick={() => goOrders("delivered")} />
        <Stat label="Total orders" value={s.totalOrders} sub={`${inr(s.totalRevenue)} booked`} onClick={() => goOrders("all")} />
        <Stat label="COD to collect" value={inr(s.codToCollect)} sub="Shipped, not yet paid" onClick={() => goOrders("shipped")} />
        <Stat label="Customers" value={s.customerCount} />
        <Stat label="Out-of-stock sizes" value={s.outOfStockVariants} sub={`${s.productCount} products`} onClick={goProducts} />
      </div>

      <Card>
        <p className="mb-3 text-sm font-semibold text-brand-forest">Orders by status</p>
        <div className="flex flex-wrap gap-2">
          {["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"].map((st) => (
            <button key={st} onClick={() => goOrders(st)} className="flex items-center gap-2 rounded-full border border-brand-brown/15 px-3 py-1.5 text-sm hover:border-brand-forest">
              <Badge value={st} />
              <b>{s.ordersByStatus[st] ?? 0}</b>
            </button>
          ))}
        </div>
        {(s.pendingReviewCount > 0 || s.newMessageCount > 0) && (
          <p className="mt-3 text-sm text-brand-charcoal/70">
            {s.pendingReviewCount > 0 && <>⭐ {s.pendingReviewCount} review(s) waiting for approval. </>}
            {s.newMessageCount > 0 && <>✉️ {s.newMessageCount} new contact message(s).</>}
          </p>
        )}
      </Card>

      <Card>
        <p className="mb-3 text-sm font-semibold text-brand-forest">Revenue — last 30 days</p>
        <div className="flex h-28 items-end gap-[3px]">
          {s.daily.map((d) => (
            <div key={d.key} title={`${dayLabel(d.key)}: ${inr(d.revenue)} · ${d.orders} orders`} className="flex-1 rounded-t bg-brand-leaf/80" style={{ height: `${Math.max(3, (d.revenue / max) * 100)}%` }} />
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-brand-forest">{view === "daily" ? "Daily orders (last 30 days)" : "Monthly orders (last 12 months)"}</p>
          <div className="flex rounded-full bg-brand-cream p-0.5 text-xs font-semibold">
            {(["daily", "monthly"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`rounded-full px-3 py-1 capitalize ${view === v ? "bg-brand-forest text-brand-ivory" : "text-brand-charcoal/70"}`}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="text-xs uppercase text-brand-charcoal/50">
              <tr><th className="py-1">{view === "daily" ? "Date" : "Month"}</th><th>Orders</th><th>Pending</th><th>Delivered</th><th>Cancelled</th><th className="text-right">Revenue</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-brand-brown/10">
                  <td className="py-1.5">{view === "daily" ? dayLabel(r.key) : monthLabel(r.key)}</td>
                  <td>{r.orders}</td><td>{r.pending}</td><td>{r.delivered}</td><td>{r.cancelled}</td>
                  <td className="text-right font-medium">{inr(r.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-brand-charcoal/50">Revenue excludes cancelled orders. Dates are in Indian time.</p>
      </Card>

      <Card>
        <p className="mb-3 text-sm font-semibold text-brand-forest">Low / out of stock</p>
        {s.lowStock.length === 0 ? (
          <p className="text-sm text-brand-charcoal/60">All pack sizes are well stocked.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {s.lowStock.map((l, i) => (
              <li key={i} className="flex justify-between">
                <span>{l.productName} · {l.variantLabel}</span>
                <b className={l.stock === 0 ? "text-red-600" : "text-amber-700"}>{l.stock === 0 ? "Out of stock" : `${l.stock} left`}</b>
              </li>
            ))}
          </ul>
        )}
        <button onClick={goProducts} className="mt-3 text-sm font-semibold text-brand-forest underline">Manage stock</button>
      </Card>
    </div>
  );
}
