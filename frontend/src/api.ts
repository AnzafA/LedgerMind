const API = "/api";

export interface EntitySummary {
  ID: string;
  NAME: string;
  IS_VERIFIED: boolean;
  SENT: string;
  RECEIVED: string;
  TX_COUNT: number;
  LAST_TX: string | null;
  IDENTIFIERS: string | null;
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
  try {
    const res = await fetch(`${API}/accounts`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.accounts ?? [];
  } catch {
    return [];
  }
}

export async function listEntities(accountId?: string): Promise<EntitySummary[]> {
  const url = accountId
    ? `${API}/entities?accountId=${encodeURIComponent(accountId)}`
    : `${API}/entities`;
    
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error("Server error");
    const data = await res.json();
    return data.entities ?? [];
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error("Request timed out. Check Exasol connection.");
    }
    throw err;
  }
}

export async function getEntity(id: string): Promise<EntityDetail> {
  try {
    const res = await fetch(`${API}/entities/${id}`);
    const text = await res.text();
    
    if (text.startsWith("<!DOCTYPE") || text.startsWith("<html")) {
      throw new Error("Server crashed. Check backend terminal.");
    }

    const data = JSON.parse(text);
    if (!res.ok) throw new Error(data.message || "Entity not found");
    return data;
  } catch (err: any) {
    throw new Error(err.message || "Network error");
  }
}

export async function verifyEntity(id: string): Promise<void> {
  await fetch(`${API}/entities/${id}/verify`, { method: "POST" });
}

export async function renameEntity(id: string, newName: string): Promise<void> {
  await fetch(`${API}/entities/${id}/rename`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: newName }),
  });
}

export async function mergeEntity(sourceId: string, targetId: string): Promise<void> {
  const res = await fetch(`${API}/entities/${sourceId}/merge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetId }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || "Merge failed");
}

export async function importStatement(file: File): Promise<ImportSummary> {
  const fd = new FormData();
  fd.append("file", file);
  
  try {
    const res = await fetch(`${API}/statements/import`, {
      method: "POST",
      body: fd,
    });
    
    const text = await res.text();
    if (!text) {
      throw new Error("The server crashed or restarted. Check the backend terminal.");
    }
    
    const data = JSON.parse(text);
    if (!data.success) throw new Error(data.message || "Import failed");
    return data.summary;
  } catch (err: any) {
    throw new Error(err.message || "Network error");
  }
} 