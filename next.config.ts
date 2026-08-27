import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/rooms/one-bed", destination: "/rooms/single-bed", permanent: true },
      { source: "/rooms/two-bed", destination: "/rooms/double-bed", permanent: true },
    ];
  },
};

export default nextConfig;
