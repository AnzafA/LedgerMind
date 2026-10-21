# LedgerMind

**A financial memory system that remembers everyone you've paid.**

Built for the ExaThon India 2026 (Track 01: Money, Risk & Regulation).

## The Problem
Bank statements are messy. A single person might appear as `RAHUL K`, `RAHUL KUMAR`, and `rahulk@oksbi`. Worse, two different people might share the exact same name. Traditional expense trackers silently merge them, corrupting your financial history. 

## The Solution
LedgerMind is an **identifier-first** financial ledger. It parses bank statements, extracts structured identifiers (UPI handles, account numbers, phone numbers), and groups transactions into real-world entities. 

When it encounters an ambiguity (like two "Rahul Kumars"), it uses identifiers to tell them apart. If it cannot be sure, it asks the user. Once confirmed, it remembers forever.

**Core Philosophy:** `Reconciliation is king.` If `Opening Balance + Credits - Debits != Closing Balance` (to the exact paisa), the import is rejected. No silent AI hallucinations.

## Demo Scenario
1. Upload an Indian Bank CSV statement (8 months, 172 transactions).
2. LedgerMind reconciles the entire file mathematically (Diff: ₹0.00).
3. It extracts 19 distinct counterparties.
4. It correctly distinguishes two different people named "Rahul Kumar" using their different UPI handles, displaying them as separate entities without merging their totals.

## Tech Stack
- **Frontend:** React, TypeScript, Tailwind CSS, Vite
- **Backend:** Node.js, Express, TypeScript
- **Database:** **Exasol Personal** (used as the primary analytical data store)
- **Data Ingestion:** Deterministic rule-based parser (no LLM for core math)

## Prerequisites
- Node.js (v18+)
- Docker / Podman (for Exasol Personal)
- Exasol Personal installed locally (`exakit` CLI available)

## Setup & Run Guide

### 1. Start Exasol Personal
Ensure your local Exasol database is running:
```bash
podman machine start
exakit start
exakit status # Should show "Database 127.0.0.1:8563 - reachable"