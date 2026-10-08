// backend/src/parsers/reconcile.ts

import { ParseResult } from "./types";

export interface ReconcileResult {
  ok: boolean;
  openingBalance?: number;
  closingBalance?: number;
  computedClosing?: number;
  difference?: number;
  credits: number;
  debits: number;
  message: string;
}

export function reconcile(result: ParseResult): ReconcileResult {
  const { openingBalance, closingBalance } = result.accountInfo;

  let credits = 0;
  let debits = 0;
  for (const tx of result.transactions) {
    if (tx.direction === "CREDIT") credits += tx.amount;
    else debits += tx.amount;
  }

  if (openingBalance === undefined || closingBalance === undefined) {
    return {
      ok: false,
      credits,
      debits,
      message: "Missing opening or closing balance — cannot reconcile",
    };
  }

  const computedClosing = openingBalance + credits - debits;
  const difference = computedClosing - closingBalance;

  if (Math.abs(difference) < 0.01) {
    return {
      ok: true,
      openingBalance,
      closingBalance,
      computedClosing,
      difference,
      credits,
      debits,
      message: "✓ Reconciled",
    };
  }

  return {
    ok: false,
    openingBalance,
    closingBalance,
    computedClosing,
    difference,
    credits,
    debits,
    message: `✗ Reconciliation failed: computed ${computedClosing.toFixed(2)} vs expected ${closingBalance.toFixed(2)} (diff ${difference.toFixed(2)})`,
  };
}