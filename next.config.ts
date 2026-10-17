import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.lathe3d.com" }],
        destination: "https://lathe3d.com/:path*",
        permanent: true,
      },
      // the default language (English) lives at the root
      { source: "/en", destination: "/", permanent: true },
      { source: "/en/view", destination: "/view", permanent: true },
    ];
  },
  async rewrites() {
    return [
      { source: "/", destination: "/en" },
      { source: "/view", destination: "/en/view" },
    ];
  },
};

export default nextConfig;
