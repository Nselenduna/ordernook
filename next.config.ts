import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root (a stray lockfile on the Desktop confuses inference).
  turbopack: {
    root: __dirname,
  },
  // Lets the phone (LAN IP) load HMR/dev assets instead of being blocked as cross-origin.
  allowedDevOrigins: ["192.168.0.10"],
  // sharp ships native bindings — keep it out of the server bundle, load at runtime.
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
