"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { support_article } from "@/db/schema";
import { requireStaff } from "@/lib/auth/staff";

type SaveR = { ok: true; id: string } | { ok: false; error: string };

function slugify(s: string): string {
	return (
		s
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 160) || "article"
	);
}

export async function saveArticleAction(input: {
	id?: string;
	product_kind: string;
	slug: string;
	title: string;
	summary: string;
	body_md: string;
	status: string;
	sort_order: number;
}): Promise<SaveR> {
	await requireStaff();
	const title = input.title.trim();
	if (!title) return { ok: false, error: "title is required" };
	const product_kind = input.product_kind;
	const slug = slugify(input.slug || title);
	const status = input.status === "published" ? "published" : "draft";
	const values = {
		product_kind,
		slug,
		title,
		summary: input.summary.trim() || null,
		body_md: input.body_md,
		status,
		sort_order: Number.isFinite(input.sort_order) ? input.sort_order : 0,
	};

	try {
		let id = input.id;
		if (id) {
			await db.update(support_article).set({ ...values, updated_at: new Date() }).where(eq(support_article.id, id));
		} else {
			const [row] = await db.insert(support_article).values(values).returning();
			id = row.id;
		}
		revalidatePath("/kb");
		revalidatePath(`/help/${product_kind}`);
		revalidatePath(`/help/${product_kind}/${slug}`);
		return { ok: true, id: id as string };
	} catch (e) {
		const m = e instanceof Error ? e.message : String(e);
		return {
			ok: false,
			error: m.toLowerCase().includes("unique")
				? "an article with that product + slug already exists"
				: "save failed",
		};
	}
}

export async function deleteArticleAction(id: string): Promise<{ ok: boolean }> {
	await requireStaff();
	await db.update(support_article).set({ deleted_at: new Date() }).where(eq(support_article.id, id));
	revalidatePath("/kb");
	return { ok: true };
}
