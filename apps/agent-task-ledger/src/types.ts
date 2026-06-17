import * as crypto from "crypto";

export type AgentName = "FORGE" | "SENTINEL" | "LEDGE" | "OPERATOR";
export type TaskStatus = "pending" | "in_progress" | "completed" | "rejected";
export type LedgerEntryType =
  | "TASK_CREATED"
  | "TASK_ASSIGNED"
  | "TASK_COMPLETED"
  | "TASK_REJECTED"
  | "ACTION_SEALED"
  | "BREACH"
  | "DUPLICATE"
  | "REJECTED"
  | "CHECKPOINT";

export interface Task {
  id: string;
  title: string;
  description: string;
  assignee: AgentName;
  status: TaskStatus;
  created_at: string;
  completed_at: string | null;
  completed_by: AgentName | null;
}

export interface LedgerEntry {
  seq: number;
  type: LedgerEntryType;
  agent: AgentName | "SYSTEM";
  timestamp: string;
  payload: Record<string, unknown>;
  hash: string;
  prev_hash: string;
  signature?: string;
  public_key?: string;
}

export const ALLOWED_AGENTS: readonly AgentName[] = [
  "FORGE",
  "SENTINEL",
  "LEDGE",
  "OPERATOR",
];

export function isAgentName(value: string): value is AgentName {
  return (ALLOWED_AGENTS as readonly string[]).includes(value);
}

export function isValidTaskId(id: string): boolean {
  return /^task-[a-f0-9]{8}$/.test(id);
}

export function generateTaskId(): string {
  const bytes = crypto.randomBytes(4);
  return `task-${bytes.toString("hex")}`;
}
