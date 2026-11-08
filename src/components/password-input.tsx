"use client";

import { useState } from "react";

/**
 * Password field with a show/hide eye. The button is type="button" so it never
 * submits the form, and it is a real <button> with an aria-label + aria-pressed
 * so a screen reader announces the state.
 */
export function PasswordInput({
	id,
	name,
	autoComplete,
	className,
	minLength,
}: {
	id: string;
	name: string;
	autoComplete: "current-password" | "new-password";
	className: string;
	minLength?: number;
}) {
	const [shown, setShown] = useState(false);
	return (
		<div className="relative">
			<input
				id={id}
				name={name}
				type={shown ? "text" : "password"}
				required
				minLength={minLength}
				autoComplete={autoComplete}
				className={`${className} pr-10`}
			/>
			<button
				type="button"
				onClick={() => setShown((s) => !s)}
				aria-label={shown ? "Hide password" : "Show password"}
				aria-pressed={shown}
				className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-black/50 hover:text-black/80 dark:text-white/50 dark:hover:text-white/80"
			>
				{shown ? (
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
						<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
						<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
						<path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
						<line x1="1" y1="1" x2="23" y2="23" />
					</svg>
				) : (
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
						<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
						<circle cx="12" cy="12" r="3" />
					</svg>
				)}
			</button>
		</div>
	);
}
