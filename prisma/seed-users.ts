import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "prisma", "dev.db");
const adapter = new PrismaBetterSqlite3({ url: dbPath });
const prisma = new PrismaClient({ adapter });

const USERS = [
  "voita@honestbank.com",
  "andrew@honestbank.com",
  "peter@honestbank.com",
  "will@honestbank.com",
  "nimish@honestbank.com",
  "ed@honestbank.com",
  "darwin@honestbank.com",
  "caitlyn@honestbank.com",
  "meta@honestbank.com",
  "love@honestbank.com",
  "ray@honestbank.com",
  "malik@honestbank.com",
  "panji@honestbank.com",
  "candy@honestbank.com",
  "george@honestbank.com",
];

async function main() {
  for (const email of USERS) {
    const name = email.split("@")[0].charAt(0).toUpperCase() + email.split("@")[0].slice(1);
    await prisma.appUser.upsert({
      where: { email },
      update: {
        status: "active",
        pages: JSON.stringify(["/orico"]),
      },
      create: {
        email,
        name,
        role: "viewer",
        pages: JSON.stringify(["/orico"]),
        invitedBy: "patrick@honestbank.com",
        status: "active",
      },
    });
    console.log(`✓ ${email} (${name})`);
  }
  console.log(`\nSeeded ${USERS.length} users.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
