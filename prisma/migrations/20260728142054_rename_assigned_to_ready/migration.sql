-- Rename enum value ASSIGNED to READY in TaskStatus
ALTER TYPE "TaskStatus" RENAME VALUE 'ASSIGNED' TO 'READY';
