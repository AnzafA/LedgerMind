# Entity Resolution

## The Question

Given a name, alias, or identifier seen in a transaction,
which real-world Entity (person/business) does it belong to?

## Core Rules

1. **Identifier-first, name-second.**
   Identifiers (UPI handle, account number, phone, email) are
   strong evidence. Names are weak evidence.

2. **Identifier conflict = different entities.**
   If two records share a name but have conflicting identifiers
   (e.g. different UPI handles, different account numbers),
   they are different entities. Never merge.

3. **Name-only matching is never auto-merged.**
   If a transaction has only a name and no identifier,
   the matcher must present candidates to the user.
   The user decides.

4. **User decisions are permanent memory.**
   Once a user confirms SAME or NOT_SAME, the matcher must
   honour that decision on every future match of that alias.

5. **Never silently merge.**
   If the matcher is not confident, it must return candidates
   with a REVIEW option, not guess.

## Signal Strength (strongest → weakest)

| Rank | Signal                                                | Auto-merge? |
|------|-------------------------------------------------------|-------------|
| 1    | Same UPI handle                                       | Yes         |
| 2    | Same counterparty account number + IFSC               | Yes         |
| 3    | Same phone number                                     | Yes         |
| 4    | Same email                                            | Yes         |
| 5    | Phonetic name match + same IFSC                       | No — user   |
| 6    | Name token subset ("P Kumar" ⊂ "Pankaj Kumar") + same bank | No — user |
| 7    | Fuzzy name match (Levenshtein / Jaro)                 | No — user   |

## Decisions

- `SAME`     → user confirmed this alias belongs to this entity
- `NOT_SAME` → user confirmed this alias does NOT belong to this entity
- `REVIEW`   → user marked unresolved; not a final answer

`SAME` and `NOT_SAME` are permanent.
`REVIEW` may be re-surfaced later.

## Data Model

- `Entity`             → the real-world person/business
- `EntityAlias`        → raw name variants seen in text
- `EntityIdentifier`   → structured identifiers (UPI, account, phone, ...)
- `EntityMatchDecision`→ user's SAME / NOT_SAME / REVIEW for an alias