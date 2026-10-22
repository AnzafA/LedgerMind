    # LedgerMind - Complete Setup & Run Guide

Follow these steps in exact order to run the LedgerMind application locally.

## Prerequisites
- Node.js (v18 or higher)
- Podman (for running Exasol Personal)
- Exasol Personal installed (`exakit` CLI available)

---

## Terminal 1: Start the Database (Exasol)
LedgerMind uses **Exasol Personal** as its high-performance analytical database. You must start the database before running the backend.

Open a terminal and run:
```bash
podman machine start
exakit start

exakit status
##(Wait until you see: Database 127.0.0.1:8563 - reachable)

