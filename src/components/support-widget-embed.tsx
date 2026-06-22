"use client";

import Script from "next/script";

/**
 * Loads the embeddable support widget (the KB-grounded deflection bot + "talk to
 * a human") on the support site's own public pages. Same one-liner product sites
 * use, just self-hosted here. data-product scopes the KB grounding.
 */
export function SupportWidgetEmbed({ product = "general" }: { product?: string }) {
	return <Script src="/support-widget.js" data-product={product} strategy="lazyOnload" />;
}
