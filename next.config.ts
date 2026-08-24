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
    ];
  },
};

export default nextConfig;
