"use server";

import { and, desc, eq, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { support_message, support_ticket } from "@/db/schema";
import { requireStaff } from "@/lib/auth/staff";
import { sendSupportAgentReply } from "@/lib/email/support-emails";

type R = { ok: true } | { ok: false; error: string };

const VALID_STATUS = new Set(["open", "pending", "on_hold", "solved", "closed"]);

/** Agent reply (emails the customer) or an internal note (staff-only). */
export async function replyToTicketAction(ticketId: string, body: string, isInternal: boolean): Promise<R> {
	const staff = await requireStaff();
	const text = body.trim();
	if (!text) return { ok: false, error: "message is empty" };

	const [ticket] = await db.select().from(support_ticket).where(eq(support_ticket.id, ticketId)).limit(1);
	if (!ticket) return { ok: false, error: "ticket not found" };

	await db.insert(support_message).values({
		ticket_id: ticket.id,
		author_kind: "agent",
		author_staff_id: staff.id,
		body_text: text,
		is_internal_note: isInternal,
	});

	if (!isInternal) {
		const [lastInbound] = await db
			.select({ mid: support_message.email_message_id })
			.from(support_message)
			.where(
				and(
					eq(support_message.ticket_id, ticket.id),
					eq(support_message.author_kind, "customer"),
					isNotNull(support_message.email_message_id),
				),
			)
			.orderBy(desc(support_message.created_at))
			.limit(1);

		await sendSupportAgentReply({
			to: ticket.requester_email,
			requesterName: ticket.requester_name,
			ticketId: ticket.id,
			subject: ticket.subject,
			bodyText: text,
			inReplyTo: lastInbound?.mid ?? null,
		}).catch((e) => console.error("[support] agent reply email failed", e));

		await db
			.update(support_ticket)
			.set({
				status: ticket.status === "solved" || ticket.status === "closed" ? "open" : "pending",
				first_responded_at: ticket.first_responded_at ?? new Date(),
				updated_at: new Date(),
			})
			.where(eq(support_ticket.id, ticket.id));
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
