"use server";

import { headers } from "next/headers";
import { requestPasswordReset } from "@/lib/auth/password-reset";

export async function forgotPasswordAction(
	_prev: { error?: string; sent?: boolean } | null,
	formData: FormData,
): Promise<{ error?: string; sent?: boolean }> {
	const h = await headers();
	// X-Real-IP is set by our nginx from $remote_addr (CF real-ip applied), so the
	// client cannot forge it; the first X-Forwarded-For hop it could.
	const ip = h.get("x-real-ip")?.trim() || null;
	const r = await requestPasswordReset(String(formData.get("email") ?? ""), ip);
	return r.ok ? { sent: true } : { error: r.error };
}
