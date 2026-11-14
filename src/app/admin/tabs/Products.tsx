"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { ProductDoc } from "@/lib/indira-firestore";
import { api, Badge, Card, Field, Modal, btn, btnDanger, btnGhost, fail, input, inr } from "../ui";

type VariantForm = { id?: number; label: string; weightGrams: number; sku: string; price: number; comparePrice: number | null; stock: number };
type Form = {
  slug: string; name: string; shortDescription: string; description: string; category: string; image: string;
  galleryImages: string; ingredients: string; netWeightLabel: string; usageInstructions: string; storageInstructions: string;
  allergenInfo: string; skuPrefix: string; status: "published" | "draft"; featured: boolean; bestseller: boolean;
  seoTitle: string; seoDescription: string; variants: VariantForm[];
};

const blank: Form = {
  slug: "", name: "", shortDescription: "", description: "", category: "Powders", image: "/images/products/", galleryImages: "",
  ingredients: "", netWeightLabel: "Available in 100 g, 200 g, 500 g & 1 kg zip-lock pouches",
  usageInstructions: "Add a spoon to curries, soups, marinades and sauces.",
  storageInstructions: "Store in a cool, dry place. Keep away from moisture and sunlight. Use a dry spoon. Best before 12 months from manufacture.",
  allergenInfo: "", skuPrefix: "IN-", status: "published", featured: false, bestseller: false, seoTitle: "", seoDescription: "",
  variants: [{ label: "100g", weightGrams: 100, sku: "", price: 0, comparePrice: null, stock: 0 }],
};

const toForm = (p: ProductDoc): Form => ({
  ...p, allergenInfo: p.allergenInfo ?? "", seoTitle: p.seoTitle ?? "", seoDescription: p.seoDescription ?? "",
  galleryImages: p.galleryImages.join("\n"), status: p.status === "draft" ? "draft" : "published",
  variants: p.variants.map((v) => ({ id: v.id, label: v.label, weightGrams: v.weightGrams, sku: v.sku, price: v.price, comparePrice: v.comparePrice, stock: v.stock })),
});

