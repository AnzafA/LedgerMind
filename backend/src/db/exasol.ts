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

// --- THE QUEUE (Prevents Pool Limit Crashes) ---
let isProcessing = false;
type QueueItem = { type: "query" | "execute"; sql: string; resolve: any; reject: any };
const queue: QueueItem[] = [];

async function processQueue() {
  if (isProcessing || queue.length === 0) return;
  isProcessing = true;
  
  const item = queue.shift()!;
  try {
    const d = await getDriver();
    if (item.type === "query") {
      const result = await d.query(item.sql);
      item.resolve(result.getRows());
    } else {
      await d.execute(item.sql);
      item.resolve();
    }
  } catch (err) {
    item.reject(err);
  } finally {
    isProcessing = false;
    processQueue(); // Process next item in queue
  }
}

export async function query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    queue.push({ type: "query", sql, resolve, reject });
    processQueue();
  });
}

export async function execute(sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    queue.push({ type: "execute", sql, resolve, reject });
    processQueue();
  });
}
// ------------------------------------------------

export function newId(): string {
  return nanoid(24);
}

export function now(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}