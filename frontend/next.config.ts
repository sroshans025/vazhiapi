import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output only for the Docker image; Vercel uses its own output.
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" as const } : {}),
};

export default nextConfig;
