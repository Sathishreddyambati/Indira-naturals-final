# Indira Naturals — Next.js + Firebase (Firestore + Authentication) + WhatsApp COD ordering

Frontend design is unchanged. Backend = Firebase Firestore (data) + Firebase Authentication (admin login),
deployed on Vercel. Orders are Cash on Delivery and are sent to the shop on WhatsApp.

## 1. One-time Firebase setup (project `secondbrain-87cd7`)
1. **Authentication → Sign-in method → Email/Password → Enable.** Your admin user `bonthadileep1234@gmail.com`
   already exists. If you forgot the password use *Forgot password?* on the admin login screen.
2. **Authentication → Settings → Authorized domains → Add** your Vercel domain (e.g. `indira-naturals.vercel.app`) and your custom domain.
3. **Project settings → Service accounts → Generate new private key.** Open the downloaded JSON file and copy **all** of it.
4. **Firestore → Rules:** add the block from `docs/FIRESTORE_RULES.txt` (keeps the browser away from shop data).

## 2. Vercel environment variables
| Name | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | the whole JSON from step 3 |
| `ADMIN_EMAILS` | `bonthadileep1234@gmail.com` (add more, comma separated) |
| `NEXT_PUBLIC_SITE_URL` | your live URL, e.g. `https://indira-naturals.vercel.app` |

Push to GitHub → import in Vercel → add the variables → Deploy.

## 3. First run
1. Open `https://your-site/admin` and sign in with Firebase email + password.
2. **Products & Stock → Load starter products** (adds the 5 powders with every pack size/price, settings and coupon `WELCOME10`). Only works when there are no products yet.
3. **Settings →** check the WhatsApp number (default `919177166077`), phone, email, delivery charge, free-delivery limit.
4. Place a test order on the site, then delete it from the order screen.

## 4. How ordering works
1. Customer checks out (COD). Order is saved in Firestore as **pending** and stock is reduced immediately.
2. Success page opens WhatsApp with a ready message to the shop: **Order ID, products, quantities, amounts, delivery charge, total COD amount, address, tracking number line and a private tracking link.**
3. In **Admin → Orders** you confirm, pack, add the **tracking number** (+ courier / courier link) and mark shipped, delivered or cancelled. Cancelling returns stock.
4. Every order screen has **Message customer** — opens WhatsApp to the customer with a message matching the current status (including tracking number + link). Delivered COD orders are automatically marked cash-received.
5. The customer's tracking link (`/track/<order>?k=…`) needs no login; `/track-order` (order number + email) still works.

This uses WhatsApp click-to-chat (free, no approval). Fully automatic messages without a tap would need the paid WhatsApp Business Cloud API — it can be added later.

## 5. Admin dashboard (`/admin`)
Overview (today / pending / month / delivered / COD to collect, 30-day chart, daily + monthly tables, low stock) ·
Orders (filters: today, pending, confirmed, processing, shipped, delivered, cancelled, month, exact date, search, CSV export) ·
Products & Stock (edit quantity per pack size, mark out of stock, add / edit / delete products) · Customers · Coupons · Reviews, contact messages & newsletter subscribers · Settings.

## Firestore collections used
`indira_products` (variants stored inside each product) · `indira_orders` · `indira_customers` · `indira_coupons` · `indira_settings` (doc `store`) · `indira_admins` (optional extra admin emails as document IDs) · `indira_reviews` · `indira_messages` · `indira_newsletter` · `indira_counters`.
Placeholder documents called `setup` are ignored.

## Product images
Put image files in `public/images/products/` and enter the path (e.g. `/images/products/ginger-pouch-front.jpg`) in the product form.
