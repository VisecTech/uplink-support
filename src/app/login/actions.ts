"use server";

import { createStaffSession, verifyStaffCredentials } from "@/lib/auth/staff";

export async function loginAction(
	_prev: { error?: string } | null,
	formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
	const email = String(formData.get("email") ?? "");
	const password = String(formData.get("password") ?? "");
	if (!email || !password) return { error: "Email and password required" };
	const staff = await verifyStaffCredentials(email, password);
	if (!staff) return { error: "Invalid email or password" };
	await createStaffSession(staff.id);
	return { ok: true };
}
