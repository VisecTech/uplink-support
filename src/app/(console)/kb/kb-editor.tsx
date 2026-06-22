"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteArticleAction, saveArticleAction } from "./actions";

const PRODUCTS = ["general", "hosting", "shopkit", "sites", "clubkit", "webdev_project"];
const FIELD =
	"w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 focus:border-stone-500 focus:outline-none";

type Article = {
	id: string;
	product_kind: string;
	slug: string;
	title: string;
	summary: string | null;
	body_md: string;
	status: string;
	sort_order: number;
};

export function KbEditor({ article }: { article?: Article }) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);
	const [f, setF] = useState({
		product_kind: article?.product_kind ?? "general",
		title: article?.title ?? "",
		slug: article?.slug ?? "",
		summary: article?.summary ?? "",
		body_md: article?.body_md ?? "",
		status: article?.status ?? "draft",
		sort_order: article?.sort_order ?? 0,
	});

	function save() {
		setError(null);
		startTransition(async () => {
			const r = await saveArticleAction({ id: article?.id, ...f });
			if (!r.ok) {
				setError(r.error);
				return;
			}
			router.push("/kb");
			router.refresh();
		});
	}

	function remove() {
		if (!article || !confirm("Delete this article?")) return;
		startTransition(async () => {
			await deleteArticleAction(article.id);
			router.push("/kb");
			router.refresh();
		});
	}

	return (
		<div className="max-w-2xl space-y-4">
			<div className="grid gap-4 sm:grid-cols-2">
				<label className="text-sm">
					<span className="mb-1 block text-xs text-stone-400">Product</span>
					<select className={FIELD} value={f.product_kind} onChange={(e) => setF({ ...f, product_kind: e.target.value })}>
						{PRODUCTS.map((p) => <option key={p} value={p}>{p}</option>)}
					</select>
				</label>
				<label className="text-sm">
					<span className="mb-1 block text-xs text-stone-400">Status</span>
					<select className={FIELD} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
						<option value="draft">draft</option>
						<option value="published">published</option>
					</select>
				</label>
			</div>
			<label className="block text-sm">
				<span className="mb-1 block text-xs text-stone-400">Title</span>
				<input className={FIELD} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
			</label>
			<label className="block text-sm">
				<span className="mb-1 block text-xs text-stone-400">Slug (optional — derived from title)</span>
				<input className={FIELD} value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} placeholder="auto" />
			</label>
			<label className="block text-sm">
				<span className="mb-1 block text-xs text-stone-400">Summary (used by the AI bot + listings)</span>
				<textarea className={FIELD} rows={2} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} />
			</label>
			<label className="block text-sm">
				<span className="mb-1 block text-xs text-stone-400">Body (Markdown)</span>
				<textarea className={`${FIELD} font-mono`} rows={14} value={f.body_md} onChange={(e) => setF({ ...f, body_md: e.target.value })} />
			</label>
			{error && <p className="text-sm text-red-400">{error}</p>}
			<div className="flex items-center gap-3">
				<button type="button" onClick={save} disabled={pending} className="rounded-lg bg-uplink-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-uplink-red-800 disabled:opacity-50">
					{pending ? "Saving…" : "Save"}
				</button>
				{article && (
					<button type="button" onClick={remove} disabled={pending} className="text-xs text-stone-500 hover:text-red-400">
						Delete
					</button>
				)}
			</div>
		</div>
	);
}
