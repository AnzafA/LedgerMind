# LedgerMind

**A financial memory system that remembers everyone you've paid.**

Built for the ExaThon India 2026 (Track 01: Money, Risk & Regulation).

## The Problem
Bank statements are messy. If you want to know how much you paid a supplier, you have to deal with missing names, truncated UPI handles, and worst of all—two different people with the exact same name. Traditional expense trackers silently merge them, corrupting your financial history.

Furthermore, extracting data from PDFs usually results in missed rows, incorrect debit/credit assignments, and silent data loss. In financial software, a 95% accuracy rate is a liability.

## The Solution: LedgerMind
LedgerMind is an **identifier-first** financial ledger. It parses bank statements (PDF or CSV), extracts structured identifiers (UPI handles, account numbers, phone numbers), and groups transactions into real-world entities. 

**Core Philosophy:** `Reconciliation is king.` 
If `Opening Balance + Credits - Debits ≠ Closing Balance` (to the exact paisa), the import is rejected. We do not guess. If a transaction is ambiguous (e.g., the bank didn't print a name), we flag it for the user rather than silently dropping the money.

## Key Features
- **Multi-Format Ingestion:** Accepts both PDF and CSV bank statements.
- **Deterministic Reconciliation:** Mathematically proves the file is complete before writing to the database.
- **Entity Resolution (The "Two Rahuls" Problem):** Distinguishes between people with identical names using UPI handles and account numbers.
- **Financial Memory:** Users can merge duplicate entities and verify names. The system remembers this choice forever using an alias mapping table.
- **Professional Export:** Generates clean, mathematically reconciled PDF statements for any counterparty.
- **Exasol-Powered:** Uses Exasol Personal for high-performance columnar aggregation, ensuring dashboard queries and filters are instant.

## Architecture & Scalability
The core philosophy of LedgerMind is that **parsing is isolated, but reconciliation is universal.** 

Our current parser is highly optimized for Indian Bank PDFs and CSVs. However, the architecture is designed for immediate scale:
- **Pluggable Adapters:** The PDF extraction logic is completely isolated from the database layer. Adding a new bank (like HDFC or SBI) next week is as simple as writing a new regex adapter.
- **Immutable Core:** The core Exasol reconciliation engine, entity resolution logic, and financial memory system remain 100% untouched when a new bank is added.
- **Deterministic Math:** Regardless of the bank format, if the math doesn't perfectly balance, the file is rejected. 

We deliberately kept the hackathon MVP focused on Indian Bank to guarantee mathematical perfection, knowing that the underlying pipeline can handle any structured format.

## Tech Stack
- **Frontend:** React, TypeScript, Tailwind CSS, Vite (Charting via Recharts)
- **Backend:** Node.js, Express, TypeScript, `unpdf` (PDF extraction)
- **Database:** **Exasol Personal** (Primary analytical data platform)

## Setup & Run Guide

### Prerequisites
- Node.js (v18+)
- Podman (for Exasol Personal)

### 1. Start Exasol Personal
Ensure your local Exasol database is running:
```bash
podman machine start
exakit start
exakit status # Should show "Database 127.0.0.1:8563 - reachable"