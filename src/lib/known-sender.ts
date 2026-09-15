/**
 * Is this sender someone we already know?
 *
 * Known = an Uplink customer account (canonical uplink_customer) OR an active
 * admin/staff login on any ShopKit store. Store logins live in each store's own
 * database, which the desk cannot read, so scripts/sync-store-logins.sh copies
 * their emails into known_store_login every 15 minutes.
 *
 * Unknown senders still get a ticket and staff are still alerted, but they are
 * NOT sent the automatic "we got your request" reply (Paul, 2026-09-15). In the
 * 60 days before this, every unknown-sender ticket was spam or phishing, and the
 * auto-reply meant we were emailing phishing senders.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { known_store_login } from "@/db/schema";
import { resolveCustomerByEmail } from "@/lib/identity";

export async function isStoreLogin(email: string): Promise<boolean> {
	const e = email.trim().toLowerCase();
	if (!e.includes("@")) return false;
	try {
		const [row] = await db
			.select({ email: known_store_login.email })
			.from(known_store_login)
			.where(eq(known_store_login.email, e))
			.limit(1);
		return Boolean(row);
	} catch (err) {
		console.error("[known-sender] store login lookup failed:", err instanceof Error ? err.message : err);
		return false;
	}
}

export async function isKnownSender(email: string): Promise<boolean> {
	if (await resolveCustomerByEmail(email)) return true;
	return isStoreLogin(email);
}
