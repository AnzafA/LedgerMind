const API = "/api";

export interface EntitySummary {
  ID: string;
  NAME: string;
  IS_VERIFIED: boolean;
  SENT: string;
  RECEIVED: string;
  TX_COUNT: number;
  LAST_TX: string | null;
}

export interface EntityDetail {
  entity: { ID: string; NAME: string; IS_VERIFIED: boolean };
  totals: { SENT: string; RECEIVED: string; TX_COUNT: number };
  transactions: {
    ID: string;
    AMOUNT: string;
    DIRECTION: "DEBIT" | "CREDIT";
    OCCURRED_AT: string;
    DESCRIPTION: string;
  }[];
  identifiers: { IDENTIFIER_TYPE: string; IDENTIFIER_VALUE: string }[];
}

export interface ImportSummary {
  importId: string;
  parserId: string;
  accountId: string;
  accountCreated: boolean;
  totalTransactions: number;
  importedCount: number;
  skippedSelfTransfers: number;
  skippedBankCharges: number;
  entitiesCreated: number;
  entitiesMatched: number;
  reconciles: boolean;
  openingBalance?: number;
  closingBalance?: number;
}

export interface Account {
  ID: string;
  NAME: string;
  BANK_NAME: string | null;
  ACCOUNT_LAST4: string | null;
  ACCOUNT_TYPE: string;
}

export async function listAccounts(): Promise<Account[]> {
  const res = await fetch(`${API}/accounts`);
  const data = await res.json();
  return data.accounts ?? [];
}

export async function listEntities(accountId?: string): Promise<EntitySummary[]> {
  const url = accountId
    ? `${API}/entities?accountId=${encodeURIComponent(accountId)}`
    : `${API}/entities`;
  const res = await fetch(url);
  const data = await res.json();
  return data.entities ?? [];
}

export async function getEntity(id: string): Promise<EntityDetail> {
  const res = await fetch(`${API}/entities/${id}`);
  if (!res.ok) throw new Error("Entity not found");
  return res.json();
}

export async function verifyEntity(id: string): Promise<void> {
  await fetch(`${API}/entities/${id}/verify`, { method: "POST" });
}

export async function importStatement(file: File): Promise<ImportSummary> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API}/statements/import`, {
    method: "POST",
    body: fd,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || "Import failed");
  return data.summary;
}