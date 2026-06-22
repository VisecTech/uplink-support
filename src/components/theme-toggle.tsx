"use client";
import type React from "react";

import { useEffect, useState } from "react";
import { type Theme, THEME_COOKIE, THEME_STORAGE_KEY } from "@/lib/theme";

const ONE_YEAR = 60 * 60 * 24 * 365;

function applyDark(theme: Theme) {
	const sys = window.matchMedia("(prefers-color-scheme: dark)").matches;
	const dark = theme === "dark" || (theme === "system" && sys);
	document.documentElement.classList.toggle("dark", dark);
}

function persist(theme: Theme) {
	try {
		if (theme === "system") localStorage.removeItem(THEME_STORAGE_KEY);
		else localStorage.setItem(THEME_STORAGE_KEY, theme);
		document.cookie =
			`${THEME_COOKIE}=${encodeURIComponent(theme)}; path=/; max-age=${ONE_YEAR}; SameSite=Lax`;
	} catch {
		// localStorage unavailable; cookie is best-effort
	}
}

export function ThemeToggle() {
	const [theme, setTheme] = useState<Theme>("system");

	// Read on mount (avoid SSR mismatch).
	useEffect(() => {
		try {
			const stored = localStorage.getItem(THEME_STORAGE_KEY);
			if (stored === "light" || stored === "dark") setTheme(stored);
			else setTheme("system");
		} catch {
			// keep default
		}
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => {
			// Re-apply if user is in 'system' mode
			const stored = localStorage.getItem(THEME_STORAGE_KEY);
			if (stored !== "light" && stored !== "dark") applyDark("system");
		};
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, []);

	const choose = (t: Theme) => {
		setTheme(t);
		persist(t);
		applyDark(t);
	};

	return (
		<div className="inline-flex items-center gap-0.5 border border-stone-200 dark:border-stone-700 rounded-md p-0.5 bg-white dark:bg-stone-900">
			<Btn label="Light" current={theme} value="light" onClick={choose} icon={SunIcon} />
			<Btn label="System" current={theme} value="system" onClick={choose} icon={SystemIcon} />
			<Btn label="Dark" current={theme} value="dark" onClick={choose} icon={MoonIcon} />
		</div>
	);
}

function Btn({
	label,
	current,
	value,
	onClick,
	icon: Icon,
}: {
	label: string;
	current: Theme;
	value: Theme;
	onClick: (t: Theme) => void;
	icon: () => React.JSX.Element;
}) {
	const active = current === value;
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			onClick={() => onClick(value)}
			className={`p-1.5 rounded transition-colors ${
				active
					? "bg-stone-100 dark:bg-stone-800 text-uplink-red-800 dark:text-uplink-red-700"
					: "text-stone-500 dark:text-stone-400 hover:text-uplink-ink dark:hover:text-uplink-cream"
			}`}
		>
			<Icon />
		</button>
	);
}

function SunIcon() {
	return (
		<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
			<title>Light</title>
			<circle cx="12" cy="12" r="4" />
			<path strokeLinecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
		</svg>
	);
}
function MoonIcon() {
	return (
		<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
			<title>Dark</title>
			<path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
		</svg>
	);
}
function SystemIcon() {
	return (
		<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
			<title>System</title>
			<rect x="3" y="4" width="18" height="12" rx="2" />
			<path strokeLinecap="round" d="M8 20h8M12 16v4" />
		</svg>
	);
}
