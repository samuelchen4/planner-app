// The data models (tasks, habit days, calendar events) now live with the database code as Drizzle
// tables: apps/mobile/src/db/schema/ (to move to a shared package when the web app and backend
// need them). This package keeps app-independent logic such as the schedule settings.
export {};
