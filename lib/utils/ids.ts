import { randomUUID } from "crypto";

export function createJobId(): string {
  return `job_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
}
