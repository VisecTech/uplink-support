import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { support_attachment, support_message, support_ticket } from "@/db/schema";
import { supportRef } from "@/lib/email/support-emails";
import { getCustomerSubscriptions, resolveCustomerById } from "@/lib/identity";
import { TicketActions } from "./ticket-actions";

export const dynamic = "force-dynamic";

function fmt(d: Date | string): string {
	return new Date(d).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const [ticket] = await db.select().from(support_ticket).where(eq(support_ticket.id, id)).limit(1);
	if (!ticket) notFound();

	const messages = await db
		.select()
		.from(support_message)
		.where(eq(support_message.ticket_id, ticket.id))
		.orderBy(asc(support_message.created_at));

	const attachments = await db
		.select()
		.from(support_attachment)
		.where(eq(support_attachment.ticket_id, ticket.id));

	// Context via the READ-ONLY Counter connection (degrades to none).
	const customer = ticket.uplink_customer_id ? await resolveCustomerById(ticket.uplink_customer_id) : null;
	const subscriptions = customer ? await getCustomerSubscriptions(customer.id) : [];

	const attByMsg = new Map<string, typeof attachments>();
	for (const a of attachments) {
		const arr = attByMsg.get(a.message_id) ?? [];
		arr.push(a);
		attByMsg.set(a.message_id, arr);
	}

	return (
		<div className="grid gap-6 lg:grid-cols-[1fr_300px]">
			<div className="space-y-5">
				<div>
					<Link href="/inbox" className="text-xs text-stone-500 hover:text-white">← Inbox</Link>
					<h1 className="mt-1 text-xl font-bold">{ticket.subject}</h1>
					<p className="mt-1 text-xs text-stone-500">
						<span className="font-mono">{supportRef(ticket.id)}</span> · {ticket.product_kind} · {ticket.channel} · opened {fmt(ticket.created_at)}
					</p>
				</div>

				<div className="space-y-3">
					{messages.map((m) => {
						const mine = m.author_kind === "agent";
						const note = m.is_internal_note;
						const atts = attByMsg.get(m.id) ?? [];
						return (
							<div
								key={m.id}
								className={`rounded-xl border p-4 ${
									note
										? "border-amber-700/40 bg-amber-500/5"
										: mine
											? "border-stone-700 bg-stone-900/60"
											: "border-stone-800 bg-stone-900/20"
								}`}
							>
								<div className="mb-2 flex items-center justify-between text-xs text-stone-500">
									<span className="font-medium text-stone-300">
										{note ? "Internal note" : m.author_kind === "agent" ? "Agent" : m.author_kind === "ai" ? "AI" : "Customer"}
										{m.ai_generated ? " · AI draft" : ""}
									</span>
									<span>{fmt(m.created_at)}</span>
								</div>
								<div className="whitespace-pre-wrap text-sm leading-relaxed text-stone-200">{m.body_text}</div>
								{atts.length > 0 && (
									<ul className="mt-3 flex flex-wrap gap-2">
										{atts.map((a) => (
											<li key={a.id}>
												<a
													href={`/t/${ticket.id}/attachment/${a.id}`}
													className="rounded bg-stone-800/60 px-2 py-1 text-xs text-stone-300 hover:text-white"
												>
													📎 {a.original_filename} ({Math.round(a.size_bytes / 1024)} KB)
												</a>
											</li>
										))}
									</ul>
								)}
							</div>
						);
					})}
				</div>

				<TicketActions ticketId={ticket.id} status={ticket.status} />
			</div>

			<aside className="space-y-4 text-sm">
				<div className="space-y-2 rounded-xl border border-stone-800 p-4">
					<h2 className="text-xs uppercase tracking-wide text-stone-500">Requester</h2>
					<p className="text-stone-200">{ticket.requester_name || "—"}</p>
					<p className="break-all text-stone-400">{ticket.requester_email}</p>
					{customer ? (
						<p className="text-xs text-emerald-400">Uplink customer{customer.businessName ? ` · ${customer.businessName}` : ""}</p>
					) : (
						<p className="text-xs text-stone-500">Not a linked Uplink account</p>
					)}
				</div>

				{subscriptions.length > 0 && (
					<div className="space-y-2 rounded-xl border border-stone-800 p-4">
						<h2 className="text-xs uppercase tracking-wide text-stone-500">Products</h2>
						<ul className="space-y-2">
							{subscriptions.map((s) => (
								<li key={s.id} className="text-xs text-stone-300">
									<div className="flex justify-between gap-2">
										<span>{s.productKind}{s.planTier ? ` (${s.planTier})` : ""}</span>
										<span className="text-stone-500">{s.status}</span>
									</div>
									{s.hosting && (
										<div className="mt-0.5 text-[11px] text-stone-500">
											{s.hosting.primary_domain} · SSL {s.hosting.ssl_status ?? "?"} · DNS {s.hosting.dns_status ?? "?"}
										</div>
									)}
									{s.sites && (
										<div className="mt-0.5 text-[11px] text-stone-500">
											{s.sites.custom_domain || s.sites.primary_subdomain} · {s.sites.provision_state ?? "?"}
										</div>
									)}
								</li>
							))}
						</ul>
					</div>
				)}

				<div className="space-y-1 rounded-xl border border-stone-800 p-4">
					<h2 className="text-xs uppercase tracking-wide text-stone-500">Details</h2>
					<p className="text-xs text-stone-400">Priority: {ticket.priority}</p>
					<p className="text-xs text-stone-400">Status: {ticket.status}</p>
					{ticket.resource_ref && <p className="break-all text-xs text-stone-400">Ref: {ticket.resource_ref}</p>}
				</div>
			</aside>
		</div>
	);
}
