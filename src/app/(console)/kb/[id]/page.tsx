import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { support_article } from "@/db/schema";
import { KbEditor } from "../kb-editor";

export const dynamic = "force-dynamic";

export default async function EditKbArticlePage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const [a] = await db.select().from(support_article).where(eq(support_article.id, id)).limit(1);
	if (!a) notFound();

	return (
		<div className="space-y-5">
			<h1 className="text-lg font-bold">Edit article</h1>
			<KbEditor
				article={{
					id: a.id,
					product_kind: a.product_kind,
					slug: a.slug,
					title: a.title,
					summary: a.summary,
					body_md: a.body_md,
					status: a.status,
					sort_order: a.sort_order,
				}}
			/>
		</div>
	);
}
