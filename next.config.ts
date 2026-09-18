import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs/config";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
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
