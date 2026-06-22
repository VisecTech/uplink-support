/**
 * Seed a starter set of KB articles (upsert on product_kind+slug). Re-runnable.
 *   npx dotenv -e .env.local -- npx tsx scripts/seed-kb.ts
 * Content is intentionally procedural (avoids volatile prices/IPs) so it ages well.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { support_article } from "../src/db/schema";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }
const sql = postgres(url, { max: 1 });
const db = drizzle(sql);

type A = { product_kind: string; slug: string; title: string; summary: string; body_md: string; sort_order: number };

const ARTICLES: A[] = [
	// ── General ───────────────────────────────────────────────────────────────
	{
		product_kind: "general", slug: "how-support-works", sort_order: 0,
		title: "How to get help & how support works",
		summary: "The ways to reach us, what a ticket reference is, and how to add to an existing request.",
		body_md: `There are a few ways to get help from Uplink Web Services:

- **Search this help centre** — many questions are answered in the guides here.
- **Chat** — use the support bubble (bottom-right) for quick, AI-assisted answers, or to open a ticket.
- **Contact form** — [support.uplink.net.au/new](https://support.uplink.net.au/new).
- **Email** — write to **support@uplink.net.au**.

## Your ticket reference
Every request gets a reference like **UWS-AB12CD**. We'll email you a confirmation with it. To add more
detail to an existing ticket, just **reply to that email** and keep the \`[UWS-…]\` tag in the subject —
your reply lands on the same ticket.

## What to expect
We'll get back to you as soon as we can. Including the relevant details up front — the affected website
or domain, any error message, and the steps that led to it — helps us resolve things faster.`,
	},
	{
		product_kind: "general", slug: "manage-account-billing", sort_order: 1,
		title: "Managing your account, subscriptions & invoices",
		summary: "Where to log in, view your products, update payment details and download invoices.",
		body_md: `Your Uplink account lives at **[accounts.uplink.net.au](https://accounts.uplink.net.au)**.

Once you're signed in you can:

- See all your **products and subscriptions** in one place (hosting, Shopkit, WPresskit, domains).
- View and download **invoices**.
- **Update your payment method** through the secure billing portal.
- Manage your **domains**.

If you've forgotten your password, use the "forgot password" link on the sign-in page. If you're not
sure which email your account uses, [open a ticket](https://support.uplink.net.au/new) and we'll help.`,
	},
	// ── Hosting ─────────────────────────────────────────────────────────────────
	{
		product_kind: "hosting", slug: "ssl-certificate-pending", sort_order: 0,
		title: "Why is my SSL certificate still pending?",
		summary: "A new SSL certificate is issued automatically once your domain points to our servers; it can take up to an hour after DNS propagates.",
		body_md: `When your hosting is provisioned, we automatically request a free SSL certificate for your domain.

## Why it can show "pending"
- **DNS hasn't propagated yet** — the certificate authority has to see your domain pointing to our
  servers. This can take from a few minutes up to a couple of hours after you update your nameservers.
- **The domain was only just connected** — issuance runs on a short cycle and retries automatically.

## What to do
1. Confirm your domain's nameservers point to Uplink (see "Pointing your domain to your hosting").
2. Wait up to an hour, then reload your site over **https://**.
3. If it's still not secure after a few hours, [open a ticket](https://support.uplink.net.au/new) and
   we'll check the issuance log.`,
	},
	{
		product_kind: "hosting", slug: "point-your-domain", sort_order: 1,
		title: "Pointing your domain to your hosting",
		summary: "Set your domain's nameservers to Uplink so your site and email resolve to your hosting.",
		body_md: `How you connect a domain depends on where it's registered.

## Registered with Uplink
Nothing to do — domains you registered through us are already on our nameservers and point to your
hosting automatically.

## Registered elsewhere (bring your own)
At your current registrar, set the domain's **nameservers** to:

- \`ns1.uplink-dns.net\`
- \`ns2.uplink-dns.net\`

Save the change, then allow time for it to take effect — usually a few hours, occasionally up to 24–48
hours. Once it propagates, your site loads and your SSL certificate is issued automatically.

Prefer to keep DNS at your current provider instead? [Open a ticket](https://support.uplink.net.au/new)
and we'll send the exact records to add.`,
	},
	{
		product_kind: "hosting", slug: "email-setup", sort_order: 2,
		title: "Setting up your hosting email",
		summary: "Webmail access and the IMAP/SMTP settings for your mail app or phone.",
		body_md: `Your hosting includes mailboxes for your domain.

## Webmail
You can read and send mail in the browser via webmail — ask us for your webmail link if you're unsure.

## Mail app / phone settings
Use these to add your mailbox to Outlook, Apple Mail, your phone, etc.

**Incoming (IMAP)**
- Server: \`mail.uplink-dns.net\`
- Port: **993**, security **SSL/TLS**

**Outgoing (SMTP)**
- Server: \`mail.uplink-dns.net\`
- Port: **465**, security **SSL/TLS**

**Username:** your full email address · **Password:** your mailbox password.

If mail won't connect, double-check the username is the *full* address and that SSL/TLS is on. Still
stuck? [Open a ticket](https://support.uplink.net.au/new).`,
	},
	// ── Shopkit ─────────────────────────────────────────────────────────────────
	{
		product_kind: "shopkit", slug: "connect-stripe", sort_order: 0,
		title: "Taking payments: connect your Stripe account",
		summary: "Shopkit takes card payments through Stripe — connect (or create) your own Stripe account from your store admin.",
		body_md: `Shopkit processes card payments through **Stripe**, paid out directly to your own bank account.

## Connect Stripe
1. In your store admin, go to **Settings → Payments**.
2. Click **Connect Stripe** and follow the prompts.
3. Don't have a Stripe account yet? You can create one during this step.

Once connected, your store can accept cards at checkout and payouts go straight to you. Your Stripe
account stays entirely yours.

Having trouble connecting? [Open a ticket](https://support.uplink.net.au/new).`,
	},
	{
		product_kind: "shopkit", slug: "shipping-setup", sort_order: 1,
		title: "Setting up shipping",
		summary: "Quote live Australia Post rates at checkout, with a flat-rate fallback.",
		body_md: `Shopkit can calculate shipping for you at checkout.

- **Live Australia Post rates** — show real Parcel Post and Express prices based on the customer's
  address and the order, using your own AusPost account details.
- **Flat-rate fallback** — set a simple flat rate (and optional free-shipping threshold) as a backup or
  if you'd rather keep it simple.

Configure this in your store admin under **Shipping**. You can also mark individual products as
free-shipping.

Want a hand getting your AusPost details in? [Open a ticket](https://support.uplink.net.au/new).`,
	},
	{
		product_kind: "shopkit", slug: "custom-domain", sort_order: 2,
		title: "Using your own domain with your store",
		summary: "Connect a custom domain so your store runs on your own web address.",
		body_md: `You can run your Shopkit store on your own domain (e.g. \`yourshop.com.au\`) instead of the default
address.

Because connecting a store domain involves DNS and an SSL certificate, we set this up for you to make
sure it's seamless and stays secure.

To get started, [open a ticket](https://support.uplink.net.au/new) with the domain you'd like to use and
let us know where it's currently registered. We'll handle the rest and confirm once it's live.`,
	},
	{
		product_kind: "shopkit", slug: "your-data-is-yours", sort_order: 3,
		title: "Your data is yours — export & no lock-in",
		summary: "Export your store data any time. Shopkit is built on open-source foundations with no lock-in.",
		body_md: `We don't believe in holding your business hostage.

- **Export any time** — you can take a full export of your store data (products, orders, customers).
- **No lock-in** — Shopkit is built on an open-source core (AGPL-licensed), so you're never trapped.

If you ever need a complete export or are planning a move, [open a ticket](https://support.uplink.net.au/new)
and we'll make sure you leave with everything.`,
	},
	// ── WPresskit (sites) ────────────────────────────────────────────────────────
	{
		product_kind: "sites", slug: "logging-in", sort_order: 0,
		title: "Logging into your WordPress site",
		summary: "Use a secure magic link — no password to remember.",
		body_md: `Your WPresskit site uses **magic-link login** — there's no password to remember.

1. Go to your site's admin login.
2. Enter your email and request a login link.
3. Check your inbox and click the link — you're in.

Your site lives at your WPresskit address (e.g. \`yourname.wpresskit.net.au\`), or your own domain if
you've connected one.

Not receiving the link? Check your spam folder first, then
[open a ticket](https://support.uplink.net.au/new).`,
	},
	{
		product_kind: "sites", slug: "editing-with-kadence", sort_order: 1,
		title: "Editing your site with Kadence",
		summary: "Your site is built on the Kadence theme and blocks — edit pages in the WordPress editor.",
		body_md: `Your WPresskit site is built on **WordPress** with the **Kadence** theme and blocks (Kadence Pro is
included), so it's fast and easy to edit.

- Edit a page: open it in the **WordPress block editor** and change text, images and layout directly.
- Use **Kadence blocks** for richer sections (rows, buttons, galleries, forms).
- Changes are live as soon as you publish.

New to the editor? [Open a ticket](https://support.uplink.net.au/new) and we'll point you to the right
starting place for your site.`,
	},
	{
		product_kind: "sites", slug: "backups-updates-security", sort_order: 2,
		title: "Backups, updates & security",
		summary: "Your WPresskit site is managed — daily backups, updates and AU hosting are handled for you.",
		body_md: `WPresskit is **managed** WordPress, so the maintenance is on us:

- **Daily backups** — your site is backed up automatically.
- **Managed updates** — core, theme and plugin updates are handled so your site stays secure.
- **Australian hosting & support** — your site is hosted and supported locally.

If you'd like a site restored to an earlier point, or you're worried about something security-related,
[open a ticket](https://support.uplink.net.au/new) and we'll jump on it.`,
	},
];

async function main() {
	let created = 0, updated = 0;
	for (const a of ARTICLES) {
		const res = await db
			.insert(support_article)
			.values({ ...a, status: "published" })
			.onConflictDoUpdate({
				target: [support_article.product_kind, support_article.slug],
				set: { title: a.title, summary: a.summary, body_md: a.body_md, sort_order: a.sort_order, status: "published", updated_at: new Date() },
			})
			.returning({ id: support_article.id, created: support_article.created_at, updated: support_article.updated_at });
		// crude created-vs-updated: equal timestamps ⇒ just created
		const r = res[0];
		if (r && Math.abs(new Date(r.created).getTime() - new Date(r.updated).getTime()) < 1000) created++;
		else updated++;
	}
	console.log(`[seed-kb] ${ARTICLES.length} articles upserted (~${created} new / ~${updated} updated)`);
	await sql.end({ timeout: 5 });
	process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
