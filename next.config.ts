import type { NextConfig } from "next";

const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === "true";

const nextConfig: NextConfig = {
  // Static export for Cloudflare Pages / GitHub Pages
  ...(isStaticExport
    ? {
        output: "export",
        ...(process.env.CF_PAGES
          ? {}
          : { basePath: "/honestlabs", assetPrefix: "/honestlabs/" }),
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {
        serverExternalPackages: [
          "@prisma/client",
          "@prisma/adapter-better-sqlite3",
          "better-sqlite3",
        ],
        // Proxy /api/* to local API server in dev mode
        skipTrailingSlashRedirect: true,
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: "http://localhost:3099/api/:path*",
            },
          ];
        },
      }),
  turbopack: {},
};

export default nextConfig;
