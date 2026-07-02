import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { destroyStaffSession, getCurrentStaff } from "@/lib/auth/staff";

export const metadata = {
	title: { template: "%s · Uplink Support", default: "Uplink Support" },
	robots: { index: false, follow: false },
};

async function logoutAction() {
	"use server";
	await destroyStaffSession();
	redirect("/login");
}

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
	const staff = await getCurrentStaff();
	if (!staff) redirect("/login");

	return (
		<div className="min-h-screen bg-stone-950 text-stone-200">
			<header className="border-b border-stone-800 bg-stone-900/60">
				<div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
					<div className="flex items-center gap-5">
						<Link href="/inbox" className="font-bold tracking-tight">
							Uplink <span className="text-uplink-red-400">Support</span>
						</Link>
						<Link href="/inbox" className="text-sm text-stone-400 hover:text-white">Inbox</Link>
						<Link href="/kb" className="text-sm text-stone-400 hover:text-white">Knowledge base</Link>
					</div>
					<div className="flex items-center gap-4">
						<a
							href="https://admin.uplink.net.au"
							className="text-xs text-stone-400 hover:text-white"
							title="Back to the Uplink admin console"
						>
							← Admin
						</a>
						<span className="text-xs text-stone-500">·</span>
						<span className="text-xs text-stone-400">{staff.name || staff.email}</span>
						<form action={logoutAction}>
							<button type="submit" className="text-xs text-stone-400 hover:text-white">
								Sign out
							</button>
						</form>
					</div>
				</div>
			</header>
			<main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
		</div>
	);
}
