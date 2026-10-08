# Event Matching

## The Question

Given two TransactionRecords from different sources,
are they evidence of the SAME real-world FinancialEvent?

Example:
- Manual entry:  Rahul, ₹50,000, UPI, 15 Sept 10:32
- Bank record:   RAHUL KUMAR, ₹50,000 debit, 15 Sept 10:32

These are ONE FinancialEvent with TWO TransactionRecords.
They must NOT become two payments.

## Core Rules

1. **One FinancialEvent = one real-world payment.**
   A FinancialEvent may have many TransactionRecords
   (evidence from different sources).

2. **Never silently merge uncertain records.**
   Present candidates to the user; user confirms.

3. **Status reconciliation:**
   `FinancialEvent.status` is authoritative.
   `TransactionRecord.status` is raw evidence from one source.
   A source's claim (e.g. FAILED) never overwrites another source's
   claim (e.g. COMPLETED) silently.

4. **Failed / refunded / reversed must not double-count.**
   ₹50,000 failed + ₹50,000 successful retry ≠ ₹1,00,000 paid.
   The lifecycle must be represented explicitly.

## Signal Strength (strongest → weakest)

| Rank | Signal                                                        | Auto-merge? |
|------|---------------------------------------------------------------|-------------|
| 1    | Exact UPI transaction ID                                      | Yes         |
| 2    | Exact bank reference number                                   | Yes         |
| 3    | Amount + date + time + direction + account                    | Yes         |
| 4    | Amount + date + direction + counterparty identifier           | No — user   |
| 5    | Amount + date + direction + fuzzy counterparty name           | No — user   |

## Status Values

- `PENDING`
- `COMPLETED`
- `FAILED`
- `REFUNDED`
- `REVERSED`

## Data Model

- `FinancialEvent`    → the real-world payment
- `TransactionRecord` → one source's evidence of that payment
- `SourceType`        → MANUAL | BANK_STATEMENT | UPI | OTHER