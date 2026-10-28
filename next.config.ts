import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
	// The dev badge would sit on the dock and the drawer's Save button.
	devIndicators: false,
};

export default nextConfig;

// Gives `next dev` the bindings from wrangler.jsonc, including a local D1.
initOpenNextCloudflareForDev();
