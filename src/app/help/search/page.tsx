import { and, eq, ilike, isNull, or } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { support_article } from "@/db/schema";
import { SiteFooter, SiteHeader } from "@/lib/brand";
import { KbSearch } from "@/components/kb-search";
import { PRODUCT_LABELS } from "@/lib/products";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search", robots: { index: false, follow: true } };

// Escape LIKE wildcards in user input so they're matched literally.
function escapeLike(s: string): string {
	return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export default async function SearchPage({
	searchParams,
}: {
	searchParams: Promise<{ q?: string }>;
}) {
	const { q } = await searchParams;
	const query = (q ?? "").trim().slice(0, 120);

	let results: { product_kind: string; slug: string; title: string; summary: string | null }[] = [];
	if (query.length >= 2) {
		const term = `%${escapeLike(query)}%`;
		results = await db
			.select({
				product_kind: support_article.product_kind,
				slug: support_article.slug,
				title: support_article.title,
				summary: support_article.summary,
			})
			.from(support_article)
			.where(
				and(
					eq(support_article.status, "published"),
					isNull(support_article.deleted_at),
					or(
						ilike(support_article.title, term),
						ilike(support_article.summary, term),
						ilike(support_article.body_md, term),
					),
				),
			)
			.orderBy(support_article.product_kind, support_article.sort_order)
			.limit(30);
	}

	return (
		<div className="flex min-h-screen flex-col">
			<SiteHeader />
			<main className="mx-auto w-full max-w-2xl flex-1 px-5 py-12">
				<h1 className="mb-6 text-2xl font-bold tracking-tight">Search the help centre</h1>
				<KbSearch defaultValue={query} />

				<div className="mt-8">
					{query.length < 2 ? (
						<p className="text-sm text-black/55 dark:text-white/55">Type at least two characters to search.</p>
					) : results.length === 0 ? (
						<div className="text-sm text-black/60 dark:text-white/60">
							<p>
								No articles matched <strong>“{query}”</strong>.
							</p>
							<p className="mt-3">
								Try different words, or{" "}
								<Link href="/new" className="text-uplink-red-800 underline dark:text-uplink-red-400">
									contact support
								</Link>{" "}
								and we&apos;ll help directly.
							</p>
						</div>
					) : (
						<>
							<p className="mb-4 text-xs uppercase tracking-widest text-black/40 dark:text-white/40">
								{results.length} result{results.length === 1 ? "" : "s"} for “{query}”
							</p>
							<ul className="divide-y divide-black/10 overflow-hidden rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/10">
								{results.map((a) => (
									<li key={`${a.product_kind}/${a.slug}`}>
										<Link
											href={`/help/${a.product_kind}/${a.slug}`}
											className="block px-5 py-4 hover:bg-black/5 dark:hover:bg-white/5"
										>
											<div className="flex items-baseline justify-between gap-3">
												<span className="font-medium">{a.title}</span>
												<span className="shrink-0 text-[11px] uppercase tracking-wide text-black/40 dark:text-white/40">
													{PRODUCT_LABELS[a.product_kind] ?? a.product_kind}
												</span>
											</div>
											{a.summary && (
												<div className="mt-0.5 line-clamp-2 text-sm text-black/55 dark:text-white/55">{a.summary}</div>
											)}
										</Link>
									</li>
								))}
							</ul>
						</>
					)}
				</div>
			</main>
			<SiteFooter />
		</div>
	);
}
