const { PrismaClient } = require("@prisma/client");
const { syncLocationLookups } = require("./location-lookups.cjs");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for location lookup synchronization");
}

const prisma = new PrismaClient();

syncLocationLookups(prisma)
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
