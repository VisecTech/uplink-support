import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/lib/brand";
import { KbSearch } from "@/components/kb-search";

export const dynamic = "force-dynamic";

const PRODUCTS = [
	{ name: "Hosting", desc: "Domains, email, SSL and your control panel.", href: "/help/hosting" },
	{ name: "Shopkit", desc: "Your online store — payments, shipping, products.", href: "/help/shopkit" },
	{ name: "WPresskit Sites", desc: "Managed WordPress websites.", href: "/help/sites" },
	{ name: "Domains & Billing", desc: "Renewals, invoices and your account.", href: "/help/general" },
];

export default function HomePage() {
	return (
		<div className="flex min-h-screen flex-col">
			<SiteHeader />
			<main className="mx-auto w-full max-w-5xl flex-1 px-5">
				<section className="py-14 sm:py-20">
					<h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
						How can we help?
					</h1>
					<p className="mt-4 max-w-2xl text-lg text-black/70 dark:text-white/70">
						Support for every Uplink Web Services product. Search the help centre, or send us a
						message and we&apos;ll get back to you — with full context on your account.
					</p>
					<div className="mt-8 flex flex-wrap gap-3">
						<Link
							href="/new"
							className="rounded-md bg-uplink-red-800 px-5 py-3 font-medium text-white hover:bg-uplink-red-900"
						>
							Contact support
						</Link>
						<Link
							href="/help"
							className="rounded-md border border-black/15 px-5 py-3 font-medium hover:border-uplink-red-800 dark:border-white/20"
						>
							Browse help centre
						</Link>
					</div>
				</section>

				<section className="pb-10">
					<KbSearch />
				</section>

				<section className="grid gap-4 pb-8 sm:grid-cols-2">
					{PRODUCTS.map((p) => (
						<Link
							key={p.name}
							href={p.href}
							className="group rounded-xl border border-black/10 bg-white/60 p-5 transition-colors hover:border-uplink-red-800 dark:border-white/10 dark:bg-white/5"
						>
							<h2 className="text-base font-semibold group-hover:text-uplink-red-800 dark:group-hover:text-uplink-red-400">
								{p.name}
							</h2>
							<p className="mt-1 text-sm text-black/60 dark:text-white/60">{p.desc}</p>
						</Link>
					))}
				</section>
			</main>
			<SiteFooter />
		</div>
	);
}
