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
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "lastSyncAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSimulated" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BiometricDevice" ("createdAt", "deviceType", "firmwareVersion", "id", "ipAddress", "isActive", "lastSyncAt", "location", "name", "notes", "port", "serialNumber", "status", "updatedAt") SELECT "createdAt", "deviceType", "firmwareVersion", "id", "ipAddress", "isActive", "lastSyncAt", "location", "name", "notes", "port", "serialNumber", "status", "updatedAt" FROM "BiometricDevice";
DROP TABLE "BiometricDevice";
ALTER TABLE "new_BiometricDevice" RENAME TO "BiometricDevice";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'employee',
    "position" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "avatar" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "joinDate" TEXT NOT NULL DEFAULT '',
    "employeeCode" TEXT NOT NULL DEFAULT '',
    "departmentId" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("avatar", "createdAt", "departmentId", "email", "id", "joinDate", "mfaEnabled", "mfaSecret", "name", "passwordHash", "phone", "position", "role", "status", "updatedAt") SELECT "avatar", "createdAt", "departmentId", "email", "id", "joinDate", "mfaEnabled", "mfaSecret", "name", "passwordHash", "phone", "position", "role", "status", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
