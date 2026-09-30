import { randomUUID } from "node:crypto";

export interface Account {
  username: string;
  email: string;
  password: string;
}

/**
 * A username no other test, worker or previous run can share: tests that own
 * their user cannot depend on execution order or collide under parallelism.
 */
export function uniqueAccount(): Account {
  const username = `qa_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  return {
    username,
    email: `${username}@example.com`,
    password: "Probe-pass-123",
  };
}
