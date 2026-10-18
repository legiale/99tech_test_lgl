export type TaskStatus = "pending" | "in_progress" | "completed";

export interface TaskInput {
  title: string;
  description: string;
  status: TaskStatus;
}

export interface Task extends TaskInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskFilters {
  status?: TaskStatus;
  q?: string;
  limit: number;
  offset: number;
}
