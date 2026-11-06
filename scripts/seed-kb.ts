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
		summary: "ShopKit takes card payments through your own Stripe account. How to connect it, what \"connected\" looks like, disconnecting, and fixing common errors.",
		body_md: `ShopKit takes card payments through **Stripe**. You connect your own Stripe account, customers pay on Stripe's secure checkout, and the money settles to your Stripe balance, then pays out to your bank on your Stripe payout schedule. Your Stripe account stays entirely yours.

## Before you start

- Sign in to your store admin. You'll be sent to Stripe and brought back, so use the same browser throughout.
- Have your Stripe login ready. No account yet? You can create one along the way. Stripe will ask for your business and bank details before it pays anything out.

## Connect Stripe

1. In your store admin, go to **Settings → Checkout & payments**.
2. In the **Stripe payments** panel, press **Connect Stripe**. The button changes to "Redirecting…" and takes you to Stripe.
3. On Stripe, sign in (or create an account), choose the account you want to use, and approve the connection to your store.
4. Stripe sends you back to **Checkout & payments**, where you'll see **Stripe connected.**

Finish these steps within about 10 minutes of pressing **Connect Stripe**. If you take longer, just start again.

## What "connected" looks like

The **Stripe payments** panel shows a green **CONNECTED** badge, and underneath it:

- **Account** — your Stripe account ID (starts with \`acct_\`)
- **Email** — the email on your Stripe account
- **Connected** — when you connected

There are two buttons: **Open Stripe Dashboard** and **Disconnect**.

With **Card payment** ticked under **Retail payment options**, card now appears at your checkout. If the page still shows the amber warning "Card payment is switched on, but Stripe isn't connected", contact support.

## Apple Pay, Google Pay and Afterpay

These are switched on in **your** Stripe account, not in ShopKit. Press **Manage in Stripe →** under **Wallets & buy-now-pay-later**, turn on the ones you want, and they appear at your checkout automatically. Availability depends on your Stripe account.

## If your panel says DIRECT

A blue **DIRECT** badge with "Payments active — this store charges through its own Stripe account" means our team set your store up on its own Stripe account. There's nothing to connect, and the **LIVE** or **TEST** tag shows which mode it's in. Use **Open Stripe Dashboard** to see your payments.

## Disconnecting

1. Press **Disconnect** in the **Stripe payments** panel.
2. Confirm the prompt: "Disconnect Stripe? Your storefront will stop accepting payments until you reconnect."

ShopKit removes its access to your Stripe account. Card payments stop until you connect again. Bank transfer and pay on collection keep working if you've switched them on. If they aren't on, your customers have no way to pay, so switch one on or reconnect straight away. Your Stripe account, its balance and past payments aren't affected.

ShopKit sends card refunds through your connected Stripe account, so finish any refunds before you disconnect.

## Common problems

| What you see | What to do |
|---|---|
| **Connect Stripe** is greyed out, with "Stripe Connect isn't switched on for your store yet" | Card payments haven't been set up for your store yet. Contact ShopKit support. |
| "Stripe Connect is not switched on for your store — contact ShopKit support." | Same as above. Contact support. |
| \`state_mismatch\` | The connection took more than about 10 minutes, finished in a different browser from the one you started in, or **Connect Stripe** was pressed again partway through. Press **Connect Stripe** once more and finish in the same browser. |
| \`platform_not_configured\` | A setup problem on our side. Contact support. |
| Another message from Stripe (for example, that access was denied) | The connection was cancelled on Stripe's page. Press **Connect Stripe** again and approve it. |
| You were sent to the admin login page | Your admin session ended while you were on Stripe. Sign in, go back to **Settings → Checkout & payments** and press **Connect Stripe** again. |

Still stuck? Email support@uplink.net.au or [open a ticket](https://support.uplink.net.au/new).

Card isn't the only option — see [Payment options at checkout](/help/shopkit/payment-options) for bank transfer and pay on collection.`,
	},
	{
		product_kind: "shopkit", slug: "shipping-setup", sort_order: 1,
		title: "Setting up shipping",
		summary: "Charge a flat rate or quote live Australia Post prices at checkout, offer free shipping, and set parcel sizes so quotes are right.",
		body_md: `Everything about postage lives in your store admin under **Settings → Shipping**. Make your changes, then click **Save shipping settings** at the bottom.

You have two ways to charge for shipping: one **flat rate** for every order, or **live Australia Post rates** worked out for each cart. On top of either, you can offer **free shipping**.

## Option 1: a flat rate

Enter your price in **Flat shipping rate ($)** — for example \`9.95\` — and save. Every shipped order pays that amount.

This is the simplest setup, and it's what your shop uses until you connect Australia Post.

## Option 2: live Australia Post rates

Charge what the parcel actually costs to send. Shoppers enter their postcode at checkout and choose between **Parcel Post** and **Express Post**.

1. Get a ShippingAPI key for your MyPost Business account at [developers.auspost.com.au](https://developers.auspost.com.au).
2. Paste it into **AusPost ShippingAPI key** and click **Test connection**. You should see *Connection OK*.
3. Enter the postcode you send from in **Origin postcode (4 digits)**.
4. Check your **Default parcel dimensions** (see below) and save.

You need both the key and the origin postcode. If either is missing, checkout charges your flat rate instead.

If Australia Post can't be reached when a shopper checks out, they're charged your flat rate instead, so a sale is never blocked.

## Switching back to the flat rate, key and all

Already connected Australia Post but want one simple price? Tick **Always use my flat rate**. Checkout then charges your flat rate on every shipped order and skips Australia Post completely. Untick it to go back to live rates. Your saved key stays in place either way.

## Getting the parcel size right

Live rates depend on how big and heavy the parcel is, so this is worth five minutes.

**Default parcel dimensions** — **Length**, **Width** and **Height** in cm, plus **Weight** in grams. Out of the box it's 30 × 22 × 14 cm and 500 g.

**Per product** — on a product's **Variants** tab, each variant has its own **Weight (g)** and **Length**, **Width** and **Height (cm)**. Fill these in for anything that won't fit your default box.

Here's how ShopKit works out the parcel for a cart:

- **Everything goes in one parcel.**
- **Size:** for each side (length, width, height), ShopKit uses whichever is bigger: your default or the largest item in the cart. Your default is the smallest box a cart can be quoted in, so set it to the box you usually use.
- **Weight:** each item's weight times its quantity, all added up. An item with no weight of its own counts as your default parcel weight.

When the shopper pays, ShopKit checks the rate with Australia Post again using this same parcel, so the price they're charged is worked out the same way as the price they were shown.

## Free shipping

- **Spend threshold** — enter an amount in **Free shipping over ($)**. Once the cart reaches it (after any discount code), shipping is free. Your shop shows a *Free shipping on all orders over $X* bar, and the cart shows how far the shopper has to go (*You're $12.50 away from free shipping*). Leave it blank to turn it off.
- **Free-shipping products** — tick **Free shipping** on a product. Its card shows a *Free shipping* badge. An order ships free only when **every** item in it is marked this way.

## Which price wins

ShopKit checks these in order and uses the first that applies:

1. **Pickup** orders are always free.
2. Every item is a **free-shipping product**: free.
3. The cart has reached your **free-shipping threshold**: free.
4. No Australia Post key or origin postcode: your **flat rate**.
5. **Always use my flat rate** is ticked: your **flat rate**.
6. Otherwise: **live Parcel Post and Express Post** rates.

## What shoppers see before checkout

- A shipping line on each product page (for example *Free shipping on orders over $75*).
- An **Estimate shipping** box on the cart page. The shopper enters a postcode and sees the same prices checkout will offer.

ShopKit works out shipping prices, but it doesn't buy postage labels. You buy labels and send parcels the way you do now.

Want a hand getting your AusPost details in? [Open a ticket](https://support.uplink.net.au/new).`,
	},
	{
		product_kind: "shopkit", slug: "custom-domain", sort_order: 2,
		title: "Using your own domain with your store",
		summary: "Connect a domain you already own from Settings → Domains — the DNS records to add, www, and how long it takes.",
		body_md: `Your store starts on a ShopKit address (like \`yourshop.shopkit.com.au\`). You can run it on a domain you own instead, such as \`yourshop.com.au\`. We issue and renew the SSL certificate for you.

**Before you start**

You'll need to be able to change DNS records for your domain — usually at the registrar where you bought it, or wherever your DNS is hosted.

**Step 1 — add the DNS records**

In your admin, go to **Settings → Domains**. Under **Connect a domain you own**, *Step 1* shows the record to add. At your DNS host:

- Add an **A** record for \`@\` (your bare domain) pointing at the IP address shown on that screen.
- Remove any other **A** or **AAAA** records for \`@\`, such as a parking page — they stop the connection working.
- **Want \`www.yourshop.com.au\` to work too?** Add a \`www\` record as well: a **CNAME** pointing at your domain, or an **A** record to the same IP address. Do this *before* you connect. Visitors who type \`www\` are then sent to your bare domain.
- Leave your **MX** records alone, so your email keeps working.

**Step 2 — connect**

Enter your domain without \`www\` or \`https://\` (e.g. \`yourshop.com.au\`) and choose **Connect**.

**How long it takes**

Your request appears under **Recent domain setups** and moves from **Queued** to **Setting up…** to **Live** — usually within a few minutes. Choose **Refresh** to update it.

If it shows **Needs attention**, your DNS change most likely hasn't reached us yet. DNS can take a little while to spread: wait 10–15 minutes and choose **Connect** again.

**Once it's live**

- Your storefront and your admin both move to the new domain — sign in at \`https://yourshop.com.au/admin\`.
- Your old ShopKit address redirects to the new domain, so links you've already shared keep working.
- Your store may be unavailable for a moment while it switches over.

**Need a hand?**

If you don't see **Domains** under Settings, you added \`www\` after connecting, or you're not sure which records to change, [open a ticket](https://support.uplink.net.au/new?product=shopkit) with your domain name and where it's registered, and we'll sort it out with you.`,
	},
	{
		product_kind: "shopkit", slug: "your-data-is-yours", sort_order: 3,
		title: "Your data is yours — export & no lock-in",
		summary: "Export your store data any time, request a complete copy to run elsewhere, and answer customers who ask what you hold about them.",
		body_md: `We don't believe in holding your business hostage. Everything below is under **Settings → Your data** in your admin.

**Export any time**

Under **Export now**, download instant CSV files of your **Orders**, newsletter **Subscribers** and **Activity log**. Sales, tax (BAS) and inventory reports export from **Reports** — pick a date range first.

**Take everything with you**

Under **Take everything & self-host**, choose **Request a complete export**. Within one business day we'll email you a single archive with your whole database, all your media and a plain-English restore guide. It's standard PostgreSQL and plain files — nothing proprietary, so you're never trapped.

**When a customer asks what you hold about them**

If a customer asks what personal information your store holds about them, or for a copy:

- Search **Orders** for their email address — the **CSV** button then downloads just their orders.
- For everything else, [open a ticket](https://support.uplink.net.au/new?product=shopkit) with their email address. We can report every record your store holds under that address, with CSV copies you can pass on.
- Card payment records sit in your own Stripe account, so check there too.

Planning a move, or need something that isn't covered here? [Open a ticket](https://support.uplink.net.au/new?product=shopkit) and we'll make sure you leave with everything.`,
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
	{
		product_kind: "shopkit", slug: "promotions", sort_order: 0,
		title: "Spend and win promotions, online and at the markets",
		summary: "Run a spend-and-win draw. Online orders enter themselves; at a market you show a code on your phone or hand out tickets you printed the night before.",
		body_md: `Run a "spend $50 and go in the draw" promotion. Online orders enter themselves, and at a market you
hand the customer a code to scan. Find it under **Marketing → Promotions**.

**Write your terms first**

Go to **Pages**, write a page with the rules, and publish it. You cannot open a promotion without one
— the Open entries button stays shut until a published terms page is chosen. That is deliberate: a
promotion needs written rules an entrant could actually have read.

Cover the prize, the spend needed, when entries open and close, how the winner is picked and told,
and who can enter.

**Set the spend and the prize**

The spend threshold is GST inclusive — it is the figure on the customer's receipt — and spending
exactly that much counts. Postage is excluded by default, so a customer far away needs the same goods
as a local one. Nothing is live until you press **Open entries**.

**Online orders enter themselves**

Once an order is paid and reaches the threshold, it is entered automatically. An unpaid order is never
entered, so bank transfers and pay-on-pickup only count once the money has arrived. One entry per
qualifying order, so three orders means three chances.

**At a market, two ways**

Both make exactly the same entry, and you can use both at the same stall on the same day. The only
difference is who is holding the code — your screen, or their hand.

*Market mode* is better when you have a spare moment, because the tap ties the code to the sale in
front of you. After a qualifying sale press **Open Market mode**; it opens in its own tab with a code
ready. The customer scans it, or types the six digits you read out, then fills in their own name and
email. Close the tab and open it again for the next customer. These codes last 30 minutes.

*Printed tickets* are better when there is a queue and no spare hands.

**Printing tickets**

The evening before, open the promotion and find **Print entry codes**. Choose how many, give the run
a name you will recognise later — "Newcastle, Sunday" — and print. You get twelve tickets to a page.
Cut them up and take them with you. At the stall you hand one ticket to each customer who qualifies,
and they scan it whenever they like.

**Print the evening before, not earlier.** A ticket works for 24 hours from the moment you print it,
not from the market. Print on Saturday evening for a Sunday market and you are fine; print on
Thursday for a Sunday market and every ticket is dead before you open. The exact cut-off is shown
before you print and again on every ticket.

There are no six digits on a printed ticket — the square is the only way in, which is what makes a
whole sheet safe to carry. If someone genuinely cannot scan, take their name and email and use **Add
a market entry by hand**.

**A printed ticket is a raffle ticket**

Whoever holds it gets the entry. There is no name on a ticket until somebody scans it, so one that
falls on the ground works for whoever picks it up. Treat a sheet as stock: keep them on you, hand out
one per qualifying sale, and do not leave a pile on the table. Your terms say one entry per
qualifying purchase, and at a market the tickets are the only thing keeping that true.

If a sheet goes missing, find the run under **Runs printed** and press **Void**. Every unscanned
ticket from that sheet stops working immediately. Anyone who already scanned one stays in the draw —
they entered properly. If the printer jams, press **Reprint**: you get the same tickets back, not new
ones, so reprinting can never double what is in circulation.

**Reading the numbers**

Printing 200 tickets does not add 200 entries. A ticket becomes an entry only when somebody scans it
and fills it in, so your entry count will not move until people start scanning.

Opening Market mode also makes a code, so the "never filled in" count includes any you opened and
closed without a customer in front of you. Do not read that number as customers who walked away.

**Closing and drawing**

Press **Close entries** when the promotion ends, then **Draw a winner**. One press picks the winner
and four reserves from the same shuffle and emails the winner straight away; if that email fails the
page says so. If the winner never claims, press **Winner didn't claim** and the first reserve takes
their place — no new random pick happens, which is what lets you say plainly that you did not keep
re-rolling until you liked the name.

Every draw records an entrant record: a long code that fingerprints the exact list of entries the
winner came from, so the result can be checked later.

**Prizes over $10,000**

Enter a prize value over $10,000 and ShopKit warns you, because a prize pool that size generally
needs an authority from NSW Fair Trading lodged before the promotion starts. It is a warning, not a
block — confirm it with NSW Fair Trading yourself before announcing anything that large.

Not sure about something? [Open a ticket](https://support.uplink.net.au/new).`,
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
