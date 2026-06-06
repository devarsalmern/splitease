---
name: Orval schema naming conventions
description: How Orval names generated Zod schemas and TypeScript types from OpenAPI operations
---

Orval generates Zod schema names based on the **operation name + parameter role**, not the schema name in `components/schemas`. Key rules:

- Request bodies → `<OperationName>Body` (e.g. `RegisterBody`, `LoginBody`, `CreateGroupBody`, `CreateExpenseBody`)
- URL params → `<OperationName>Params`
- Responses → `<OperationName>Response` or `<OperationName>ResponseItem` (for arrays)

**Why:** The server routes imported schemas named `RegisterInput`, `LoginInput`, `ExpenseInput`, etc. — all wrong. Correct names are `RegisterBody`, `LoginBody`, `CreateExpenseBody`, etc. This caused 15 TS2693 errors ("only refers to a type") until fixed.

**How to apply:** Before using any schema from `@workspace/api-zod`, grep the generated file:
```
grep "^export const" lib/api-zod/src/generated/api.ts
```
Never guess — the names are always derived from operation IDs in the OpenAPI spec.
