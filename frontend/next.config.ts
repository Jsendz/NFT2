import type { NextConfig } from "next";

const nextConfig: NextConfig = {
   eslint: {
    ignoreDuringBuilds: true, // ✅ do not block production builds on ESLint errors
  },
  /* config options here */
};

export default nextConfig;
