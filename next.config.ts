import type { NextConfig } from "next";

// Sent with every response. A full Content-Security-Policy is left out on
// purpose: Next's own inline scripts and the theme script would need nonces,
// and routes like /api/avatar set their own stricter policy.
const securityHeaders = [
  // Don't let other sites show the app in a frame (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Browsers must trust the declared content type, not guess it.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Links out (e.g. a Foundry or Discord URL in a session) only reveal the
  // site, never the page they were clicked on.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app never uses these; deny them outright.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework in every response.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
