import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.189.26", "192.168.191.73", "192.168.123.127"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
