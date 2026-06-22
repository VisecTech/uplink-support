/**
 * Minimal transactional email transport for the standalone support app.
 * SMTP via nodemailer (Plesk relay); dev-disk fallback when SMTP_HOST unset.
 * Never throws. Ported from Counter (brand-color + marketing lanes dropped).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import nodemailer from "nodemailer";

let _transport: nodemailer.Transporter | null = null;
let _devLogged = false;

function getTransport(): nodemailer.Transporter | null {
	if (_transport) return _transport;
	const host = process.env.SMTP_HOST;
	if (!host) {
		if (!_devLogged) {
			console.log("[email] SMTP_HOST not set — emails written to /tmp/uplink-support-emails/");
			_devLogged = true;
		}
		return null;
	}
	_transport = nodemailer.createTransport({
		host,
		port: Number(process.env.SMTP_PORT ?? 465),
		secure: process.env.SMTP_SECURE !== "false",
		auth: process.env.SMTP_USER
			? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
			: undefined,
	});
	return _transport;
}

export type SendOpts = {
	to: string;
	subject: string;
	html: string;
	text?: string;
	from?: string;
	replyTo?: string;
	headers?: Record<string, string>;
};

export async function sendEmail(
	opts: SendOpts,
): Promise<{ ok: boolean; via: string; error?: string; path?: string }> {
	const from = opts.from ?? process.env.SMTP_FROM ?? process.env.EMAIL_SUPPORT ?? "support@uplink.net.au";
	const t = getTransport();

	if (!t) {
		try {
			await mkdir("/tmp/uplink-support-emails", { recursive: true });
			const ts = new Date().toISOString().replace(/[:.]/g, "-");
			const safeTo = opts.to.replace(/[^a-z0-9@._-]/gi, "_");
			const path = join("/tmp/uplink-support-emails", `${ts}__${safeTo}.html`);
			const wrapped = `<!--\nTo: ${opts.to}\nFrom: ${from}\nSubject: ${opts.subject}\n-->\n\n${opts.html}`;
			await writeFile(path, wrapped, "utf-8");
			console.log(`[email-dev] to=${opts.to} subject="${opts.subject}" → ${path}`);
			return { ok: true, via: "dev-disk", path };
		} catch (e) {
			return { ok: false, via: "dev-disk", error: e instanceof Error ? e.message : String(e) };
		}
	}

	try {
		const info = await t.sendMail({
			from,
			to: opts.to,
			subject: opts.subject,
			html: opts.html,
			text: opts.text,
			replyTo: opts.replyTo,
			headers: opts.headers,
		});
		console.log(`[email] to=${opts.to} subject="${opts.subject}" id=${info.messageId}`);
		return { ok: true, via: "smtp" };
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		console.error(`[email] FAILED to=${opts.to} subject="${opts.subject}": ${msg}`);
		return { ok: false, via: "smtp", error: msg };
	}
}
