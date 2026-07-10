// server/domain/ids.ts — ULID generation
// ULIDs: 26-char, lexically time-ordered, no autoincrement contention (DATA_SCHEMA §1)

import { ulid as _ulid } from "ulid";

/** Generate a new ULID string */
export function ulid(): string {
  return _ulid();
}
