import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs/config";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Dev-only: allow browsers on the LAN (e.g. a second device reaching
  // 192.168.1.102) to load HMR + JS chunks. Without this, Next blocks those
  // cross-origin requests and the page hydrates with no JS at all — which
  // kills every client interaction (theme toggle stays invisible, Google
  // button dead). Dev-only option; production behavior is unaffected.
  allowedDevOrigins: ["192.168.1.102"],
  async redirects() {
    return [
      {
        source: "/login",
        destination: "/auth/login",
        permanent: false,
      },
    ];
  },
  experimental: {
    serverActions: {
      // Template create/update actions send the bundled HTML (with inlined
      // CSS/JS) plus a base64 preview image in one payload, which regularly
      // exceeds the 1MB default and fails with "Body exceeded 1 MB limit".
      bodySizeLimit: "10mb",
    },
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
});
