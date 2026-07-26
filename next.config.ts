import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "169.254.83.107",
    "192.168.100.10",
  ],
};

export default nextConfig;
