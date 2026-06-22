import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	output: "standalone",
	poweredByHeader: false,
	experimental: {
		serverActions: {
			// Covers a single support attachment at the 25MB per-file cap plus
			// multipart overhead (Stage 1).
			bodySizeLimit: "60mb",
		},
		proxyClientMaxBodySize: "60mb",
	},
	async headers() {
		return [
			{
				source: "/:path*",
				headers: [
					{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
					{ key: "X-Frame-Options", value: "SAMEORIGIN" },
					{ key: "X-Content-Type-Options", value: "nosniff" },
					{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
					{ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
				],
			},
		];
	},
};

export default nextConfig;
