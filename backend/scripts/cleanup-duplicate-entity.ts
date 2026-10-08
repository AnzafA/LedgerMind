import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const duplicateId = "cmuz58hi000018gun9oyk7s9g";
  await prisma.entity.delete({ where: { id: duplicateId } });
  console.log("Deleted duplicate entity:", duplicateId);

  const remaining = await prisma.entity.findMany({
    where: { userId: "cmu6hd96p0001f8un9rjv4dtu" },
    include: { identifiers: true },
  });
  console.log("\nRemaining entities:");
  for (const e of remaining) {
    console.log(`  ${e.id}  ${e.name}  ids=${e.identifiers.length}`);
  }
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});