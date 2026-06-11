-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BiometricDevice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 4370,
    "deviceType" TEXT NOT NULL DEFAULT 'zkteco',
    "location" TEXT NOT NULL DEFAULT '',
    "serialNumber" TEXT NOT NULL DEFAULT '',
    "firmwareVersion" TEXT NOT NULL DEFAULT '',
    "hardwareModel" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "lastSyncAt" DATETIME,
    "lastSeenAt" DATETIME,
    "apiKeyHash" TEXT,
    "apiKeyLast4" TEXT NOT NULL DEFAULT '',
    "apiKeyCreatedAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSimulated" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BiometricDevice" ("createdAt", "deviceType", "firmwareVersion", "id", "ipAddress", "isActive", "isSimulated", "lastSyncAt", "location", "name", "notes", "port", "serialNumber", "status", "updatedAt") SELECT "createdAt", "deviceType", "firmwareVersion", "id", "ipAddress", "isActive", "isSimulated", "lastSyncAt", "location", "name", "notes", "port", "serialNumber", "status", "updatedAt" FROM "BiometricDevice";
DROP TABLE "BiometricDevice";
ALTER TABLE "new_BiometricDevice" RENAME TO "BiometricDevice";
CREATE TABLE "new_DeviceSyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventTime" TEXT NOT NULL,
    "terminalEventId" TEXT,
    "verificationMode" TEXT NOT NULL DEFAULT '',
    "rawData" TEXT NOT NULL DEFAULT '{}',
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeviceSyncLog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "BiometricDevice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DeviceSyncLog" ("createdAt", "deviceId", "employeeCode", "eventTime", "eventType", "id", "processed", "rawData", "userId") SELECT "createdAt", "deviceId", "employeeCode", "eventTime", "eventType", "id", "processed", "rawData", "userId" FROM "DeviceSyncLog";
DROP TABLE "DeviceSyncLog";
ALTER TABLE "new_DeviceSyncLog" RENAME TO "DeviceSyncLog";
CREATE UNIQUE INDEX "DeviceSyncLog_deviceId_terminalEventId_key" ON "DeviceSyncLog"("deviceId", "terminalEventId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
