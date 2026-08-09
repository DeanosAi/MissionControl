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
      {
        source: "/one-leaderboard",
        destination: "http://one-leaderboard:4173/",
      },
      {
        source: "/one-leaderboard/:path*",
        destination: "http://one-leaderboard:4173/:path*",
      },
    ];
  },
};

export default nextConfig;
