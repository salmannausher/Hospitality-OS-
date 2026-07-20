import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The shared workspace packages ship raw TypeScript (main: src/index.ts);
  // Next transpiles them rather than expecting a prebuilt dist.
  transpilePackages: ["@hospitality/sdk", "@hospitality/types"],
};

export default nextConfig;
