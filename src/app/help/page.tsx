import { and, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { support_article } from "@/db/schema";
import { SiteFooter, SiteHeader } from "@/lib/brand";
import { PRODUCT_LABELS, PRODUCT_ORDER } from "@/lib/products";

export const dynamic = "force-dynamic";
export const metadata = {
	title: "Help centre",
	description: "Guides and answers for every Uplink Web Services product.",
};

export default async function HelpIndexPage() {
	const rows = await db
		.select({ product_kind: support_article.product_kind })
		.from(support_article)
		.where(and(eq(support_article.status, "published"), isNull(support_article.deleted_at)));
	const counts = new Map<string, number>();
	for (const r of rows) counts.set(r.product_kind, (counts.get(r.product_kind) ?? 0) + 1);

	return (
		<div className="flex min-h-screen flex-col">
			<SiteHeader />
			<main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12">
				<h1 className="text-3xl font-bold tracking-tight">Help centre</h1>
				<p className="mt-2 mb-8 text-black/70 dark:text-white/70">
					Choose a product to browse guides, or{" "}
					<Link href="/new" className="font-medium text-uplink-red-800 underline dark:text-uplink-red-400">
						contact support
					</Link>
					.
				</p>
				<div className="grid gap-4 sm:grid-cols-2">
					{PRODUCT_ORDER.map((p) => (
						<Link
							key={p}
							href={`/help/${p}`}
							className="rounded-xl border border-black/10 bg-white/60 p-5 transition-colors hover:border-uplink-red-800 dark:border-white/10 dark:bg-white/5"
						>
							<h2 className="text-base font-semibold">{PRODUCT_LABELS[p]}</h2>
							<p className="mt-1 text-sm text-black/55 dark:text-white/55">
								{counts.get(p) ?? 0} article{(counts.get(p) ?? 0) === 1 ? "" : "s"}
							</p>
						</Link>
					))}
				</div>
			</main>
			<SiteFooter />
		</div>
	);
}
