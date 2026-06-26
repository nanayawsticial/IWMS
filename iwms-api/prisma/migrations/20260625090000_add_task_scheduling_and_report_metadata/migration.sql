-- Add task scheduling and weekly-report metadata fields.

ALTER TABLE "Task"
  ADD COLUMN "scheduledDate" TEXT,
  ADD COLUMN "outcomeImpact" TEXT,
  ADD COLUMN "deliverableLink" TEXT,
  ADD COLUMN "blockerNote" TEXT;

UPDATE "Task"
SET "scheduledDate" = "dueDate"
WHERE "scheduledDate" IS NULL;

ALTER TABLE "Task"
  ALTER COLUMN "estimatedHours" SET DATA TYPE DOUBLE PRECISION USING "estimatedHours"::double precision;

ALTER TABLE "WeeklyReport"
  ADD COLUMN "isAutoDraft" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ReportActivity"
  ADD COLUMN "isAutoFilled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sourceTaskId" TEXT;

ALTER TABLE "ReportRoadblock"
  ADD COLUMN "isAutoFilled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sourceTaskId" TEXT;

ALTER TABLE "ReportUpcomingPlan"
  ADD COLUMN "isAutoFilled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sourceTaskId" TEXT;

ALTER TABLE "ReportSupportItem"
  ADD COLUMN "isAutoFilled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sourceTaskId" TEXT;

ALTER TABLE "ReportInsight"
  ADD COLUMN "isAutoFilled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sourceTaskId" TEXT;

CREATE INDEX "Task_scheduledDate_idx" ON "Task"("scheduledDate");
CREATE INDEX "Task_assigneeId_scheduledDate_idx" ON "Task"("assigneeId", "scheduledDate");
