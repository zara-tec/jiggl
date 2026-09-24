import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained build for the container image (see Dockerfile).
  output: "standalone",
};

export default nextConfig;
