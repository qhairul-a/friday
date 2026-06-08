import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["livekit-server-sdk"],
  webpack: (config) => {
    config.resolve.symlinks = false;
    return config;
  },
};

export default nextConfig;
