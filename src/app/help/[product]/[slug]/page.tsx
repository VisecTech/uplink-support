import DOMPurify from "isomorphic-dompurify";
import { and, eq, isNull } from "drizzle-orm";
import { marked } from "marked";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { support_article } from "@/db/schema";
import { SiteFooter, SiteHeader } from "@/lib/brand";
import { PRODUCT_LABELS } from "@/lib/products";

export const dynamic = "force-dynamic";

const SITE = "https://support.uplink.net.au";

async function fetchArticle(product: string, slug: string) {
	const [a] = await db
		.select()
		.from(support_article)
		.where(
			and(
				eq(support_article.product_kind, product),
				eq(support_article.slug, slug),
				eq(support_article.status, "published"),
				isNull(support_article.deleted_at),
			),
		)
		.limit(1);
	return a;
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ product: string; slug: string }>;
}): Promise<Metadata> {
	const { product, slug } = await params;
	const a = await fetchArticle(product, slug);
	if (!a) return { title: "Article not found", robots: { index: false, follow: true } };
	const url = `${SITE}/help/${product}/${slug}`;
	const description = a.summary || `${a.title} — Uplink Web Services help.`;
	return {
		title: a.title,
		description,
		alternates: { canonical: url },
		openGraph: { title: a.title, description, url, type: "article", locale: "en_AU" },
		robots: { index: true, follow: true },
	};
}

export default async function HelpArticlePage({
	params,
}: {
	params: Promise<{ product: string; slug: string }>;
}) {
	const { product, slug } = await params;
	const a = await fetchArticle(product, slug);
	if (!a) notFound();

	const label = PRODUCT_LABELS[product] ?? product;
	const html = DOMPurify.sanitize(await marked.parse(a.body_md || ""));
	const url = `${SITE}/help/${product}/${slug}`;
	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "Article",
		headline: a.title,
		description: a.summary || a.title,
		url,
		mainEntityOfPage: { "@type": "WebPage", "@id": url },
		datePublished: a.created_at,
		dateModified: a.updated_at,
		author: { "@type": "Organization", name: "Uplink Web Services" },
		publisher: {
			"@type": "Organization",
			name: "Uplink Web Services",
			logo: { "@type": "ImageObject", url: `${SITE}/uplink-mark.svg` },
		},
	};

	return (
		<div className="flex min-h-screen flex-col">
			<SiteHeader />
			<main className="mx-auto w-full max-w-2xl flex-1 px-5 py-12">
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD */}
				<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
				<p className="text-sm text-black/50 dark:text-white/50">
					<Link href={`/help/${product}`} className="hover:text-uplink-red-800 dark:hover:text-uplink-red-400">← {label} help</Link>
				</p>
				<h1 className="mt-2 mb-6 text-3xl font-bold tracking-tight">{a.title}</h1>
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: sanitised by DOMPurify */}
				<article className="kb-article" dangerouslySetInnerHTML={{ __html: html }} />
				<hr className="my-8 border-black/10 dark:border-white/10" />
				<p className="text-sm text-black/55 dark:text-white/55">
					Still stuck?{" "}
					<Link href="/new" className="text-uplink-red-800 underline dark:text-uplink-red-400">Open a ticket</Link> and we&apos;ll help.
				</p>
			</main>
			<SiteFooter />
		</div>
	);
}
