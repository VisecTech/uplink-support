"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { loginAction } from "./actions";

const FIELD =
	"block w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm focus:border-uplink-red-800 focus:outline-none dark:border-white/20 dark:bg-white/5";

export function LoginForm() {
	const router = useRouter();
	const [state, action, pending] = useActionState(loginAction, null);

	useEffect(() => {
		if (state?.ok) router.push("/inbox");
	}, [state, router]);

	return (
		<form action={action} className="space-y-4">
			<div>
				<label className="mb-1 block text-xs font-medium text-black/70 dark:text-white/70" htmlFor="email">
					Email
				</label>
				<input id="email" name="email" type="email" required autoComplete="username" className={FIELD} />
			</div>
			<div>
				<label className="mb-1 block text-xs font-medium text-black/70 dark:text-white/70" htmlFor="password">
					Password
				</label>
				<input id="password" name="password" type="password" required autoComplete="current-password" className={FIELD} />
			</div>
			{state?.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
			<button
				type="submit"
				disabled={pending}
				className="w-full rounded-md bg-uplink-red-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-uplink-red-900 disabled:opacity-50"
			>
				{pending ? "Signing in…" : "Sign in"}
			</button>
		</form>
	);
}
