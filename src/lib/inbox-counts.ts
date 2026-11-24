// How many tickets sit behind each inbox tab, so a tab shows it has something in it without
// being clicked (Paul, 2026-11-24: one ticket was waiting under Pending with nothing to say so).
//
// The numbers must match what the tab lists when opened: the same "not deleted" and product
// conditions as the page's own query, and the same meaning of Unverified (sender is neither a
// customer nor a store login, and the ticket is not closed).

export type StatusRow = { status: string; n: number; unverified: number };
export type TabCounts = Record<"open" | "pending" | "on_hold" | "solved" | "unverified" | "all", number>;

export function tabCounts(rows: StatusRow[]): TabCounts {
	const by = (s: string) => rows.filter((r) => r.status === s).reduce((a, r) => a + Number(r.n), 0);
	return {
		open: by("open"),
		pending: by("pending"),
		on_hold: by("on_hold"),
		solved: by("solved"),
		unverified: rows.filter((r) => r.status !== "closed").reduce((a, r) => a + Number(r.unverified), 0),
		all: rows.reduce((a, r) => a + Number(r.n), 0),
	};
}

// Tabs whose tickets are waiting on US get a coloured count; the rest get a quiet one. "All"
// gets none: it is a total, not something to act on.
export const TAB_BADGE: Record<string, string | null> = {
	open: "bg-emerald-500/20 text-emerald-300",
	pending: "bg-amber-500/20 text-amber-300",
	on_hold: "bg-stone-500/25 text-stone-200",
	unverified: "bg-amber-500/20 text-amber-300",
	solved: "bg-stone-700/50 text-stone-400",
	all: null,
};
