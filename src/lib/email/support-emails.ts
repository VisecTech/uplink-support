/**
 * Support transactional emails (support.uplink.net.au). Ported from the parked
 * Counter module. Staff deep-links point at the standalone console route /t/[id]
 * (no /support/ prefix).
 *
 * Threading: every outbound subject carries a [UWS-xxxxxx] token derived from the
 * ticket id — the robust fallback when clients mangle References/In-Reply-To. The
 * inbound webhook (Stage 4) re-extracts it to thread replies onto the same ticket.
 */
import { emailRole } from "./roles";
import { sendEmail } from "./transport";

/** Stable, human-readable ticket reference, e.g. "UWS-3F9A2C". */
export function supportRef(ticketId: string): string {
	return `UWS-${ticketId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

function siteUrl(): string {
	return (process.env.SUPPORT_SITE_URL ?? "https://support.uplink.net.au").replace(/\/$/, "");
}

function withRef(ref: string, subject: string): string {
	return subject.includes(`[${ref}]`) ? subject : `${subject} [${ref}]`;
}

function esc(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function shell(inner: string): string {
	return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f0f0f;max-width:560px;margin:0 auto;line-height:1.55">${inner}<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0"/><p style="font-size:12px;color:#888">Uplink Web Services — support.uplink.net.au</p></div>`;
}

/** Customer "we received your request" auto-reply. */
export async function sendSupportCustomerConfirm(opts: {
	to: string;
	requesterName?: string | null;
	ticketId: string;
	subject: string;
	supportFrom?: string;
}): Promise<void> {
	const ref = supportRef(opts.ticketId);
	const hi = opts.requesterName ? `Hi ${esc(opts.requesterName)},` : "Hi,";
	const html = shell(
		`<p>${hi}</p>
     <p>Thanks for getting in touch — we've logged your request and our team will get back to you shortly.</p>
     <p style="background:#faf8f5;border:1px solid #eee;border-radius:8px;padding:12px 14px">
       <strong>Reference:</strong> ${ref}<br/>
       <strong>Subject:</strong> ${esc(opts.subject)}
     </p>
     <p style="font-size:13px;color:#555">You can reply directly to this email to add more detail — keep the
     <strong>[${ref}]</strong> in the subject so it stays on the same ticket.</p>`,
	);
	const text = `${opts.requesterName ? `Hi ${opts.requesterName},` : "Hi,"}\n\nThanks for getting in touch — we've logged your request and will reply shortly.\n\nReference: ${ref}\nSubject: ${opts.subject}\n\nReply to this email to add detail (keep [${ref}] in the subject).\n\n— Uplink Web Services`;
	await sendEmail({
		to: opts.to,
		from: opts.supportFrom || emailRole("support"),
		replyTo: opts.supportFrom || emailRole("support"),
		subject: withRef(ref, `Re: ${opts.subject}`),
		html,
		text,
	});
}

/** New-ticket / new-reply alert to the support queue. */
export async function sendSupportStaffAlert(opts: {
	ticketId: string;
	subject: string;
	productKind: string;
	channel: string;
	requesterEmail: string;
	requesterName?: string | null;
	bodyPreview: string;
	to?: string;
}): Promise<void> {
	const ref = supportRef(opts.ticketId);
	const to = opts.to || process.env.STAFF_ALERT_EMAIL || emailRole("support");
	const link = `${siteUrl()}/t/${opts.ticketId}`;
	const html = shell(
		`<p><strong>New ${esc(opts.channel)} ticket — ${esc(opts.productKind)}</strong></p>
     <p style="background:#faf8f5;border:1px solid #eee;border-radius:8px;padding:12px 14px">
       <strong>${ref}</strong> · ${esc(opts.subject)}<br/>
       From: ${esc(opts.requesterName || "")} &lt;${esc(opts.requesterEmail)}&gt;
     </p>
     <p style="white-space:pre-wrap;color:#333">${esc(opts.bodyPreview.slice(0, 600))}</p>
     <p><a href="${link}" style="display:inline-block;background:#991b1b;color:#fff;text-decoration:none;padding:9px 16px;border-radius:8px">Open ticket</a></p>`,
	);
	const text = `New ${opts.channel} ticket — ${opts.productKind}\n${ref} · ${opts.subject}\nFrom: ${opts.requesterName || ""} <${opts.requesterEmail}>\n\n${opts.bodyPreview.slice(0, 600)}\n\nOpen: ${link}`;
	await sendEmail({ to, subject: `[${ref}] ${opts.subject}`, html, text, replyTo: opts.requesterEmail });
}

/** An agent's reply to the customer (threaded). */
export async function sendSupportAgentReply(opts: {
	to: string;
	requesterName?: string | null;
	ticketId: string;
	subject: string;
	bodyText: string;
	bodyHtml?: string;
	supportFrom?: string;
	inReplyTo?: string | null;
	references?: string | null;
}): Promise<{ ok: boolean }> {
	const ref = supportRef(opts.ticketId);
	const headers: Record<string, string> = {};
	if (opts.inReplyTo) headers["In-Reply-To"] = opts.inReplyTo;
	const refsChain = [opts.references, opts.inReplyTo].filter(Boolean).join(" ");
	if (refsChain) headers["References"] = refsChain;
	const html = shell(opts.bodyHtml ?? `<p style="white-space:pre-wrap">${esc(opts.bodyText)}</p>`);
	const res = await sendEmail({
		to: opts.to,
		from: opts.supportFrom || emailRole("support"),
		replyTo: opts.supportFrom || emailRole("support"),
		subject: withRef(ref, `Re: ${opts.subject}`),
		html,
		text: opts.bodyText,
		headers: Object.keys(headers).length ? headers : undefined,
	});
	return { ok: res.ok };
}
