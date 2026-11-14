"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { AdminOrder, OrderStatus } from "@/lib/order-types";
import { buildCustomerUpdate, waLink } from "@/lib/whatsapp";
import { api, Badge, Card, Field, Modal, btn, btnDanger, btnGhost, downloadCsv, fail, fmtDate, input, inr, istDay, todayIst } from "../ui";

const FILTERS = ["all", "today", "pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "month"];
const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "confirmed",
  confirmed: "processing",
  processing: "shipped",
  shipped: "delivered",
};

export default function Orders({ initialFilter }: { initialFilter: string }) {
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [filter, setFilter] = useState(FILTERS.includes(initialFilter) ? initialFilter : "all");
  const [month, setMonth] = useState(""); // YYYY-MM
  const [date, setDate] = useState(""); // YYYY-MM-DD
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const load = () => api<AdminOrder[]>("/api/admin/orders").then(setOrders).catch(fail);
  useEffect(() => {
    load();
  }, []);

  const list = useMemo(() => {
    if (!orders) return [];
    const today = todayIst();
    const thisMonth = today.slice(0, 7);
    const needle = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"].includes(filter) && o.status !== filter) return false;
      if (filter === "today" && istDay(o.createdAt) !== today) return false;
      if (filter === "month" && istDay(o.createdAt).slice(0, 7) !== (month || thisMonth)) return false;
      if (month && filter !== "month" && istDay(o.createdAt).slice(0, 7) !== month) return false;
      if (date && istDay(o.createdAt) !== date) return false;
      if (needle && !`${o.orderNumber} ${o.customerName} ${o.phone} ${o.city}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [orders, filter, month, date, q]);

  const live = list.filter((o) => o.status !== "cancelled");
  const selected = orders?.find((o) => o.orderNumber === open) ?? null;

  function replace(o: AdminOrder) {
    setOrders((prev) => prev?.map((x) => (x.orderNumber === o.orderNumber ? o : x)) ?? prev);
  }

  function exportCsv() {
    downloadCsv(`orders-${todayIst()}.csv`, [
      ["Order ID", "Date", "Status", "Payment", "Name", "Phone", "Email", "Address", "City", "State", "PIN", "Products", "Subtotal", "Discount", "Shipping", "Total", "Tracking", "Courier"],
      ...list.map((o) => [
        o.orderNumber, fmtDate(o.createdAt), o.status, o.paymentStatus, o.customerName, o.phone, o.email,
        `${o.addressLine1} ${o.addressLine2}`.trim(), o.city, o.state, o.pincode,
        o.items.map((i) => `${i.productName} ${i.variantLabel} x${i.quantity}`).join("; "),
        o.subtotal, o.discount, o.shipping, o.total, o.trackingNumber ?? "", o.courierName,
      ]),
    ]);
  }

  if (!orders) return <p className="py-10 text-center text-brand-charcoal/50">Loading orders…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm capitalize ${filter === f ? "bg-brand-forest text-brand-ivory" : "bg-white text-brand-charcoal/70"}`}>
            {f === "today" ? "Today" : f === "month" ? "Monthly" : f}
            {f !== "all" && f !== "today" && f !== "month" && ` (${orders.filter((o) => o.status === f).length})`}
          </button>
        ))}
      </div>

      <Card className="grid gap-3 sm:grid-cols-4">
        <Field label="Search"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order ID, name, phone…" className={input} /></Field>
        <Field label="Month"><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={input} /></Field>
        <Field label="Exact date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} /></Field>
        <div className="flex items-end gap-2">
          <button className={btnGhost} onClick={() => { setQ(""); setMonth(""); setDate(""); setFilter("all"); }}>Clear</button>
          <button className={btnGhost} onClick={exportCsv}>Export CSV</button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Orders", String(list.length)],
          ["Value (not cancelled)", inr(live.reduce((s, o) => s + o.total, 0))],
          ["Delivered value", inr(list.filter((o) => o.status === "delivered").reduce((s, o) => s + o.total, 0))],
          ["COD still to collect", inr(live.filter((o) => o.paymentStatus !== "paid").reduce((s, o) => s + o.total, 0))],
        ].map(([l, v]) => (
          <Card key={l}><p className="text-xs uppercase text-brand-charcoal/50">{l}</p><p className="font-serif text-xl text-brand-forest">{v}</p></Card>
        ))}
      </div>

      {list.length === 0 && <p className="py-10 text-center text-brand-charcoal/50">No orders match these filters.</p>}
      <div className="flex flex-col gap-2.5">
        {list.map((o) => (
          <button key={o.orderNumber} onClick={() => setOpen(o.orderNumber)} className="rounded-2xl border border-brand-brown/10 bg-white p-4 text-left shadow-sm hover:border-brand-forest">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-brand-forest">{o.orderNumber}</p>
                <p className="text-sm">{o.customerName} · {o.phone}</p>
                <p className="text-xs text-brand-charcoal/50">{fmtDate(o.createdAt)} · {o.city}</p>
              </div>
              <div className="text-right">
                <Badge value={o.status} />
                <p className="mt-1 font-serif text-lg">{inr(o.total)}</p>
                <p className="text-[11px] text-brand-charcoal/50">{o.paymentStatus === "paid" ? "Paid" : "COD"}</p>
              </div>
            </div>
            <p className="mt-2 truncate text-xs text-brand-charcoal/60">{o.items.map((i) => `${i.productName} ${i.variantLabel} ×${i.quantity}`).join(" · ")}</p>
          </button>
        ))}
      </div>

      {selected && (
        <OrderDetail
          order={selected}
          onClose={() => setOpen(null)}
          onChange={replace}
          onDeleted={() => { setOpen(null); load(); }}
        />
      )}
    </div>
  );
}

