import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/tasks",         destination: "/things-to-do", permanent: true },
      { source: "/tasks/archive", destination: "/things-to-do", permanent: true },
    ];
  },
};

export default nextConfig;
