"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { assignTicketAction, replyToTicketAction, setTicketStatusAction } from "../../actions";

const STATUSES = ["open", "pending", "on_hold", "solved", "closed"];

export function TicketActions({ ticketId, status }: { ticketId: string; status: string }) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	const [body, setBody] = useState("");
	const [internal, setInternal] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [drafting, setDrafting] = useState(false);

	async function draftWithAi() {
		setError(null);
		setDrafting(true);
		try {
			const res = await fetch(`/t/${ticketId}/draft`, { method: "POST" });
			const data = await res.json();
			if (!res.ok || !data.ok) {
				setError(data.error || "draft failed");
				return;
			}
			setBody(data.draft);
			setInternal(false);
		} catch {
			setError("draft request failed");
		} finally {
			setDrafting(false);
		}
	}

	function submitReply() {
		setError(null);
		if (!body.trim()) {
			setError("Write a message first.");
			return;
		}
		startTransition(async () => {
			const r = await replyToTicketAction(ticketId, body, internal);
			if (!r.ok) {
				setError(r.error);
				return;
			}
			setBody("");
			router.refresh();
		});
	}

	function changeStatus(next: string) {
		startTransition(async () => {
			await setTicketStatusAction(ticketId, next);
			router.refresh();
		});
	}

	function assignSelf() {
		startTransition(async () => {
			await assignTicketAction(ticketId);
			router.refresh();
		});
	}

	return (
		<div className="space-y-3 rounded-xl border border-stone-800 bg-stone-900/40 p-4">
			<textarea
				value={body}
				onChange={(e) => setBody(e.target.value)}
				rows={5}
				placeholder={internal ? "Internal note (not emailed to the customer)…" : "Reply to the customer…"}
				className="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 focus:border-stone-500 focus:outline-none"
			/>
			{error && <p className="text-xs text-red-400">{error}</p>}
			<div className="flex flex-wrap items-center gap-3">
				<label className="flex items-center gap-2 text-xs text-stone-400">
					<input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
					Internal note
				</label>
				<button
					type="button"
					onClick={draftWithAi}
					disabled={drafting || pending}
					title="Generate a draft reply from the customer's context + KB (you review before sending)"
					className="rounded-lg border border-stone-600 px-3 py-2 text-sm text-stone-300 hover:border-stone-400 disabled:opacity-50"
				>
					{drafting ? "Drafting…" : "✦ Draft with AI"}
				</button>
				<button
					type="button"
					onClick={submitReply}
					disabled={pending || drafting}
					className="rounded-lg bg-uplink-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-uplink-red-800 disabled:opacity-50"
				>
					{pending ? "Sending…" : internal ? "Add note" : "Send reply"}
				</button>
				<div className="flex-1" />
				<button type="button" onClick={assignSelf} disabled={pending} className="text-xs text-stone-400 hover:text-white">
					Assign to me
				</button>
				<select
					value={status}
					onChange={(e) => changeStatus(e.target.value)}
					disabled={pending}
					className="rounded-lg border border-stone-700 bg-stone-950 px-2 py-1.5 text-xs text-stone-200"
				>
					{STATUSES.map((s) => (
						<option key={s} value={s}>{s}</option>
					))}
				</select>
			</div>
		</div>
	);
}
