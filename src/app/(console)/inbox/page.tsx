import { and, desc, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { support_ticket } from "@/db/schema";
import { supportRef } from "@/lib/email/support-emails";

export const dynamic = "force-dynamic";

const STATUS_TABS = [
	{ key: "open", label: "Open" },
	{ key: "pending", label: "Pending" },
	{ key: "on_hold", label: "On hold" },
	{ key: "solved", label: "Solved" },
	{ key: "all", label: "All" },
];

const STATUS_STYLE: Record<string, string> = {
	open: "bg-emerald-500/15 text-emerald-300",
	pending: "bg-amber-500/15 text-amber-300",
	on_hold: "bg-stone-500/15 text-stone-300",
	solved: "bg-blue-500/15 text-blue-300",
	closed: "bg-stone-700/40 text-stone-400",
};
const PRIORITY_STYLE: Record<string, string> = {
	urgent: "text-red-400",
	high: "text-amber-400",
	normal: "text-stone-400",
	low: "text-stone-500",
};

export default async function SupportInboxPage({
	searchParams,
}: {
	searchParams: Promise<{ status?: string; product?: string }>;
}) {
	const sp = await searchParams;
	const status = sp.status ?? "open";

	const conds = [isNull(support_ticket.deleted_at)];
	if (status !== "all") conds.push(eq(support_ticket.status, status));
	if (sp.product) conds.push(eq(support_ticket.product_kind, sp.product));

	const rows = await db
		.select()
		.from(support_ticket)
		.where(and(...conds))
		.orderBy(desc(support_ticket.updated_at))
		.limit(100);

	return (
		<div className="space-y-5">
			<div className="flex flex-col items-center gap-1 text-center">
				<h1 className="text-lg font-bold">Tickets</h1>
				<span className="text-xs text-stone-500">{rows.length} shown</span>
			</div>

			<nav className="flex justify-center gap-1 text-sm">
				{STATUS_TABS.map((t) => {
					const active = status === t.key;
					return (
						<Link
							key={t.key}
							href={`/inbox?status=${t.key}`}
							className={`rounded-lg px-3 py-1.5 ${active ? "bg-stone-800 text-white" : "text-stone-400 hover:text-white"}`}
						>
							{t.label}
						</Link>
					);
				})}
			</nav>

			<div className="overflow-hidden rounded-xl border border-stone-800">
				{rows.length === 0 ? (
					<p className="p-6 text-center text-sm text-stone-500">No tickets here.</p>
				) : (
					<table className="w-full text-sm">
						<thead className="bg-stone-900/60 text-xs uppercase tracking-wide text-stone-400">
							<tr>
								<th className="px-4 py-2 text-left font-medium">Ref</th>
								<th className="px-4 py-2 text-left font-medium">Subject</th>
								<th className="px-4 py-2 text-left font-medium">Requester</th>
								<th className="px-4 py-2 text-left font-medium">Product</th>
								<th className="px-4 py-2 text-left font-medium">Status</th>
								<th className="px-4 py-2 text-left font-medium">Updated</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-stone-800/70">
							{rows.map((t) => (
								<tr key={t.id} className="hover:bg-stone-900/40">
									<td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-stone-400">
										<Link href={`/t/${t.id}`} className="hover:text-white">{supportRef(t.id)}</Link>
									</td>
									<td className="px-4 py-2.5">
										<Link href={`/t/${t.id}`} className="hover:underline">
											<span className={PRIORITY_STYLE[t.priority] ?? ""}>{t.priority === "urgent" ? "● " : ""}</span>
											{t.subject}
										</Link>
									</td>
									<td className="px-4 py-2.5 text-stone-400">{t.requester_name || t.requester_email}</td>
									<td className="px-4 py-2.5 text-stone-400">{t.product_kind}</td>
									<td className="px-4 py-2.5">
										<span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[t.status] ?? "bg-stone-700/40 text-stone-300"}`}>
											{t.status}
										</span>
									</td>
									<td className="whitespace-nowrap px-4 py-2.5 text-xs text-stone-500">
										{new Date(t.updated_at).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		</div>
	);
}
