// backend/scripts/seed-identifiers.mjs
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not defined");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const ENTITY_A_ID = "cmu6ie8s70000gcunwemj0dqn"; // Rahul Kumar #1
const USER_ID = "cmu6hd96p0001f8un9rjv4dtu";

async function main() {
  // --- Identifier for Entity A ---
  const idA = await prisma.entityIdentifier.upsert({
    where: {
      entityId_type_value: {
        entityId: ENTITY_A_ID,
        type: "UPI",
        value: "rahul.kumar@okhdfcbank",
      },
    },
    update: {},
    create: {
      entityId: ENTITY_A_ID,
      type: "UPI",
      value: "rahul.kumar@okhdfcbank",
      rawValue: "rahul.kumar@okhdfcbank",
    },
  });
  console.log("Inserted identifier A:", idA);

  // --- Create Entity B (second Rahul Kumar) ---
  const entityB = await prisma.entity.create({
    data: {
      userId: USER_ID,
      name: "Rahul Kumar",
      type: "PERSON",
    },
  });
  console.log("Created Entity B:", entityB.id);

  // --- Identifier for Entity B ---
  const idB = await prisma.entityIdentifier.create({
    data: {
      entityId: entityB.id,
      type: "UPI",
      value: "rahul.k@ybl",
      rawValue: "rahul.k@ybl",
    },
  });
  console.log("Inserted identifier B:", idB);

  console.log("\n--- Summary ---");
  console.log("Entity A id:", ENTITY_A_ID);
  console.log("Entity B id:", entityB.id);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });