import {
  doublePrecision,
  index,
  pgTable,
  smallint,
  text,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

import { day, timestamptz } from './columns';

export const TASK_TYPES = ['task', 'time_block', 'list', 'habit'] as const;
export const TASK_STATUSES = ['open', 'done', 'cancelled'] as const;
/** Colours a list or habit can take (green is reserved for done). */
export const TASK_COLORS = ['yellow', 'pink', 'blue', 'orange', 'lavender'] as const;

/**
 * Everything the user makes is a task. `type` says which kind:
 * - task / time_block: on the planner, either timed (`start_at`/`end_at`) or all-day
 *   (`all_day_date`); neither = the inbox.
 * - list: a task with entries (other tasks whose `list_id` points at it).
 * - habit: done every day; its history is in `habit_days`.
 */
export const tasks = pgTable(
  'tasks',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** The owner (auth.users.id). */
    user_id: uuid().notNull(),
    type: text({ enum: TASK_TYPES }).notNull().default('task'),
    title: text().notNull().default(''),
    notes: text(),

    /** Timed: when it starts and ends, and the time zone it was planned in. */
    start_at: timestamptz(),
    end_at: timestamptz(),
    time_zone: text(),
    /** All-day: the day it's on. */
    all_day_date: day(),
    /**
     * A recurring series: its repeat rule (RFC 5545, see @planner/core recurrence), e.g.
     * 'FREQ=WEEKLY;BYDAY=MO,WE'. Its date and time are the first day's. The series row itself isn't
     * shown: each day it falls on is (see db/recurring).
     */
    rrule: text(),
    /**
     * One day of a series that was changed (checked off, moved; deleted = cancelled): the series and
     * the day it belongs to. Unchanged days aren't stored.
     */
    series_id: uuid().references((): AnyPgColumn => tasks.id, { onDelete: 'cascade' }),
    occurrence_date: day(),

    status: text({ enum: TASK_STATUSES }).notNull().default('open'),
    /** When it was checked off (set with status 'done'). */
    completed_at: timestamptz(),
    /** 0 = none, 1–3 = !, !!, !!! (3 is the highest). Read it with `priorityOf`. */
    priority: smallint().notNull().default(0),

    /** An entry of a list: the list's id. Entries have no times or dates of their own. */
    list_id: uuid().references((): AnyPgColumn => tasks.id, { onDelete: 'cascade' }),
    /** Lists and habits: their colour. Habits: their icon (an SF Symbol name for now). */
    color: text({ enum: TASK_COLORS }),
    icon: text(),
    /**
     * Order among siblings (a day's all-day tasks, a list's entries). Fractional: placing a task
     * between two others takes the midpoint, so a move changes one row.
     */
    position: doublePrecision().notNull().default(0),

    created_at: timestamptz().notNull().defaultNow(),
    updated_at: timestamptz().notNull().defaultNow(),
  },
  (t) => [
    index('tasks_user_idx').on(t.user_id),
    index('tasks_list_idx').on(t.list_id),
    index('tasks_series_idx').on(t.series_id),
  ],
);

export type Task = typeof tasks.$inferSelect;
export type TaskType = Task['type'];
export type TaskColor = NonNullable<Task['color']>;
export const MAX_PRIORITY = 3;
