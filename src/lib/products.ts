/**
 * The ONE list of support products. Every product picker, validator and the
 * inbound-email tagger reads this file. (It used to be copied into five files,
 * which is how a product gets added to the form but silently rejected by the
 * action that saves it.)
 */
export const PRODUCT_ORDER: string[] = [
	"general",
	"hosting",
	"shopkit",
	"sites",
	"coursekit",
	"clubkit",
	"webdev_project",
];

/** Short labels — console, KB, staff alerts. */
export const PRODUCT_LABELS: Record<string, string> = {
	general: "General",
	hosting: "Hosting",
	shopkit: "Shopkit",
	sites: "Websites (WPresskit)",
	coursekit: "CourseKit",
	clubkit: "Clubkit",
	webdev_project: "Web projects",
};

/** Labels for the public "open a ticket" product picker. */
export const PRODUCT_FORM_LABELS: Record<string, string> = {
	general: "General enquiry",
	hosting: "Hosting",
	shopkit: "Shopkit store",
	sites: "Website (WPresskit)",
	coursekit: "CourseKit academy",
	clubkit: "Clubkit",
	webdev_project: "Web project",
};

const PRODUCT_SET = new Set(PRODUCT_ORDER);

export function isProductKind(v: unknown): v is string {
	return typeof v === "string" && PRODUCT_SET.has(v);
}

export function productOrGeneral(v: unknown): string {
	return isProductKind(v) ? v : "general";
}

/**
 * Old or product-branded addresses that are FORWARDED into support@uplink.net.au
 * on the Plesk box. A Postfix forward can leave the ORIGINAL address in
 * X-Original-To rather than the plus-address it was forwarded to, so these are
 * recognised directly as well.
 */
const ADDRESS_PRODUCTS: Record<string, string> = {
	"support@shopkit.com.au": "shopkit",
	"support@coursekit.com.au": "coursekit",
	"hello@coursekit.com.au": "coursekit",
};

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

/**
 * Which product did the client point an email at?
 *
 * Clients (and every product's Support link) write to
 * support+<product>@uplink.net.au — plus-addressing, so it lands in the same
 * mailbox (Postfix + Dovecot recipient_delimiter is "+"). Pass the recipient
 * header values most-specific first (X-Original-To, Delivered-To, To, Cc); the
 * first address that names a known product wins. Anything else → "general".
 */
export function productFromRecipients(headerValues: string[]): string {
	for (const value of headerValues) {
		for (const raw of value.match(EMAIL_RE) ?? []) {
			const addr = raw.toLowerCase();
			const plus = /^support\+([a-z_]+)@uplink\.net\.au$/.exec(addr);
			if (plus && isProductKind(plus[1])) return plus[1];
			const mapped = ADDRESS_PRODUCTS[addr];
			if (mapped) return mapped;
		}
	}
	return "general";
}
