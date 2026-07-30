// app/sitemap.ts for /opt/uplink-support — the help articles are the
// "how do I X in Shopkit" ranking surface and previously had no sitemap at all
// (and no robots.txt), so discovery was internal-link-only.
// Adjust the db import to match the app's own db module before building.
import type { MetadataRoute } from "next";
import { db } from "@/db"; // ← verify this path against the app's structure
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const BASE = "https://support.uplink.net.au";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const rows = (await db.execute(
		sql`SELECT product_kind, slug, updated_at FROM support_article WHERE status = 'published' ORDER BY product_kind, slug`,
	)) as unknown as { rows: { product_kind: string; slug: string; updated_at: Date }[] };
	const articles = (Array.isArray(rows) ? rows : (rows.rows ?? [])).map((r) => ({
		url: `${BASE}/help/${r.product_kind}/${r.slug}`,
		lastModified: new Date(r.updated_at),
		changeFrequency: "monthly" as const,
		priority: 0.7,
	}));
	return [
		{ url: `${BASE}/`, changeFrequency: "weekly", priority: 0.8 },
		{ url: `${BASE}/help`, changeFrequency: "weekly", priority: 0.9 },
		...articles,
	];
}