function OrderDetail({ order, onClose, onChange, onDeleted }: { order: AdminOrder; onClose: () => void; onChange: (o: AdminOrder) => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [tracking, setTracking] = useState(order.trackingNumber ?? "");
  const [courier, setCourier] = useState(order.courierName);
  const [courierUrl, setCourierUrl] = useState(order.trackingUrl);
  const [note, setNote] = useState(order.adminNote);

  async function patch(body: Record<string, unknown>, okMsg: string) {
    setBusy(true);
    try {
      const r = await api<{ order: AdminOrder }>(`/api/admin/orders/${encodeURIComponent(order.orderNumber)}`, { method: "PATCH", json: body });
      onChange(r.order);
      toast.success(okMsg);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  const next = NEXT[order.status];
  const message = buildCustomerUpdate(order, order.trackUrl);

  return (
    <Modal title={order.orderNumber} onClose={onClose} wide>
      <div className="flex flex-col gap-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge value={order.status} /><Badge value={order.paymentStatus} />
          <span className="text-xs text-brand-charcoal/50">{fmtDate(order.createdAt)}</span>
        </div>

        <Card>
          <p className="font-semibold">{order.customerName}</p>
          <p>{order.phone} · {order.email}</p>
          <p className="mt-1 text-brand-charcoal/70">{order.addressLine1}{order.addressLine2 ? `, ${order.addressLine2}` : ""}, {order.city}, {order.state} – {order.pincode}</p>
          {order.deliveryInstructions && <p className="mt-1 text-xs italic">Note: {order.deliveryInstructions}</p>}
        </Card>

        <Card>
          {order.items.map((i, n) => (
            <div key={n} className="flex justify-between border-b border-brand-brown/10 py-1.5 last:border-0">
              <span>{i.productName} ({i.variantLabel}) × {i.quantity}</span><b>{inr(i.lineTotal)}</b>
            </div>
          ))}
          <div className="mt-2 flex flex-col gap-0.5 text-right text-brand-charcoal/70">
            <span>Subtotal {inr(order.subtotal)}</span>
            {order.discount > 0 && <span>Discount ({order.couponCode}) −{inr(order.discount)}</span>}
            <span>Delivery {order.shipping === 0 ? "Free" : inr(order.shipping)}</span>
            <b className="font-serif text-lg text-brand-forest">Total {inr(order.total)}</b>
          </div>
        </Card>

        <Card>
          <p className="mb-2 font-semibold text-brand-forest">Status</p>
          {order.status === "cancelled" ? (
            <p className="text-red-600">Cancelled — stock was returned to inventory.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {next && <button className={btn} disabled={busy} onClick={() => patch({ status: next }, `Marked ${next}`)}>Mark {next}</button>}
              <select className={`${input} !w-auto`} value={order.status} disabled={busy} onChange={(e) => patch({ status: e.target.value }, `Marked ${e.target.value}`)}>
                {["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"].map((s) => <option key={s}>{s}</option>)}
              </select>
              {order.paymentStatus !== "paid" && <button className={btnGhost} disabled={busy} onClick={() => patch({ paymentStatus: "paid" }, "Marked paid")}>Mark cash received</button>}
            </div>
          )}
          {order.status !== "cancelled" && (
            <button className={`${btnDanger} mt-2`} disabled={busy} onClick={() => confirm("Cancel this order? Stock will be returned.") && patch({ status: "cancelled" }, "Order cancelled")}>Cancel order</button>
          )}
        </Card>

        <Card>
          <p className="mb-2 font-semibold text-brand-forest">Tracking</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tracking number"><input className={input} value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="e.g. courier AWB number" /></Field>
            <Field label="Courier name"><input className={input} value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="DTDC / India Post…" /></Field>
            <Field label="Courier tracking link (optional)" full><input className={input} value={courierUrl} onChange={(e) => setCourierUrl(e.target.value)} placeholder="https://…" /></Field>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={btnGhost} disabled={busy} onClick={() => patch({ trackingNumber: tracking, courierName: courier, trackingUrl: courierUrl }, "Tracking saved")}>Save tracking</button>
            {order.status !== "shipped" && order.status !== "delivered" && order.status !== "cancelled" && (
              <button className={btn} disabled={busy || !tracking.trim()} onClick={() => patch({ status: "shipped", trackingNumber: tracking, courierName: courier, trackingUrl: courierUrl }, "Marked shipped")}>Save &amp; mark shipped</button>
            )}
          </div>
          <p className="mt-2 break-all text-xs text-brand-charcoal/50">Customer link: {order.trackUrl}</p>
        </Card>

        <Card>
          <p className="mb-2 font-semibold text-brand-forest">WhatsApp</p>
          <p className="mb-2 text-xs text-brand-charcoal/60">Opens WhatsApp with the order ID, products, COD amount, tracking number and tracking link for the current status. Save tracking first.</p>
          <div className="flex flex-wrap gap-2">
            <a className="rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white" href={waLink(order.phone, message)} target="_blank" rel="noreferrer">Message customer</a>
            <a className={btnGhost} href={`tel:+91${order.phone}`}>Call</a>
            <button className={btnGhost} onClick={() => navigator.clipboard.writeText(message).then(() => toast.success("Message copied"))}>Copy message</button>
          </div>
        </Card>

        <Card>
          <Field label="Private note (only you see this)"><textarea rows={2} className={input} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <button className={`${btnGhost} mt-2`} disabled={busy} onClick={() => patch({ adminNote: note }, "Note saved")}>Save note</button>
        </Card>

        <Card>
          <p className="mb-2 font-semibold text-brand-forest">History</p>
          {[...order.statusHistory].reverse().map((h, i) => (
            <p key={i} className="text-xs text-brand-charcoal/70"><Badge value={h.status} /> {fmtDate(h.at)}{h.by ? ` · ${h.by}` : ""}{h.note ? ` — ${h.note}` : ""}</p>
          ))}
        </Card>

        <button
          className="self-start text-xs text-red-600 underline"
          onClick={async () => {
            if (!confirm("Delete this order permanently? (Use this only for test orders.)")) return;
            try { await api(`/api/admin/orders/${encodeURIComponent(order.orderNumber)}`, { method: "DELETE" }); toast.success("Order deleted"); onDeleted(); } catch (e) { fail(e); }
          }}
        >
          Delete order permanently
        </button>
      </div>
    </Modal>
  );
}
