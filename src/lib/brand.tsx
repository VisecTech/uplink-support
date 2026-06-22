/**
 * Shared Uplink-branded chrome for the support site.
 */
import Link from "next/link";
import { SupportWidgetEmbed } from "@/components/support-widget-embed";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
	return (
		<header className="border-b border-black/10 dark:border-white/10">
			<div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
				<Link href="/" className="flex items-center gap-2.5">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img src="/uplink-mark.svg" alt="" width={30} height={30} />
					<span className="text-lg font-semibold tracking-tight">
						Uplink <span className="text-uplink-red-800 dark:text-uplink-red-400">Support</span>
					</span>
				</Link>
				<nav className="flex items-center gap-5 text-sm">
					<Link href="/help" className="hover:text-uplink-red-800 dark:hover:text-uplink-red-400">
						Help centre
					</Link>
					<Link
						href="/new"
						className="rounded-md bg-uplink-red-800 px-3.5 py-2 font-medium text-white hover:bg-uplink-red-900"
					>
						Contact us
					</Link>
				</nav>
			</div>
		</header>
	);
}

export function SiteFooter() {
	return (
		<footer className="mt-16 border-t border-black/10 dark:border-white/10">
			<div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-black/60 dark:text-white/50 sm:flex-row">
				<p>© {new Date().getFullYear()} Uplink Web Services</p>
				<div className="flex items-center gap-5">
					<nav className="flex items-center gap-5">
						<a href="https://uplink.net.au" className="hover:text-uplink-red-800 dark:hover:text-uplink-red-400">
							uplink.net.au
						</a>
						<a
							href="https://accounts.uplink.net.au"
							className="hover:text-uplink-red-800 dark:hover:text-uplink-red-400"
						>
							My account
						</a>
					</nav>
					<ThemeToggle />
				</div>
			</div>
			<SupportWidgetEmbed product="general" />
		</footer>
	);
}
