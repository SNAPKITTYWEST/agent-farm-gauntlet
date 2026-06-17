import { Task, AgentName, TaskStatus, LedgerEntry } from "./types";
import { Ledger } from "./ledger";
import { validateTaskInput, validateStatusTransition } from "./validation";
import { generateTaskId, isAgentName } from "./types";
import { AgentKeyManager } from "./agent-keys";

type TaskResult =
  | { task: Task; entry: LedgerEntry; error: null }
  | { task: null; entry: LedgerEntry | null; error: string };

export class TaskManager {
  private tasks: Map<string, Task> = new Map();
  private ledger: Ledger;
  private keyManager: AgentKeyManager;

  constructor(ledger: Ledger, keyManager: AgentKeyManager) {
    this.ledger = ledger;
    this.keyManager = keyManager;
    this.rebuildFromLedger();
  }

  private rebuildFromLedger(): void {
    // Only TASK_CREATED, TASK_COMPLETED, TASK_REJECTED affect task state
    const entries = this.ledger.getEntries();
    for (const entry of entries) {
      if (entry.type === "TASK_CREATED") {
        const p = entry.payload as Record<string, unknown>;
        const task: Task = {
          id: p.id as string,
          title: p.title as string,
          description: (p.description as string) || "",
          assignee: p.assignee as AgentName,
          status: p.status as TaskStatus,
          created_at: p.created_at as string,
          completed_at: null,
          completed_by: null,
        };
        this.tasks.set(task.id, task);
      } else if (entry.type === "TASK_COMPLETED") {
        const p = entry.payload as Record<string, unknown>;
        const task = this.tasks.get(p.id as string);
        if (task) {
          task.status = "completed";
          task.completed_at = entry.timestamp;
          task.completed_by = entry.agent as AgentName;
        }
      } else if (entry.type === "TASK_REJECTED") {
        const p = entry.payload as Record<string, unknown>;
        const task = this.tasks.get(p.id as string);
        if (task) {
          task.status = "rejected";
        }
      }
    }
  }

  createTask(
    title: string,
    description: string,
    assignee: AgentName
  ): TaskResult {
    const validation = validateTaskInput({ title, description, assignee });
    if (!validation.valid) {
      return { task: null, entry: null, error: validation.errors.join("; ") };
    }

    const id = generateTaskId();
    const now = new Date().toISOString();

    const task: Task = {
      id,
      title,
      description: description || "",
      assignee,
      status: "pending",
      created_at: now,
      completed_at: null,
      completed_by: null,
    };

    this.tasks.set(id, task);

    const entry = this.ledger.append("TASK_CREATED", assignee, {
      id,
      title,
      description: task.description,
      assignee,
      status: "pending",
      created_at: now,
    });

    return { task, entry, error: null };
  }

  startTask(
    taskId: string,
    agent: AgentName
  ): TaskResult {
    if (!isAgentName(agent)) {
      return { task: null, entry: null, error: "Unauthorized agent" };
    }

    const task = this.tasks.get(taskId);
    if (!task) {
      return { task: null, entry: null, error: "Task not found" };
    }

    const transition = validateStatusTransition(task.status, "in_progress");
    if (!transition.valid) {
      return { task: null, entry: null, error: transition.errors.join("; ") };
    }

    task.status = "in_progress";

    const entry = this.ledger.append("TASK_ASSIGNED", agent, {
      id: taskId,
      started_by: agent,
    });

    return { task, entry, error: null };
  }

  completeTask(
    taskId: string,
    agent: AgentName
  ): TaskResult {
    if (!isAgentName(agent)) {
      return { task: null, entry: null, error: "Unauthorized agent" };
    }

    const task = this.tasks.get(taskId);
    if (!task) {
      return { task: null, entry: null, error: "Task not found" };
    }

    if (task.status === "completed") {
      const entry = this.ledger.append("DUPLICATE", agent, {
        id: taskId,
        attempted_status: "completed",
        current_status: task.status,
      });
      return { task: null, entry, error: "Task already completed" };
    }

    if (task.status === "rejected") {
      return { task: null, entry: null, error: "Cannot complete rejected task" };
    }

    const transition = validateStatusTransition(task.status, "completed");
    if (!transition.valid) {
      return { task: null, entry: null, error: transition.errors.join("; ") };
    }

    if (task.assignee !== agent) {
      const entry = this.ledger.append("BREACH", agent, {
        id: taskId,
        attempted_by: agent,
        assigned_to: task.assignee,
        violation: "UNAUTHORIZED_COMPLETION",
      });
      return {
        task: null,
        entry,
        error: "Agent not authorized to complete this task",
      };
    }

    const now = new Date().toISOString();
    task.status = "completed";
    task.completed_at = now;
    task.completed_by = agent;

    const entry = this.ledger.append("TASK_COMPLETED", agent, {
      id: taskId,
      completed_at: now,
      completed_by: agent,
    });

    return { task, entry, error: null };
  }

  rejectTask(
    taskId: string,
    agent: AgentName
  ): TaskResult {
    if (!isAgentName(agent)) {
      return { task: null, entry: null, error: "Unauthorized agent" };
    }

    const task = this.tasks.get(taskId);
    if (!task) {
      return { task: null, entry: null, error: "Task not found" };
    }

    const transition = validateStatusTransition(task.status, "rejected");
    if (!transition.valid) {
      return { task: null, entry: null, error: transition.errors.join("; ") };
    }

    task.status = "rejected";

    const entry = this.ledger.append("TASK_REJECTED", agent, {
      id: taskId,
      rejected_by: agent,
    });

    return { task, entry, error: null };
  }

  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }
}
