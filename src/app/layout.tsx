/**
 * Root layout — support.uplink.net.au (standalone).
 *
 * Host-gated to SUPPORT_HOSTS (defence in depth behind nginx). Uplink-branded
 * chrome — NOT the Counter storefront layout, so no "Shopkit" bleed. This is the
 * fix that motivated the standalone rebuild.
 */
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

const ALLOWED_HOSTS: readonly string[] = (process.env.SUPPORT_HOSTS ?? "support.uplink.net.au")
	.split(",")
	.map((s) => s.trim().toLowerCase())
	.filter(Boolean);

const SITE_URL = (process.env.SUPPORT_SITE_URL ?? "https://support.uplink.net.au").replace(/\/$/, "");

export const metadata: Metadata = {
	metadataBase: new URL(SITE_URL),
	title: {
		template: "%s · Uplink Support",
		default: "Uplink Web Services — Support",
	},
	description:
		"Get help with your Uplink Web Services products — hosting, Shopkit stores, WPresskit sites, domains and billing.",
	icons: { icon: [{ url: "/uplink-mark.svg", type: "image/svg+xml" }] },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
	// Host-gate: in dev (no nginx) allow localhost; in prod only the allowed hosts.
	const h = await headers();
	const host = (h.get("host") ?? "").split(":")[0].toLowerCase();
	const isLocal = host === "127.0.0.1" || host === "localhost" || host === "";
	if (!isLocal && !ALLOWED_HOSTS.includes(host)) {
		notFound();
	}

	return (
		<html lang="en-AU" suppressHydrationWarning>
			<head>
				{/* eslint-disable-next-line @next/next/no-sync-scripts */}
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: standard no-FOUC init pattern
					dangerouslySetInnerHTML={{ __html: themeInitScript }}
				/>
			</head>
			<body className="min-h-screen bg-uplink-cream text-uplink-ink antialiased">
				{children}
			</body>
		</html>
	);
}
