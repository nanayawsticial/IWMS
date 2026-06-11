-- CreateTable
CREATE TABLE "WeeklyReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "additionalNotes" TEXT NOT NULL DEFAULT '',
    "reviewNotes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WeeklyReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReportActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "taskName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "impact" TEXT NOT NULL DEFAULT '',
    "hoursSpent" REAL NOT NULL DEFAULT 0,
    "links" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "ReportActivity_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "WeeklyReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReportRoadblock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "impact" TEXT NOT NULL DEFAULT '',
    "mitigation" TEXT NOT NULL DEFAULT '',
    "supportRequired" TEXT NOT NULL DEFAULT '',
    "responsibleParty" TEXT NOT NULL DEFAULT '',
    "deadline" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "ReportRoadblock_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "WeeklyReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReportUpcomingPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "plannedActivity" TEXT NOT NULL,
    "typeAssigned" TEXT NOT NULL DEFAULT 'Assigned',
    "typeScope" TEXT NOT NULL DEFAULT 'Departmental',
    "deliverables" TEXT NOT NULL DEFAULT '',
    "targetDate" TEXT NOT NULL DEFAULT '',
    "dependencies" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "ReportUpcomingPlan_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "WeeklyReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReportSupportItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "supportType" TEXT NOT NULL DEFAULT '',
    "requestedFrom" TEXT NOT NULL DEFAULT '',
    "urgency" TEXT NOT NULL DEFAULT 'medium',
    "dueDate" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "ReportSupportItem_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "WeeklyReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReportInsight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "insight" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "impact" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "ReportInsight_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "WeeklyReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReport_userId_startDate_key" ON "WeeklyReport"("userId", "startDate");
