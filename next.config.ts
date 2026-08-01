import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: "/brady-budget",
        destination: "/budget",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
