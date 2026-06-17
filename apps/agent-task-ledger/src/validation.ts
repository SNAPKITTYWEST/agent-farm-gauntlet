import { Task, AgentName, isAgentName, ALLOWED_AGENTS } from "./types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateTaskInput(input: {
  title?: unknown;
  description?: unknown;
  assignee?: unknown;
}): ValidationResult {
  const errors: string[] = [];

  if (!input.title || typeof input.title !== "string") {
    errors.push("title is required and must be a string");
  } else if (input.title.length === 0) {
    errors.push("title must not be empty");
  } else if (input.title.length > 200) {
    errors.push("title must be 200 characters or less");
  }

  if (input.description !== undefined && input.description !== null) {
    if (typeof input.description !== "string") {
      errors.push("description must be a string");
    } else if (input.description.length > 2000) {
      errors.push("description must be 2000 characters or less");
    }
  }

  if (!input.assignee || typeof input.assignee !== "string") {
    errors.push("assignee is required and must be a string");
  } else if (!isAgentName(input.assignee)) {
    errors.push(
      `assignee must be one of: ${ALLOWED_AGENTS.join(", ")}`
    );
  }

  return { valid: errors.length === 0, errors };
}

export function validateStatusTransition(
  current: string,
  next: string
): ValidationResult {
  const validTransitions: Record<string, string[]> = {
    pending: ["in_progress", "rejected"],
    in_progress: ["completed", "rejected"],
    completed: [],
    rejected: [],
  };

  if (!validTransitions[current]) {
    return { valid: false, errors: [`Unknown current status: ${current}`] };
  }

  if (!validTransitions[current].includes(next)) {
    return {
      valid: false,
      errors: [
        `Invalid transition: ${current} → ${next}. Allowed: ${validTransitions[current].join(", ") || "none"}`,
      ],
    };
  }

  return { valid: true, errors: [] };
}
