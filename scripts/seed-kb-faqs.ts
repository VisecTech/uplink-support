/**
 * Seed consolidated FAQ articles (one per product area). Upsert on product_kind+slug.
 *   npx dotenv -e .env.local -- npx tsx scripts/seed-kb-faqs.ts
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { support_article } from "../src/db/schema";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }
const sql = postgres(url, { max: 1 });
const db = drizzle(sql);

type A = { product_kind: string; slug: string; title: string; summary: string; body_md: string; sort_order: number };

const TICKET = "[open a ticket](https://support.uplink.net.au/new)";

const FAQS: A[] = [
	{
		product_kind: "general", slug: "faqs", sort_order: 5,
		title: "Frequently asked questions",
		summary: "Quick answers about your account, billing, support and which product is which.",
		body_md: `### How do I reset my password?
Use the "forgot password" link on the sign-in page at
[accounts.uplink.net.au](https://accounts.uplink.net.au). If you're not sure which email your account
uses, ${TICKET} and we'll sort it.

### Where do I find my invoices or update my billing?
Sign in to [accounts.uplink.net.au](https://accounts.uplink.net.au) — you can view and download invoices
and update your payment method in the billing area.

### How quickly will you respond?
We reply as soon as we can. Including the key details up front — the affected site or domain, any error
message, and what you were doing — helps us get to a fix faster.

### Can I talk to a real person?
Absolutely. The chat bubble and the AI assistant are there for instant answers, but every request can go
to a human — just use "Talk to a human", the [contact form](https://support.uplink.net.au/new), or email
**support@uplink.net.au**. If you'd prefer a call, let us know and we'll arrange one.

### What's the difference between Shopkit and WPresskit?
**Shopkit** is a dedicated online-store / commerce platform (products, cart, checkout, shipping).
**WPresskit** is a managed WordPress website (pages, blog, brochure-style sites). If you mainly need to
*sell*, that's Shopkit; if you mainly need a *website*, that's WPresskit. Not sure? ${TICKET} and we'll
recommend the right fit.

### How do I cancel a service?
You can manage your subscriptions from [accounts.uplink.net.au](https://accounts.uplink.net.au), or
${TICKET} and we'll take care of it. Either way, your data stays yours — we'll help you export it.`,
	},
	{
		product_kind: "hosting", slug: "faqs", sort_order: 5,
		title: "Hosting FAQs",
		summary: "Common hosting questions — SSL, nameservers, uploading files, migrations and downtime.",
		body_md: `### Do I get a free SSL certificate?
Yes. We issue and renew a free SSL certificate for your domain automatically once it points to our
servers — there's nothing to buy or configure.

### What are my nameservers?
For domains you bring from another registrar, point them to \`ns1.uplink-dns.net\` and
\`ns2.uplink-dns.net\`. Domains registered through us are already set up.

### Can I host more than one website?
That depends on your plan. Sign in to [your account](https://accounts.uplink.net.au) to see your plan's
limits, or ${TICKET} and we'll let you know your options.

### How do I upload my website files?
You can use the control panel's file manager, or connect over SFTP with the credentials for your hosting.
If you need those details, ${TICKET}.

### Can you migrate my existing site from another host?
Yes — we're happy to help move a site across. ${TICKET} with your current host and domain and we'll guide
you through (or do the heavy lifting for you).

### My website is down — what should I do?
First, check whether it's just your connection (try loading it on mobile data). Confirm your domain hasn't
expired and its nameservers still point to us. If it's still down, ${TICKET} and flag it as urgent —
include the exact error you see.`,
	},
	{
		product_kind: "shopkit", slug: "faqs", sort_order: 5,
		title: "Shopkit FAQs",
		summary: "Selling on Shopkit — payments, fees, payouts, pickup, domains and products.",
		body_md: `### What payment methods can my customers use?
Card payments, processed securely through **Stripe** (which you connect from your store admin).

### Does Uplink take a commission on my sales?
No — Shopkit is a flat monthly subscription, and we don't take a cut of your sales. You pay Stripe's
standard card-processing fees, and your Stripe account is entirely your own.

### When do I get paid?
Payouts go directly from **Stripe** to your bank account on your Stripe payout schedule — the money is
yours, paid out to you, not held by us.

### Can I offer local pickup as well as delivery?
Yes — you can offer local pickup alongside shipping, so nearby customers can collect their order.

### Can I use my own domain?
Yes. We connect your domain (and its SSL) for you so it's seamless — see "Using your own domain with your
store", or ${TICKET} with the domain you'd like to use.

### How do I add or edit products?
Manage your catalogue in your store admin under **Products** — add items, photos, prices and stock. Want
a hand getting your range in? ${TICKET}.`,
	},
	{
		product_kind: "sites", slug: "faqs", sort_order: 5,
		title: "WPresskit FAQs",
		summary: "Managed WordPress questions — editing, updates, backups, domains, stores and mobile.",
		body_md: `### Can I edit the site myself?
Yes. Your site uses the **Kadence** block editor in WordPress, so you can change text, images and layout
yourself — see "Editing your site with Kadence".

### Do you handle updates and backups?
Yes — WPresskit is fully managed. We run **daily backups** and keep WordPress, the theme and plugins
updated for you.

### Can I use my own domain?
Yes. Your site comes with a WPresskit address, and we can connect your own domain (with SSL) on request —
just ${TICKET}.

### How do I log in?
With a secure **magic link** — request a login link by email and click it; there's no password to
remember. See "Logging into your WordPress site".

### Can I add an online store to my site?
WordPress supports online stores (for example with WooCommerce). If you'd like to sell from your site,
${TICKET} and we'll talk through the best option for you.

### Will my site work on mobile?
Yes — sites are built to be responsive, so they adapt to phones, tablets and desktops automatically.`,
	},
];

async function main() {
	for (const a of FAQS) {
		await db
			.insert(support_article)
			.values({ ...a, status: "published" })
			.onConflictDoUpdate({
				target: [support_article.product_kind, support_article.slug],
				set: { title: a.title, summary: a.summary, body_md: a.body_md, sort_order: a.sort_order, status: "published", updated_at: new Date() },
			});
	}
	console.log(`[seed-kb-faqs] ${FAQS.length} FAQ articles upserted`);
	await sql.end({ timeout: 5 });
	process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
