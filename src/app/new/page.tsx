import { SiteFooter, SiteHeader } from "@/lib/brand";
import { SupportForm } from "./support-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contact support" };

export default async function NewTicketPage({
	searchParams,
}: {
	searchParams: Promise<{ product?: string }>;
}) {
	const { product } = await searchParams;
	return (
		<div className="flex min-h-screen flex-col">
			<SiteHeader />
			<main className="mx-auto w-full max-w-2xl flex-1 px-5 py-12">
				<h1 className="text-3xl font-bold tracking-tight">Contact support</h1>
				<p className="mt-2 mb-8 text-black/70 dark:text-white/70">
					Tell us what&apos;s going on and we&apos;ll get back to you. If you have an Uplink account,
					use the same email so we can see your products.
				</p>
				<SupportForm defaultProduct={product} />
			</main>
			<SiteFooter />
		</div>
	);
}
