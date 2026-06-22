import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/lib/brand";

export const dynamic = "force-dynamic";
export const metadata = { title: "Request received" };

export default async function ThanksPage({
	searchParams,
}: {
	searchParams: Promise<{ ref?: string }>;
}) {
	const { ref } = await searchParams;
	const fullRef = ref ? `UWS-${ref.replace(/^UWS-/, "")}` : null;
	return (
		<div className="flex min-h-screen flex-col">
			<SiteHeader />
			<main className="mx-auto w-full max-w-xl flex-1 px-5 py-16 text-center">
				<div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-uplink-red-800/10 text-uplink-red-800 dark:text-uplink-red-400">
					<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
						<path d="M20 6 9 17l-5-5" />
					</svg>
				</div>
				<h1 className="text-3xl font-bold tracking-tight">Thanks — we&apos;ve got it</h1>
				<p className="mt-3 text-black/70 dark:text-white/70">
					We&apos;ve logged your request and emailed you a confirmation. Our team will be in touch
					shortly.
				</p>
				{fullRef && (
					<p className="mx-auto mt-6 inline-block rounded-lg border border-black/10 bg-white/60 px-5 py-3 text-sm dark:border-white/10 dark:bg-white/5">
						Your reference: <strong className="font-mono">{fullRef}</strong>
					</p>
				)}
				<div className="mt-8">
					<Link href="/" className="text-sm font-medium text-uplink-red-800 underline dark:text-uplink-red-400">
						Back to support home
					</Link>
				</div>
			</main>
			<SiteFooter />
		</div>
	);
}
