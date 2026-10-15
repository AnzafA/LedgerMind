import "dotenv/config";
import fs from "fs";
import path from "path";
import { ExasolDriver, ExaWebsocket } from "@exasol/exasol-driver-ts";
import { WebSocket } from "ws";

function makeDriver() {
  return new ExasolDriver(
    (url: string) =>
      new WebSocket(url, { rejectUnauthorized: false }) as unknown as ExaWebsocket,
    {
      host: process.env.EXASOL_HOST || "127.0.0.1",
      port: parseInt(process.env.EXASOL_PORT || "8563"),
      user: process.env.EXASOL_USER || "sys",
      password: process.env.EXASOL_PASSWORD || "exasol",
    }
  );
}

async function main() {
  const sqlPath = path.join(process.cwd(), "db", "schema.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");

  const statements = sql.split(";").map((s) => s.trim()).filter((s) => s.length > 0);

  const driver = makeDriver();
  await driver.connect();

  for (const stmt of statements) {
    const preview = stmt.replace(/\s+/g, " ").slice(0, 80);
    console.log("> " + preview + "...");
    await driver.execute(stmt);
  }

  const result = await driver.query("SELECT TABLE_NAME FROM SYS.EXA_ALL_TABLES WHERE TABLE_SCHEMA = 'LEDGERMIND' ORDER BY TABLE_NAME");
  const rows = result.getRows();
  console.log("");
  console.log("Tables in LEDGERMIND schema (" + rows.length + "):");
  for (const row of rows) {
    console.log("  - " + row.TABLE_NAME);
  }

  await driver.close();
}

main().catch((e) => {
  console.error("Schema creation FAILED:", e);
  process.exit(1);
});
