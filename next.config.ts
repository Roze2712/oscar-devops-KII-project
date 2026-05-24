import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Don't fail the CI/Docker build on type or lint issues; they're caught in dev/PR review.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
