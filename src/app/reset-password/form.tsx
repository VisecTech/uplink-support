"use client";

import { useActionState } from "react";
import { PasswordInput } from "@/components/password-input";
import { resetPasswordAction } from "./actions";

const FIELD =
	"block w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm focus:border-uplink-red-800 focus:outline-none dark:border-white/20 dark:bg-white/5";

export function ResetPasswordForm({ token, minLength }: { token: string; minLength: number }) {
	const [state, action, pending] = useActionState(resetPasswordAction, null);

	if (state?.done) {
		return (
			<div className="space-y-4 text-sm">
				<p>Your password has been changed, and you've been signed out everywhere else.</p>
				<a
					href="/login"
					className="block w-full rounded-md bg-uplink-red-800 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-uplink-red-900"
				>
					Sign in
				</a>
			</div>
		);
	}

	return (
		<form action={action} className="space-y-4">
			<input type="hidden" name="token" value={token} />
			<div>
				<label className="mb-1 block text-xs font-medium text-black/70 dark:text-white/70" htmlFor="password">
					New password
				</label>
				<PasswordInput id="password" name="password" autoComplete="new-password" minLength={minLength} className={FIELD} />
				<p className="mt-1 text-xs text-black/50 dark:text-white/50">At least {minLength} characters.</p>
			</div>
			<div>
				<label className="mb-1 block text-xs font-medium text-black/70 dark:text-white/70" htmlFor="confirm">
					Confirm new password
				</label>
				<PasswordInput id="confirm" name="confirm" autoComplete="new-password" minLength={minLength} className={FIELD} />
			</div>
			{state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
			<button
				type="submit"
				disabled={pending}
				className="w-full rounded-md bg-uplink-red-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-uplink-red-900 disabled:opacity-50"
			>
				{pending ? "Saving…" : "Set new password"}
			</button>
		</form>
	);
}
