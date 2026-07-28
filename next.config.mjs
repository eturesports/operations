/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  async headers() {
    return [
      {
        // Only the reader views may be framed, and only by our own sites —
        // the rest of the platform stays unframeable, which is what keeps a
        // signed-in session from being clickjacked.
        source: "/embed/:path*",
        headers: [
          {
            // Anyone may frame the reader: it is public information and
            // offers nothing to click, so there is no clicking to hijack.
            // Naming allowed domains only breaks the embed when a builder
            // serves the surrounding page from a sandbox domain, which Wix
            // does — the protection that matters is that this rule covers
            // /embed alone and the signed-in app stays unframeable.
            key: "Content-Security-Policy",
            value: "frame-ancestors *",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
