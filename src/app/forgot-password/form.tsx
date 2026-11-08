"use client";

import { useActionState } from "react";
import { forgotPasswordAction } from "./actions";

const FIELD =
	"block w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm focus:border-uplink-red-800 focus:outline-none dark:border-white/20 dark:bg-white/5";

export function ForgotPasswordForm() {
	const [state, action, pending] = useActionState(forgotPasswordAction, null);

	if (state?.sent) {
		return (
			<div className="space-y-4 text-sm">
				<p>If that address has a staff login, we've emailed it a link to set a new password. The link expires in 30 minutes.</p>
				<a href="/login" className="text-uplink-red-800 underline-offset-2 hover:underline dark:text-uplink-red-400">
					Back to sign in
				</a>
			</div>
		);
	}

	return (
		<form action={action} className="space-y-4">
			<div>
				<label className="mb-1 block text-xs font-medium text-black/70 dark:text-white/70" htmlFor="email">
					Email
				</label>
				<input id="email" name="email" type="email" required autoComplete="username" className={FIELD} />
			</div>
			{state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
			<button
				type="submit"
				disabled={pending}
				className="w-full rounded-md bg-uplink-red-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-uplink-red-900 disabled:opacity-50"
			>
				{pending ? "Sending…" : "Email me a reset link"}
			</button>
			<p className="text-center text-xs">
				<a href="/login" className="text-black/60 underline-offset-2 hover:underline dark:text-white/60">
					Back to sign in
				</a>
			</p>
		</form>
	);
}
