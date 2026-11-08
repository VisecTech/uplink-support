"use server";

import { resetPasswordWithToken } from "@/lib/auth/password-reset";

export async function resetPasswordAction(
	_prev: { error?: string; done?: boolean } | null,
	formData: FormData,
): Promise<{ error?: string; done?: boolean }> {
	const r = await resetPasswordWithToken(
		String(formData.get("token") ?? ""),
		String(formData.get("password") ?? ""),
		String(formData.get("confirm") ?? ""),
	);
	return r.ok ? { done: true } : { error: r.error };
}