export default function Products() {
  const [products, setProducts] = useState<ProductDoc[] | null>(null);
  const [edit, setEdit] = useState<{ id: number | null; form: Form } | null>(null);

  const load = () => api<ProductDoc[]>("/api/admin/products").then(setProducts).catch(fail);
  useEffect(() => { load(); }, []);

  async function stock(p: ProductDoc, body: { variantId: number; stock: number } | { outOfStock: true }) {
    try { await api(`/api/admin/products/${p.id}/stock`, { method: "PATCH", json: body }); toast.success("Stock updated"); load(); } catch (e) { fail(e); }
  }

  if (!products) return <p className="py-10 text-center text-brand-charcoal/50">Loading products…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-brand-charcoal/60">Change a quantity and tap <b>Save</b>. Quantity 0 = shown as out of stock on the website.</p>
        <button className={btn} onClick={() => setEdit({ id: null, form: blank })}>+ Add product</button>
      </div>

      {products.length === 0 && (
        <Card>
          <p className="mb-3">No products yet. Load your 5 powders (ginger, garlic, ginger garlic, onion, tomato) with all pack sizes and prices:</p>
          <button className={btn} onClick={async () => { try { await api("/api/admin/seed", { method: "POST" }); toast.success("Starter products loaded"); load(); } catch (e) { fail(e); } }}>Load starter products</button>
        </Card>
      )}

      {products.map((p) => (
        <Card key={p.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image} alt="" className="h-14 w-14 rounded-lg bg-brand-cream object-cover" />
              <div>
                <p className="font-semibold text-brand-forest">{p.name}</p>
                <div className="mt-0.5 flex gap-1.5"><Badge value={p.status} /><span className="text-xs text-brand-charcoal/50">{p.category}</span></div>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-1.5">
              <button className={btnGhost} onClick={() => setEdit({ id: p.id, form: toForm(p) })}>Edit</button>
              <button className={btnDanger} onClick={async () => { if (confirm(`Delete ${p.name}?`)) { try { await api(`/api/admin/products/${p.id}`, { method: "DELETE" }); load(); } catch (e) { fail(e); } } }}>Delete</button>
            </div>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[380px] text-sm">
              <tbody>
                {p.variants.map((v) => <VariantRow key={v.id + ":" + v.stock} v={v} onSave={(n) => stock(p, { variantId: v.id, stock: n })} />)}
              </tbody>
            </table>
          </div>
          <button className="mt-2 text-xs font-semibold text-red-600 underline" onClick={() => confirm(`Mark every size of ${p.name} out of stock?`) && stock(p, { outOfStock: true })}>Mark all sizes out of stock</button>
        </Card>
      ))}

      {edit && <ProductForm id={edit.id} initial={edit.form} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}

function VariantRow({ v, onSave }: { v: ProductDoc["variants"][number]; onSave: (n: number) => void }) {
  const [n, setN] = useState(String(v.stock));
  return (
    <tr className="border-t border-brand-brown/10">
      <td className="py-1.5 font-medium">{v.label}</td>
      <td>{inr(v.price)}</td>
      <td className="w-28"><input type="number" min={0} value={n} onChange={(e) => setN(e.target.value)} className={`${input} !py-1`} /></td>
      <td className="text-right">
        <button className={`${btnGhost} !px-3 !py-1`} disabled={n === String(v.stock) || n === ""} onClick={() => onSave(Number(n))}>Save</button>
      </td>
      <td className="pl-2 text-xs">{v.stock === 0 ? <b className="text-red-600">Out</b> : <span className="text-green-700">In stock</span>}</td>
    </tr>
  );
}

function ProductForm({ id, initial, onClose, onSaved }: { id: number | null; initial: Form; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Form>(initial);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const setVariant = (i: number, patch: Partial<VariantForm>) => setF((p) => ({ ...p, variants: p.variants.map((v, n) => (n === i ? { ...v, ...patch } : v)) }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload = {
      ...f,
      galleryImages: f.galleryImages.split("\n").map((s) => s.trim()).filter(Boolean),
      variants: f.variants.map((v, i) => ({ ...v, sku: v.sku || `${f.skuPrefix}-${v.label.replace(/\s+/g, "")}`, comparePrice: v.comparePrice || null, isDefault: i === 0 })),
    };
    try {
      await api(id ? `/api/admin/products/${id}` : "/api/admin/products", { method: id ? "PUT" : "POST", json: payload });
      toast.success("Product saved");
      onSaved();
    } catch (err) { fail(err); } finally { setBusy(false); }
  }

  return (
    <Modal title={id ? "Edit product" : "Add product"} onClose={onClose} wide>
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><input required className={input} value={f.name} onChange={(e) => { set("name", e.target.value); if (!id) set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} /></Field>
        <Field label="URL slug"><input required className={input} value={f.slug} onChange={(e) => set("slug", e.target.value)} /></Field>
        <Field label="Category"><input required className={input} value={f.category} onChange={(e) => set("category", e.target.value)} /></Field>
        <Field label="SKU prefix"><input required className={input} value={f.skuPrefix} onChange={(e) => set("skuPrefix", e.target.value)} /></Field>
        <Field label="Short description" full><input required className={input} value={f.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} /></Field>
        <Field label="Description" full><textarea required rows={3} className={input} value={f.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <Field label="Main image path (file inside /public, e.g. /images/products/ginger-pouch-front.jpg)" full><input required className={input} value={f.image} onChange={(e) => set("image", e.target.value)} /></Field>
        <Field label="Gallery images (one path per line)" full><textarea rows={3} className={input} value={f.galleryImages} onChange={(e) => set("galleryImages", e.target.value)} /></Field>
        <Field label="Ingredients"><input required className={input} value={f.ingredients} onChange={(e) => set("ingredients", e.target.value)} /></Field>
        <Field label="Pack sizes text"><input required className={input} value={f.netWeightLabel} onChange={(e) => set("netWeightLabel", e.target.value)} /></Field>
        <Field label="Usage" full><textarea required rows={2} className={input} value={f.usageInstructions} onChange={(e) => set("usageInstructions", e.target.value)} /></Field>
        <Field label="Storage" full><textarea required rows={2} className={input} value={f.storageInstructions} onChange={(e) => set("storageInstructions", e.target.value)} /></Field>
        <Field label="Status"><select className={input} value={f.status} onChange={(e) => set("status", e.target.value as Form["status"])}><option value="published">Published (visible)</option><option value="draft">Draft (hidden)</option></select></Field>
        <div className="flex items-end gap-4 pb-2 text-sm">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.featured} onChange={(e) => set("featured", e.target.checked)} /> Featured</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.bestseller} onChange={(e) => set("bestseller", e.target.checked)} /> Bestseller</label>
        </div>

        <div className="sm:col-span-2">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-charcoal/60">Pack sizes, prices &amp; stock</p>
          {f.variants.map((v, i) => (
            <div key={i} className="mb-2 grid grid-cols-2 gap-2 rounded-xl border border-brand-brown/15 p-2 sm:grid-cols-6">
              <input placeholder="Label 100g" className={input} value={v.label} onChange={(e) => setVariant(i, { label: e.target.value })} required />
              <input placeholder="Grams" type="number" className={input} value={v.weightGrams || ""} onChange={(e) => setVariant(i, { weightGrams: Number(e.target.value) })} required />
              <input placeholder="Price ₹" type="number" className={input} value={v.price || ""} onChange={(e) => setVariant(i, { price: Number(e.target.value) })} required />
              <input placeholder="MRP ₹ (optional)" type="number" className={input} value={v.comparePrice ?? ""} onChange={(e) => setVariant(i, { comparePrice: e.target.value ? Number(e.target.value) : null })} />
              <input placeholder="Stock" type="number" min={0} className={input} value={v.stock} onChange={(e) => setVariant(i, { stock: Number(e.target.value) })} required />
              <button type="button" className="text-xs text-red-600 underline" disabled={f.variants.length === 1} onClick={() => setF((p) => ({ ...p, variants: p.variants.filter((_, n) => n !== i) }))}>Remove</button>
            </div>
          ))}
          <button type="button" className={btnGhost} onClick={() => setF((p) => ({ ...p, variants: [...p.variants, { label: "", weightGrams: 0, sku: "", price: 0, comparePrice: null, stock: 0 }] }))}>+ Add pack size</button>
        </div>
        <div className="flex gap-2 sm:col-span-2"><button className={btn} disabled={busy}>{busy ? "Saving…" : "Save product"}</button><button type="button" className={btnGhost} onClick={onClose}>Cancel</button></div>
      </form>
    </Modal>
  );
}
