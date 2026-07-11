import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root (a stray lockfile on the Desktop confuses inference).
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
