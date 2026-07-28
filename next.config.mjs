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
            // The season a visitor picks makes this page dynamic, so the CDN
            // is what keeps a busy marketing page off the database.
            key: "Cache-Control",
            value: "public, s-maxage=300, stale-while-revalidate=3600",
          },
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://eturesports.com https://*.eturesports.com https://*.wixsite.com https://*.wix.com https://*.editorx.io https://*.wixstudio.io https://*.wixstudio.com",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
