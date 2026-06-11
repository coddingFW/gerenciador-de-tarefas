// Barrel público do domínio. A infraestrutura importa SOMENTE daqui.

// Entities & events
export * from "./domain/entities/index.js";
export * from "./domain/events/index.js";

// Domain services
export { StreakCalculator } from "./domain/services/StreakCalculator.js";
export type { StreakResult } from "./domain/services/StreakCalculator.js";
export {
  ProductivityScore,
  DEFAULT_WEIGHTS,
} from "./domain/services/ProductivityScore.js";
export type { ScoreInput, ScoreWeights } from "./domain/services/ProductivityScore.js";

// Ports
export type * from "./application/ports/index.js";

// Use-cases
export { CreateGoal } from "./application/use-cases/CreateGoal.js";
export type { CreateGoalInput } from "./application/use-cases/CreateGoal.js";
export { EditGoal } from "./application/use-cases/EditGoal.js";
export type { EditGoalInput } from "./application/use-cases/EditGoal.js";
export { ArchiveGoal } from "./application/use-cases/ArchiveGoal.js";
export type { ArchiveGoalInput } from "./application/use-cases/ArchiveGoal.js";
export { CompleteTask } from "./application/use-cases/CompleteTask.js";
export type { CompleteTaskInput } from "./application/use-cases/CompleteTask.js";
export { LogExecution } from "./application/use-cases/LogExecution.js";
export type { LogExecutionInput } from "./application/use-cases/LogExecution.js";
