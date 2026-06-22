import { desc, isNull } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { support_article } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function KbListPage() {
	const rows = await db
		.select()
		.from(support_article)
		.where(isNull(support_article.deleted_at))
		.orderBy(desc(support_article.updated_at))
		.limit(200);

	return (
		<div className="space-y-5">
			<div className="flex flex-col items-center gap-3 text-center">
				<h1 className="text-lg font-bold">Knowledge base</h1>
				<Link href="/kb/new" className="rounded-lg bg-uplink-red-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-uplink-red-800">
					New article
				</Link>
			</div>
			<div className="overflow-hidden rounded-xl border border-stone-800">
				{rows.length === 0 ? (
					<p className="p-6 text-center text-sm text-stone-500">No articles yet.</p>
				) : (
					<table className="w-full text-sm">
						<thead className="bg-stone-900/60 text-xs uppercase tracking-wide text-stone-400">
							<tr>
								<th className="px-4 py-2 text-left font-medium">Title</th>
								<th className="px-4 py-2 text-left font-medium">Product</th>
								<th className="px-4 py-2 text-left font-medium">Status</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-stone-800/70">
							{rows.map((a) => (
								<tr key={a.id} className="hover:bg-stone-900/40">
									<td className="px-4 py-2.5">
										<Link href={`/kb/${a.id}`} className="hover:underline">{a.title}</Link>
										<span className="ml-2 text-xs text-stone-600">/{a.slug}</span>
									</td>
									<td className="px-4 py-2.5 text-stone-400">{a.product_kind}</td>
									<td className="px-4 py-2.5">
										<span className={`rounded-full px-2 py-0.5 text-xs ${a.status === "published" ? "bg-emerald-500/15 text-emerald-300" : "bg-stone-700/40 text-stone-300"}`}>
											{a.status}
										</span>
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
