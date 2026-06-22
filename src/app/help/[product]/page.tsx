import { and, asc, eq, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/db";
import { support_article } from "@/db/schema";
import { SiteFooter, SiteHeader } from "@/lib/brand";
import { PRODUCT_LABELS } from "@/lib/products";

export const dynamic = "force-dynamic";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ product: string }>;
}): Promise<Metadata> {
	const { product } = await params;
	const label = PRODUCT_LABELS[product] ?? product;
	const url = `https://support.uplink.net.au/help/${product}`;
	return {
		title: `${label} help`,
		description: `Help articles and guides for ${label} — Uplink Web Services support.`,
		alternates: { canonical: url },
		openGraph: { title: `${label} help · Uplink Support`, url, type: "website", locale: "en_AU" },
		robots: { index: true, follow: true },
	};
}

export default async function HelpProductPage({ params }: { params: Promise<{ product: string }> }) {
	const { product } = await params;
	const label = PRODUCT_LABELS[product] ?? product;

	const articles = await db
		.select({ slug: support_article.slug, title: support_article.title, summary: support_article.summary })
		.from(support_article)
		.where(
			and(
				eq(support_article.status, "published"),
				isNull(support_article.deleted_at),
				eq(support_article.product_kind, product),
			),
		)
		.orderBy(asc(support_article.sort_order));

	return (
		<div className="flex min-h-screen flex-col">
			<SiteHeader />
			<main className="mx-auto w-full max-w-2xl flex-1 px-5 py-12">
				<p className="text-xs uppercase tracking-widest text-black/40 dark:text-white/40">
					<Link href="/help" className="hover:text-uplink-red-800 dark:hover:text-uplink-red-400">Help centre</Link>
				</p>
				<h1 className="mt-1 mb-6 text-3xl font-bold tracking-tight">{label}</h1>

				{articles.length === 0 ? (
					<p className="text-sm text-black/55 dark:text-white/55">
						No articles here yet.{" "}
						<Link href="/new" className="text-uplink-red-800 underline dark:text-uplink-red-400">Contact support</Link>{" "}
						and we&apos;ll help directly.
					</p>
				) : (
					<ul className="divide-y divide-black/10 overflow-hidden rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/10">
						{articles.map((a) => (
							<li key={a.slug}>
								<Link href={`/help/${product}/${a.slug}`} className="block px-5 py-4 hover:bg-black/5 dark:hover:bg-white/5">
									<div className="font-medium">{a.title}</div>
									{a.summary && <div className="mt-0.5 line-clamp-2 text-sm text-black/55 dark:text-white/55">{a.summary}</div>}
								</Link>
							</li>
						))}
					</ul>
				)}

				<p className="mt-8 text-sm text-black/55 dark:text-white/55">
					Can&apos;t find what you need?{" "}
					<Link href="/new" className="text-uplink-red-800 underline dark:text-uplink-red-400">Open a ticket</Link>.
				</p>
			</main>
			<SiteFooter />
		</div>
	);
}
