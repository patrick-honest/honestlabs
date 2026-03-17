import type { NextConfig } from "next";

const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === "true";

const nextConfig: NextConfig = {
  // Static export for GitHub Pages
  ...(isStaticExport
    ? {
        output: "export",
        basePath: "/honestlabs",
        assetPrefix: "/honestlabs/",
        images: { unoptimized: true },
        // Trailing slashes help with static file resolution on GH Pages
        trailingSlash: true,
      }
    : {
        serverExternalPackages: [
          "@prisma/client",
          "@prisma/adapter-better-sqlite3",
          "better-sqlite3",
        ],
      }),
  turbopack: {},
};

export default nextConfig;
