mkdir src\db -Force

$exasolClient = @'
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

export async function exec(sql: string): Promise<void> {
  const d = await getDriver();
  await d.query(sql);
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const d = await getDriver();
  const result = params.length > 0
    ? await d.query(sql, params)
    : await d.query(sql);
  return result.getRows() as T[];
}

export function newId(): string {
  return nanoid(24);
}

export function now(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}
'@

Set-Content -Path "src\db\exasol.ts" -Value $exasolClient -Encoding UTF8 -Force
Write-Host "exasol.ts written. Size:" (Get-Item "src\db\exasol.ts").Length