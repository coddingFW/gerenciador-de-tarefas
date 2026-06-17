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
export { HistoryAggregator } from "./domain/services/HistoryAggregator.js";
export type { HistoryPoint } from "./domain/services/HistoryAggregator.js";

// Ports
export type * from "./application/ports/index.js";

// Use-cases
export { CreateGoal } from "./application/use-cases/CreateGoal.js";
export type { CreateGoalInput } from "./application/use-cases/CreateGoal.js";
export { EditGoal } from "./application/use-cases/EditGoal.js";
export type { EditGoalInput } from "./application/use-cases/EditGoal.js";
export { ArchiveGoal } from "./application/use-cases/ArchiveGoal.js";
export type { ArchiveGoalInput } from "./application/use-cases/ArchiveGoal.js";
export { CreateTask } from "./application/use-cases/CreateTask.js";
export type { CreateTaskInput } from "./application/use-cases/CreateTask.js";
export { ReopenTask } from "./application/use-cases/ReopenTask.js";
export type { ReopenTaskInput } from "./application/use-cases/ReopenTask.js";
export { CreateCategory } from "./application/use-cases/CreateCategory.js";
export type { CreateCategoryInput } from "./application/use-cases/CreateCategory.js";
export { EditCategory } from "./application/use-cases/EditCategory.js";
export type { EditCategoryInput } from "./application/use-cases/EditCategory.js";
export { ReorderCategories } from "./application/use-cases/ReorderCategories.js";
export type { ReorderCategoriesInput } from "./application/use-cases/ReorderCategories.js";
export { SyncUserTimezone } from "./application/use-cases/SyncUserTimezone.js";
export type { SyncUserTimezoneInput } from "./application/use-cases/SyncUserTimezone.js";
export { UpdateProfile } from "./application/use-cases/UpdateProfile.js";
export type { UpdateProfileInput } from "./application/use-cases/UpdateProfile.js";
export { CompleteTask } from "./application/use-cases/CompleteTask.js";
export type { CompleteTaskInput } from "./application/use-cases/CompleteTask.js";
export { LogExecution } from "./application/use-cases/LogExecution.js";
export type { LogExecutionInput } from "./application/use-cases/LogExecution.js";
export { ScheduleReminder } from "./application/use-cases/ScheduleReminder.js";
export type { ScheduleReminderInput } from "./application/use-cases/ScheduleReminder.js";
export { CancelReminder } from "./application/use-cases/CancelReminder.js";
export type { CancelReminderInput } from "./application/use-cases/CancelReminder.js";
