import { ExasolDriver, ExaWebsocket } from "@exasol/exasol-driver-ts";
import { WebSocket } from "ws";
import { nanoid } from "nanoid";

let driver: ExasolDriver | null = null;
let connecting: Promise<void> | null = null;

function createDriver() {
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

async function getDriver(): Promise<ExasolDriver> {
  if (driver) return driver;
  if (!connecting) {
    connecting = (async () => {
      const d = createDriver();
      await d.connect();
      driver = d;
    })();
  }
  await connecting;
  return driver!;
}

/** For SELECT queries. Returns rows. */
export async function query<T = Record<string, unknown>>(
  sql: string
): Promise<T[]> {
  const d = await getDriver();
  const result = await d.query(sql);
  return result.getRows() as T[];
}

/** For DDL and DML (CREATE, INSERT, UPDATE, DELETE). Returns nothing. */
export async function execute(sql: string): Promise<void> {
  const d = await getDriver();
  await d.execute(sql);
}

/** Alias for backwards compatibility. */
export const exec = execute;

export function newId(): string {
  return nanoid(24);
}

export function now(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}
