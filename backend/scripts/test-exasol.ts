import "dotenv/config";
import { ExasolDriver, ExaWebsocket } from "@exasol/exasol-driver-ts";
import { WebSocket } from "ws";

async function main() {
  const driver = new ExasolDriver(
    (url: string) =>
      new WebSocket(url, {
        rejectUnauthorized: false,
      }) as unknown as ExaWebsocket,
    {
      host: "127.0.0.1",
      port: 8563,
      user: "sys",
      password: "exasol",
    }
  );

  console.log("Connecting to Exasol...");
  await driver.connect();
  console.log("Connected.");

  const result = await driver.query("SELECT 1 AS PING");
  console.log("Exasol connection OK:", result.getRows());

  await driver.close();
}

main().catch((e) => {
  console.error("Exasol connection FAILED:", e);
  process.exit(1);
});