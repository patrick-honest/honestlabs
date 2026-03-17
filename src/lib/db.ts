/**
 * Prisma client with better-sqlite3 adapter.
 *
 * In demo mode or when the native module isn't available (e.g. Vercel serverless),
 * prisma will be null and API routes should handle that gracefully.
 */

let prismaInstance: unknown | null = null;

try {
  // Dynamic require so the build doesn't hard-fail when better-sqlite3 isn't available
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient } = require("@/generated/prisma/client");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path");

  const globalForPrisma = globalThis as unknown as {
    prisma: typeof PrismaClient | undefined;
  };

  if (!globalForPrisma.prisma) {
    const dbPath =
      process.env.DATABASE_URL?.replace("file:", "") ||
      path.join(process.cwd(), "prisma", "dev.db");
    const adapter = new PrismaBetterSqlite3({ url: dbPath });
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }

  prismaInstance = globalForPrisma.prisma;
} catch {
  // Native module not available — running in demo/serverless mode
  prismaInstance = null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const prisma = prismaInstance as any;
