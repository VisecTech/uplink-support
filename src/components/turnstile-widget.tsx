"use client";

import Script from "next/script";

/**
 * Cloudflare Turnstile widget. Renders only when NEXT_PUBLIC_TURNSTILE_SITE_KEY
 * is set (graceful no-op otherwise). CF auto-render injects a hidden input named
 * `cf-turnstile-response` that the form action reads.
 */
export function TurnstileWidget() {
	const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
	if (!siteKey) return null;
	return (
		<div>
			<Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
			<div className="cf-turnstile" data-sitekey={siteKey} data-theme="auto" />
		</div>
	);
}
