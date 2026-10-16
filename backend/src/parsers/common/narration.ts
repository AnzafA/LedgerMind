// backend/src/parsers/common/narration.ts

export type NarrationMode =
  | "UPI" | "NEFT" | "RTGS" | "IMPS"
  | "SWEEP" | "BILLDESK" | "PAYTM"
  | "CASH" | "INTEREST" | "CHARGE" | "OTHER";

export interface NarrationFields {
  mode: NarrationMode;
  counterpartyName: string | null;
  counterpartyAccount: string | null;
  counterpartyPhone: string | null;
  bankCode: string | null;
  reference: string | null;
  isSelfTransfer: boolean;
  isBankCharge: boolean;
}

const KNOWN_BANK_CODES = new Set([
  "HDFC","SBIN","ICIC","BKID","BARB","UTIB","IDIB","YESB","PUNB","UBIN",
  "CNRB","IOBA","ALLA","MAHB","ANDB","IDFB","KKBK","KARB","UCBA","FDRL",
  "RATN","SRCB","CORP","NESF","INDB","AIRP",
]);

function normalName(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ")
    .trim();
}

export function extractNarration(
  raw: string,
  accountHolderName?: string
): NarrationFields {
  const desc = raw.trim();

  const result: NarrationFields = {
    mode: "OTHER",
    counterpartyName: null,
    counterpartyAccount: null,
    counterpartyPhone: null,
    bankCode: null,
    reference: null,
    isSelfTransfer: false,
    isBankCharge: false,
  };

  // --- 1. Bank charges and interest ---
  if (/^CREDIT INTEREST$/i.test(desc)) {
    result.mode = "INTEREST";
    result.isBankCharge = true;
    return result;
  }

  // --- 2. Self-transfers (SWEEP) ---
  const isSweep =
    /\bSWEEP\s+(FROM|TO)\b/i.test(desc) ||
    /\bDEBIT SWEEP\b/i.test(desc) ||
    /\/SWEEP FROM\b/i.test(desc);
  if (isSweep) {
    result.mode = "SWEEP";
    result.isSelfTransfer = true;
    const acct = desc.match(/SWEEP\s+(?:FROM|TO)\s+(\d{6,})/i);
    if (acct) result.counterpartyAccount = acct[1];
    return result;
  }

  // --- 3. BillDesk ---
  if (/BILL\s*DESK|BILLDESK/i.test(desc)) {
    result.mode = "BILLDESK";
    result.counterpartyName = "BillDesk";
    const ref = desc.match(/(YINB\d+|[A-Z]{4,6}\d{10,})/);
    if (ref) result.reference = ref[1];
    const acct = desc.match(/TRANSFER TO\s+(\d{6,})/i);
    if (acct) result.counterpartyAccount = acct[1];
    return result;
  }

  // --- 4. Mode detection ---
  if (/\bUPI\b/i.test(desc)) result.mode = "UPI";
  else if (/\bIMPS\b/i.test(desc)) result.mode = "IMPS";
  else if (/\bNEFT\b/i.test(desc)) result.mode = "NEFT";
  else if (/\bRTGS\b/i.test(desc)) result.mode = "RTGS";
  else if (/\bPAYTM-/i.test(desc)) result.mode = "PAYTM";
  else if (/Mobile\//i.test(desc)) result.mode = "IMPS";

  // --- 5. Bank code ---
  const bankMatch =
    desc.match(/(?:NEFT|RTGS|IMPS)\s*\/\s*([A-Z]{4})\b/i) ||
    desc.match(/\/([A-Z]{4})\//);
  if (bankMatch) {
    const code = bankMatch[1].toUpperCase();
    if (KNOWN_BANK_CODES.has(code)) result.bankCode = code;
  }

  // --- 6. Reference number ---
  const refMatch =
    desc.match(/\b([A-Z]{4,6}\d{10,})\b/) ||
    desc.match(/PAYTM-([A-Z0-9]+)/i);
  if (refMatch) result.reference = refMatch[1];

  // --- 7. Phone ---
  // Mobile/XXXX in IMPS rows is the SENDER's device phone, not counterparty.
  const phoneMatch = desc.match(/(?:Payee|Beneficiary)\s*\/?\s*Mobile\/(\d{10})/i);
  if (phoneMatch) result.counterpartyPhone = phoneMatch[1];

  // --- 8. Counterparty account number ---
  if (!result.counterpartyAccount) {
    const toAcct = desc.match(/TRANSFER TO\s+(\d{6,})/i);
    if (toAcct) result.counterpartyAccount = toAcct[1];
  }
  if (!result.counterpartyAccount) {
    const fromAcct = desc.match(/TRANSFER FROM\s+(\d{6,})/i);
    if (fromAcct) result.counterpartyAccount = fromAcct[1];
  }
  if (!result.counterpartyAccount) {
    const imps = desc.match(/(?:IMPS|UPI)\/P2[AM]\/\d+\/(\d{6,})\//i);
    if (imps) result.counterpartyAccount = imps[1];
  }

  // --- 9. Counterparty name ---
  // 9a. NAME /TRANSFER TO ...
  const beforeTransfer = desc.match(
    /^([A-Za-z][A-Za-z0-9&.,' \-/]{2,80}?)\s*\/TRANSFER TO/i
  );
  if (beforeTransfer) {
    const cleaned = beforeTransfer[1].replace(/\s+/g, " ").trim();
    if (!/^(Tax|Bill Desk|BillDesk|BRANCH|SWEEP)/i.test(cleaned)) {
      result.counterpartyName = cleaned;
    }
  }

  // 9b. TRANSFER TO <acct> [/]<NAME>
  if (!result.counterpartyName) {
    const afterAcct = desc.match(
      /TRANSFER TO\s+\d{6,}\s*\/?\s*([A-Za-z][A-Za-z0-9&.,' \-]{2,60}?)(?:\s*\/|\s+Mobile|\s*$)/i
    );
    if (afterAcct) {
      const name = afterAcct[1].replace(/\s+/g, " ").trim();
      if (
        name.length > 2 &&
        !/^(Tax|BRANCH|SWEEP|Bill Desk|BillDesk)/i.test(name)
      ) {
        result.counterpartyName = name;
      }
    }
  }

  // 9c. NEFT/RTGS ref
  if (!result.counterpartyName) {
    const afterRef = desc.match(
      /(?:NEFT|RTGS)\/[A-Z]{4}\/[A-Z0-9 ]+\/([A-Za-z][A-Za-z0-9 .]+?)\s*\//
    );
    if (afterRef) {
      const name = afterRef[1].replace(/\s+/g, " ").trim();
      if (name.length > 1) result.counterpartyName = name;
    }
  }

  // 9d. Paytm merchant
  if (!result.counterpartyName) {
    const paytm = desc.match(/PAYTM-[A-Z0-9]+\/([A-Za-z][A-Za-z0-9 .]+?)\//i);
    if (paytm) {
      const name = paytm[1].replace(/\s+/g, " ").trim();
      if (name.length > 2) result.counterpartyName = name;
    }
  }

  // --- 10. Self-transfer via account holder name ---
  if (!result.isSelfTransfer && accountHolderName) {
    const holderTokens = normalName(accountHolderName)
      .split(" ")
      .filter((t) => t.length > 2);
    const descNorm = normalName(desc);
    const matches = holderTokens.filter((t) => descNorm.includes(t));
    if (matches.length >= 1 && /\bSWEEP\b|OWN|SELF/i.test(desc)) {
      result.isSelfTransfer = true;
      result.mode = "SWEEP";
    }
  }
    // 11a. Reject noise names (amount text, charges, etc.)
  if (result.counterpartyName) {
    const upper = result.counterpartyName.toUpperCase();
    if (
      /^TXN AMT\./.test(upper) ||
      /^CHARGES/.test(upper) ||
      /^TXN\s/.test(upper) ||
      /^\d+$/.test(upper.replace(/\s/g, ""))
    ) {
      result.counterpartyName = null;
    }
  }
  // --- 11. Title case the name ---
  if (result.counterpartyName) {
    const trimmed = result.counterpartyName.replace(/[\/,.\s]+$/, "").trim();
    if (trimmed.length < 2 || /^\d+$/.test(trimmed)) {
      result.counterpartyName = null;
    } else {
      result.counterpartyName = toTitleCase(trimmed);
    }
  }

  return result;
}
