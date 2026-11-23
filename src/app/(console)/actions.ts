"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { support_message, support_ticket } from "@/db/schema";
import { requireStaff } from "@/lib/auth/staff";
import { postAgentReply } from "@/lib/agent-reply";

type R = { ok: true } | { ok: false; error: string };

const VALID_STATUS = new Set(["open", "pending", "on_hold", "solved", "closed"]);

/** Agent reply (emails the customer) or an internal note (staff-only). */
export async function replyToTicketAction(ticketId: string, body: string, isInternal: boolean): Promise<R> {
	const staff = await requireStaff();
	const text = body.trim();
	if (!text) return { ok: false, error: "message is empty" };

	if (isInternal) {
		const [ticket] = await db.select({ id: support_ticket.id }).from(support_ticket).where(eq(support_ticket.id, ticketId)).limit(1);
		if (!ticket) return { ok: false, error: "ticket not found" };
		await db.insert(support_message).values({
			ticket_id: ticket.id,
			author_kind: "agent",
			author_staff_id: staff.id,
			body_text: text,
			is_internal_note: true,
		});
	} else {
		// The same function scripts/agent-reply.ts uses: record, email, set pending.
		const r = await postAgentReply({ ticketId, staffId: staff.id, text });
		if (!r.ok) return r;
		if (!r.emailed) {
			revalidatePath(`/t/${ticketId}`);
			return { ok: false, error: "Saved on the ticket, but the email could NOT be sent. Check mail settings and send it again." };
		}
	}

	revalidatePath(`/t/${ticketId}`);
	revalidatePath("/inbox");
	return { ok: true };
}

export async function setTicketStatusAction(ticketId: string, status: string): Promise<R> {
	await requireStaff();
	if (!VALID_STATUS.has(status)) return { ok: false, error: "bad status" };
	await db
		.update(support_ticket)
		.set({
			status,
			updated_at: new Date(),
			solved_at: status === "solved" ? new Date() : null,
			closed_at: status === "closed" ? new Date() : null,
		})
		.where(eq(support_ticket.id, ticketId));
	revalidatePath(`/t/${ticketId}`);
	revalidatePath("/inbox");
	return { ok: true };
}

/** Assign to self (no arg) or a specific staff id. */
export async function assignTicketAction(ticketId: string, assigneeStaffId?: string | null): Promise<R> {
	const staff = await requireStaff();
	await db
		.update(support_ticket)
		.set({
			assignee_staff_id: assigneeStaffId === undefined ? staff.id : assigneeStaffId,
			updated_at: new Date(),
		})
		.where(eq(support_ticket.id, ticketId));
	revalidatePath(`/t/${ticketId}`);
	revalidatePath("/inbox");
	return { ok: true };
}
