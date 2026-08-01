import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: "/brady-budget",
        destination: "/brady-budget/index.html",
      },
      {
        source: "/brady-budget/",
        destination: "/brady-budget/index.html",
      },
    ];
  },
};

export default nextConfig;
