"use client";

import { useCallback, useEffect, useState } from "react";
import { sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase";
import { api, btn, input, Field } from "./ui";
import Overview from "./tabs/Overview";
import Orders from "./tabs/Orders";
import Products from "./tabs/Products";
import Customers from "./tabs/Customers";
import Coupons from "./tabs/Coupons";
import Inbox from "./tabs/Inbox";
import SettingsTab from "./tabs/Settings";

export type TabId = "overview" | "orders" | "products" | "customers" | "coupons" | "inbox" | "settings";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "orders", label: "Orders" },
  { id: "products", label: "Products & Stock" },
  { id: "customers", label: "Customers" },
  { id: "coupons", label: "Coupons" },
  { id: "inbox", label: "Reviews & Messages" },
  { id: "settings", label: "Settings" },
];

function Login({ onDone }: { onDone: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const auth = getClientAuth();
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await cred.user.getIdToken();
      const res = await api<{ email: string }>("/api/admin/login", { method: "POST", json: { idToken } });
      await signOut(auth); // the server session cookie is all we need
      onDone(res.email);
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      if (code.startsWith("auth/")) {
        setError(
          code === "auth/too-many-requests"
            ? "Too many attempts. Please wait a few minutes or reset your password."
            : "Wrong email or password.",
        );
      } else {
        setError(err instanceof Error ? err.message : "Login failed");
      }
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!email.trim()) return setError("Enter your email first, then tap “Forgot password”.");
    try {
      await sendPasswordResetEmail(getClientAuth(), email.trim());
      setError("");
      setInfo("Password reset email sent. Check your inbox.");
    } catch {
      setError("Could not send the reset email.");
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-brand-brown/10 bg-white p-7 shadow-card">
        <h1 className="font-serif text-2xl text-brand-forest">Indira Naturals</h1>
        <p className="mb-5 text-sm text-brand-charcoal/60">Admin dashboard sign in</p>
        <div className="flex flex-col gap-4">
          <Field label="Email">
            <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          </Field>
          <Field label="Password">
            <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {info && <p className="text-sm text-green-700">{info}</p>}
          <button className={btn} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          <button type="button" onClick={reset} className="text-xs text-brand-forest underline">Forgot password?</button>
        </div>
      </form>
    </div>
  );
}

export default function AdminApp() {
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<TabId>("overview");
  const [orderFilter, setOrderFilter] = useState("all");

  useEffect(() => {
    api<{ email: string }>("/api/admin/session")
      .then((r) => setEmail(r.email))
      .catch(() => setEmail(null))
      .finally(() => setChecking(false));
    const lost = () => setEmail(null);
    window.addEventListener("admin-auth-lost", lost);
    return () => window.removeEventListener("admin-auth-lost", lost);
  }, []);

  const goOrders = useCallback((filter: string) => {
    setOrderFilter(filter);
    setTab("orders");
  }, []);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setEmail(null);
  }

  if (checking) return <div className="grid min-h-screen place-items-center text-brand-charcoal/50">Loading…</div>;
  if (!email) return <Login onDone={setEmail} />;

  return (
    <div className="mx-auto max-w-6xl px-3 pb-16 sm:px-6">
      <header className="sticky top-0 z-30 -mx-3 border-b border-brand-brown/10 bg-brand-ivory/95 px-3 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-xl text-brand-forest">Indira Naturals · Admin</h1>
            <p className="text-xs text-brand-charcoal/50">{email}</p>
          </div>
          <button onClick={logout} className="rounded-full border border-brand-forest/40 px-4 py-1.5 text-xs font-semibold text-brand-forest">
            Sign out
          </button>
        </div>
        <nav className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => (t.id === "orders" ? goOrders("all") : setTab(t.id))}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium ${
                tab === t.id ? "bg-brand-forest text-brand-ivory" : "bg-white text-brand-charcoal/70 hover:bg-brand-cream"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mt-5">
        {tab === "overview" && <Overview goOrders={goOrders} goProducts={() => setTab("products")} />}
        {tab === "orders" && <Orders key={orderFilter} initialFilter={orderFilter} />}
        {tab === "products" && <Products />}
        {tab === "customers" && <Customers />}
        {tab === "coupons" && <Coupons />}
        {tab === "inbox" && <Inbox />}
        {tab === "settings" && <SettingsTab />}
      </main>
    </div>
  );
}
