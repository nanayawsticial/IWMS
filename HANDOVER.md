# IWMS Platform Handover

Generated from repository files in `G:/Dash` on 2026-06-20. Real secret values are intentionally not printed.

## SECTION 1 — Project Identity

Project name and purpose: IWMS (Integrated Workforce Management System) is a multi-tenant workforce platform for attendance, tasks, live presence, leave, overtime, weekly reporting, team/department management, HR records, finance budgets/expenses, notifications, management analytics, and RFID/Pico attendance hardware.

- Live deployment URL: not committed as a single canonical value. CORS allows Vercel deployments ending in `.vercel.app` that include `nana-yaw-s-projects1`; frontend production API URL comes from `NEXT_PUBLIC_API_URL`.

- Repository structure: separate project folders in one workspace: `iwms` frontend, `iwms-api` backend/API/Prisma, `das` Pico firmware.

- Tech stack: Next.js 16.2.7, React 19.2.4, TypeScript, Tailwind CSS 4, React Query, Axios, Recharts, Socket.io client; Fastify ^5.8.5, Prisma ^5.22.0, PostgreSQL/Supabase-style URLs, Socket.io ^4.8.3, JWT, bcryptjs, Speakeasy MFA, Nodemailer/Ethereal email, node-cron; MicroPython Pico 2 W firmware.

- Node.js version: no `.nvmrc` or `engines.node` found. Package manager: npm (`package-lock.json` exists in frontend and backend).

- Environment: dev defaults are frontend `localhost:3000` and backend `localhost:3001`; production requires real PostgreSQL URLs, JWT secrets, CORS frontend URL, and Vercel/public API env values.

## SECTION 2 — Repository File Tree

### Frontend

```bash
iwms/src/app/attendance-dashboard/page.tsx
iwms/src/app/attendance/page.tsx
iwms/src/app/dashboard/page.tsx
iwms/src/app/department-dashboard/page.tsx
iwms/src/app/error.tsx
iwms/src/app/favicon.ico
iwms/src/app/finance/page.tsx
iwms/src/app/get-started/page.tsx
iwms/src/app/globals.css
iwms/src/app/holidays/page.tsx
iwms/src/app/hr/page.tsx
iwms/src/app/layout.tsx
iwms/src/app/leave/page.tsx
iwms/src/app/login/page.tsx
iwms/src/app/management/page.tsx
iwms/src/app/not-found.tsx
iwms/src/app/overtime/page.tsx
iwms/src/app/page.tsx
iwms/src/app/presence/page.tsx
iwms/src/app/register/page.tsx
iwms/src/app/reports/page.tsx
iwms/src/app/settings/page.tsx
iwms/src/app/tasks/page.tsx
iwms/src/app/team/[id]/page.tsx
iwms/src/app/team/page.tsx
iwms/src/app/timesheets/page.tsx
iwms/src/app/weekly-reports/page.tsx
iwms/src/components/AppLayout.tsx
iwms/src/components/GanttChart.tsx
iwms/src/components/KpiCard.tsx
iwms/src/components/Sidebar.tsx
iwms/src/components/TaskDetailPanel.tsx
iwms/src/components/Toast.tsx
iwms/src/components/TopBar.tsx
iwms/src/hooks/useSocket.ts
iwms/src/lib/api.ts
iwms/src/lib/auth-context.tsx
iwms/src/lib/mock-data.ts
iwms/src/lib/query-provider.tsx
iwms/src/lib/socket.ts
```

### Backend routes

```bash
iwms-api/routes/attendance.js
iwms-api/routes/auth.js
iwms-api/routes/departments.js
iwms-api/routes/devices.js
iwms-api/routes/finance.js
iwms-api/routes/geofence.js
iwms-api/routes/holidays.js
iwms-api/routes/hr.js
iwms-api/routes/leaves.js
iwms-api/routes/management.js
iwms-api/routes/mfa.js
iwms-api/routes/notifications.js
iwms-api/routes/organization.js
iwms-api/routes/overtime.js
iwms-api/routes/reports.js
iwms-api/routes/shifts.js
iwms-api/routes/tasks.js
iwms-api/routes/users.js
```

### Backend lib

```bash
iwms-api/lib/cron.js
iwms-api/lib/mailer.js
iwms-api/lib/prisma.js
iwms-api/lib/runtime.js
```

### Backend prisma

```bash
iwms-api/prisma/dev.db
iwms-api/prisma/dev.demo-backup-20260603-173952.db
iwms-api/prisma/migrations/20260619091653_init/migration.sql
iwms-api/prisma/migrations/20260619092738_add_public_holiday/migration.sql
iwms-api/prisma/migrations/20260620054705_add_hr_and_finance_models/migration.sql
iwms-api/prisma/migrations/migration_lock.toml
iwms-api/prisma/schema.prisma
iwms-api/prisma/seed.js
```

### Firmware

```bash
das/__pycache__/config.cpython-314.pyc
das/__pycache__/main.cpython-314.pyc
das/__pycache__/provisioning.cpython-314.pyc
das/__pycache__/wifi_sync.cpython-314.pyc
das/.gitignore
das/cleanup_userdb.py
das/clear_logs.py
das/clear_queue.py
das/config.py
das/ds1302.py
das/main.py
das/micropython-ili9341-master/font_to_py.py
das/micropython-ili9341-master/glcdfont.py
das/micropython-ili9341-master/ili934xnew.py
das/micropython-ili9341-master/image/m5stack.jpg
das/micropython-ili9341-master/image/rotations.png
das/micropython-ili9341-master/LICENSE
das/micropython-ili9341-master/m5stack.py
das/micropython-ili9341-master/main.py
das/micropython-ili9341-master/README.md
das/micropython-ili9341-master/rotations_test.py
das/micropython-ili9341-master/tt14.py
das/micropython-ili9341-master/tt24.py
das/micropython-ili9341-master/tt32.py
das/micropython-mfrc522-master/.gitignore
das/micropython-mfrc522-master/deploy_esp.sh
das/micropython-mfrc522-master/deploy_wipy.sh
das/micropython-mfrc522-master/examples/MultiReaders.py
das/micropython-mfrc522-master/examples/read.py
das/micropython-mfrc522-master/examples/write.py
das/micropython-mfrc522-master/LICENSE
das/micropython-mfrc522-master/mfrc522.py
das/micropython-mfrc522-master/Pico_example/CreateNdefTag.py
das/micropython-mfrc522-master/Pico_example/EraseNdefTag.py
das/micropython-mfrc522-master/Pico_example/Pico_read.py
das/micropython-mfrc522-master/Pico_example/Pico_write.py
das/micropython-mfrc522-master/Pico_example/Read4Readers.py
das/micropython-mfrc522-master/Pico_example/ReadNdefTag.py
das/micropython-mfrc522-master/README.md
das/micropython-mfrc522-master/RfidAccess.py
das/pairing.py
das/provisioning.py
das/set_time.py
das/wifi_sync.py
```

## SECTION 3 — Environment Variables

| Variable name | Project | What it does | Required/optional | Example value format | Source |
| --- | --- | --- | --- | --- | --- |
| DATABASE_URL | backend | Prisma pooled PostgreSQL connection string used by Prisma Client at runtime. | Required | postgresql://user:password@host:5432/db?sslmode=require | iwms-api/.env, prisma/schema.prisma |
| DIRECT_URL | backend | Direct PostgreSQL connection string used by Prisma for direct access and migrations. | Required | postgresql://user:password@host:5432/db?sslmode=require | iwms-api/.env, prisma/schema.prisma |
| JWT_SECRET | backend | Secret used by @fastify/jwt to sign and verify access tokens. | Required | long-random-secret-string | iwms-api/.env, iwms-api/server.js |
| JWT_REFRESH_SECRET | backend | Secret required by auth routes for refresh-token and MFA temporary-token signing/verification. | Required | long-random-secret-string | iwms-api/.env, iwms-api/server.js, auth/mfa routes |
| FRONTEND_URL | backend | Explicit production frontend origin allowed by backend CORS and Socket.io CORS. | Optional in dev, required for non-matching production domains | https://iwms.example.com | iwms-api/.env, iwms-api/server.js |
| PORT | backend | Backend HTTP and Socket.io listen port. Defaults to 3001. | Optional | 3001 | iwms-api/.env, iwms-api/server.js |
| NODE_ENV | backend | Runtime environment switch; production mode makes missing secrets fatal in runtime helper. | Optional but recommended | production | iwms-api/.env, iwms-api/lib/runtime.js |
| FIRST_ADMIN_EMAIL | backend | Seed/bootstrap email for first admin account. | Optional/bootstrap only | admin@example.com | iwms-api/.env, iwms-api/prisma/seed.js |
| FIRST_ADMIN_NAME | backend | Seed/bootstrap display name for first admin account. | Optional/bootstrap only | Admin User | iwms-api/.env, iwms-api/prisma/seed.js |
| FIRST_ADMIN_PASSWORD | backend | Seed/bootstrap password for first admin account. | Optional/bootstrap only; secret | strong-password | iwms-api/.env, iwms-api/prisma/seed.js |
| NEXT_PUBLIC_API_URL | frontend | Browser-visible base URL for Axios REST calls and Socket.io client connection. | Required outside localhost dev | https://api.example.com | iwms/.env.local, iwms/src/lib/api.ts, iwms/src/lib/socket.ts |

## SECTION 4 — Database Schema (Complete)

### Raw schema

```prisma
// This is your Prisma schema file
// Docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model Organization {
  id               String            @id @default(cuid())
  name             String            @unique
  joinCode         String            @unique
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  users            User[]
  departments      Department[]
  tasks            Task[]
  attendance       AttendanceRecord[]
  leaves           LeaveRequest[]
  shifts           Shift[]
  biometricDevices BiometricDevice[]
  geofenceZones    GeoFenceZone[]
  weeklyReports    WeeklyReport[]
  notifications    Notification[]
  overtimeRequests OvertimeRequest[]
  publicHolidays   PublicHoliday[]
  employeeProfiles EmployeeProfile[]
  expenses         Expense[]
  budgets          Budget[]
}

model Department {
  id             String       @id @default(cuid())
  name           String
  color          String       @default("#6366f1")
  headcount      Int          @default(0)
  managerId      String?
  managerName    String       @default("")
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  users          User[]
  tasks          Task[]

  @@unique([name, organizationId])
  @@index([organizationId])
}

model User {
  id             String       @id @default(cuid())
  name           String
  email          String       @unique
  passwordHash   String
  role           String       @default("employee")
  position       String       @default("")
  phone          String       @default("")
  avatar         String       @default("")
  status         String       @default("active")
  joinDate       String       @default("")
  employeeCode   String       @default("")
  departmentId   String?
  department     Department?  @relation(fields: [departmentId], references: [id])
  mfaEnabled     Boolean      @default(false)
  mfaSecret      String?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  attendance      AttendanceRecord[]
  assignedTasks   Task[]             @relation("TaskAssignee")
  createdTasks    Task[]             @relation("TaskCreator")
  reviewedTasks   Task[]             @relation("TaskReviewer")
  sessions        Session[]
  leaves          LeaveRequest[]
  comments        TaskComment[]
  timeLogs        TaskTimeLog[]
  shifts          Shift[]
  reports         WeeklyReport[]
  overtimeRequests OvertimeRequest[]
  employeeProfile  EmployeeProfile?
  expenses        Expense[]

  @@index([departmentId])
  @@index([organizationId])
}

model Session {
  id           String   @id @default(cuid())
  userId       String
  refreshToken String   @unique
  expiresAt    DateTime
  createdAt    DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model Task {
  id              String   @id @default(cuid())
  title           String
  description     String   @default("")
  assigneeId      String
  assignee        User     @relation("TaskAssignee", fields: [assigneeId], references: [id])
  creatorId       String?
  creator         User?    @relation("TaskCreator", fields: [creatorId], references: [id])
  reviewerId      String?
  reviewer        User?    @relation("TaskReviewer", fields: [reviewerId], references: [id])
  priority        String   @default("medium")
  status          String   @default("todo")
  dueDate         String
  tags            String   @default("[]")
  projectId       String   @default("general")
  projectName     String   @default("General")
  estimatedHours  Int      @default(8)
  loggedHours     Int      @default(0)
  departmentId    String?
  department      Department? @relation(fields: [departmentId], references: [id])
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  comments        TaskComment[]
  timeLogs        TaskTimeLog[]

  @@index([assigneeId])
  @@index([creatorId])
  @@index([reviewerId])
  @@index([departmentId])
  @@index([organizationId])
}

model AttendanceRecord {
  id               String   @id @default(cuid())
  userId           String
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  date             String
  clockIn          String?
  clockOut         String?
  status           String   @default("present")
  method           String   @default("web")
  latitude         Float?
  longitude        Float?
  hoursWorked      Float?
  notes            String?
  correctedIn      String?
  correctedOut     String?
  correctionReason String?
  correctedBy      String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  organizationId   String
  organization     Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([userId, date])
  @@index([userId])
  @@index([organizationId])
}

model LeaveRequest {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  startDate    String
  endDate      String
  type         String   // vacation, sick, personal
  status       String   @default("pending") // pending, approved, rejected
  reason       String?
  managerNotes String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([organizationId])
}

model TaskComment {
  id        String   @id @default(cuid())
  taskId    String
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  content   String
  createdAt DateTime @default(now())

  @@index([taskId])
  @@index([userId])
}

model TaskTimeLog {
  id        String   @id @default(cuid())
  taskId    String
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  hours     Float
  date      String
  note      String?
  createdAt DateTime @default(now())

  @@index([taskId])
  @@index([userId])
}

model Shift {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  date      String
  startTime String?
  endTime   String?
  type      String   // day, night, off
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([userId, date])
  @@index([userId])
  @@index([organizationId])
}

model BiometricDevice {
  id              String   @id @default(cuid())
  name            String
  ipAddress       String
  port            Int      @default(4370)
  deviceType      String   @default("zkteco")  // zkteco | hikvision | generic
  location        String   @default("")
  serialNumber    String   @default("")
  firmwareVersion String   @default("")
  hardwareModel   String   @default("")
  status          String   @default("unknown") // online | offline | unknown
  lastSyncAt      DateTime?
  lastSeenAt      DateTime?
  apiKeyHash      String?
  apiKeyLast4     String   @default("")
  apiKeyCreatedAt DateTime?
  isActive        Boolean  @default(true)
  isSimulated     Boolean  @default(true)
  notes           String   @default("")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  syncLogs        DeviceSyncLog[]

  @@index([organizationId])
}

model DeviceSyncLog {
  id           String   @id @default(cuid())
  deviceId     String
  device       BiometricDevice @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  employeeCode String
  userId       String?
  eventType    String   // check_in | check_out
  eventTime    String
  terminalEventId String?
  verificationMode String @default("")
  rawData      String   @default("{}")
  processed    Boolean  @default(false)
  createdAt    DateTime @default(now())

  @@unique([deviceId, terminalEventId])
  @@index([deviceId])
  @@index([userId])
}

model GeoFenceZone {
  id            String   @id @default(cuid())
  name          String
  latitude      Float
  longitude     Float
  radiusMeters  Int      @default(200)
  isActive      Boolean  @default(true)
  notes         String   @default("")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId])
}

model WeeklyReport {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  startDate       String   // YYYY-MM-DD
  endDate         String   // YYYY-MM-DD
  status          String   @default("draft") // draft | submitted | approved | needs_revision
  additionalNotes String   @default("")
  reviewNotes     String   @default("")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  activities   ReportActivity[]
  roadblocks   ReportRoadblock[]
  plans        ReportUpcomingPlan[]
  supportItems ReportSupportItem[]
  insights     ReportInsight[]

  @@unique([userId, startDate])
  @@index([userId])
  @@index([organizationId])
}

model ReportActivity {
  id          String      @id @default(cuid())
  reportId    String
  report      WeeklyReport @relation(fields: [reportId], references: [id], onDelete: Cascade)
  taskName    String
  type        String
  status      String
  impact      String      @default("")
  hoursSpent  Float       @default(0)
  links       String      @default("")

  @@index([reportId])
}

model ReportRoadblock {
  id               String      @id @default(cuid())
  reportId         String
  report           WeeklyReport @relation(fields: [reportId], references: [id], onDelete: Cascade)
  challenge        String
  impact           String      @default("")
  mitigation       String      @default("")
  supportRequired  String      @default("")
  responsibleParty String      @default("")
  deadline         String      @default("")

  @@index([reportId])
}

model ReportUpcomingPlan {
  id              String      @id @default(cuid())
  reportId        String
  report          WeeklyReport @relation(fields: [reportId], references: [id], onDelete: Cascade)
  plannedActivity String
  typeAssigned    String      @default("Assigned") // Assigned | Self-Motivated
  typeScope       String      @default("Departmental") // Departmental | Cross-Departmental
  deliverables    String      @default("")
  targetDate      String      @default("")
  dependencies    String      @default("")

  @@index([reportId])
}

model ReportSupportItem {
  id          String      @id @default(cuid())
  reportId    String
  report      WeeklyReport @relation(fields: [reportId], references: [id], onDelete: Cascade)
  description String
  supportType String      @default("")
  requestedFrom String    @default("")
  urgency     String      @default("medium") // high | medium | low
  dueDate     String      @default("")

  @@index([reportId])
}

model ReportInsight {
  id        String      @id @default(cuid())
  reportId  String
  report    WeeklyReport @relation(fields: [reportId], references: [id], onDelete: Cascade)
  insight   String
  category  String      // Process | Technical | Team | Tooling
  impact    String      @default("")

  @@index([reportId])
}

model Notification {
  id             String        @id @default(cuid())
  message        String
  type           String
  metadata       Json
  isRead         Boolean       @default(false)
  targetRole     String
  createdAt      DateTime      @default(now())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId])
}

model OvertimeRequest {
  id             String   @id @default(cuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  date           String
  regularHours   Float
  overtimeHours  Float
  reason         String?
  status         String   @default("pending") // pending | approved | rejected
  reviewedBy     String?
  reviewNotes    String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([organizationId])
}

model PublicHoliday {
  id             String   @id @default(cuid())
  name           String
  date           String   // YYYY-MM-DD
  type           String   @default("public") // public | optional
  createdAt      DateTime @default(now())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([date, organizationId])
  @@index([organizationId])
}

model EmployeeProfile {
  id                String   @id @default(cuid())
  userId            String   @unique
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  employmentType    String   @default("full_time") // full_time | part_time | contract | intern
  probationEndDate  String?
  noticePeriodDays  Int      @default(30)
  salary            Float?
  bankName          String   @default("")
  bankAccount       String   @default("")
  emergencyContact  String   @default("")
  emergencyPhone    String   @default("")
  onboardingStatus  String   @default("pending") // pending | in_progress | complete
  offboardingStatus String?  // null | initiated | in_progress | complete
  terminationDate   String?
  terminationReason String?
  organizationId    String
  organization      Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([userId])
  @@index([organizationId])
}

model Expense {
  id             String   @id @default(cuid())
  title          String
  amount         Float
  currency       String   @default("GHS")
  category       String   // salary | operations | equipment | travel | other
  submittedBy    String
  user           User     @relation(fields: [submittedBy], references: [id])
  status         String   @default("pending") // pending | approved | rejected | paid
  receiptUrl     String?
  notes          String?
  date           String
  approvedBy     String?
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([submittedBy])
  @@index([organizationId])
}

model Budget {
  id             String   @id @default(cuid())
  name           String
  amount         Float
  spent          Float    @default(0)
  period         String   // YYYY-MM
  category       String
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([organizationId])
}

```

### Model: Organization

| Field name | Type | Required / Optional | Default value | Description |
| --- | --- | --- | --- | --- |
| id | String | Required | cuid( | Primary identifier. |
| name | String | Required |  | Stores name (String). |
| joinCode | String | Required |  | Stores joinCode (String). |
| createdAt | DateTime | Required | now( | Creation timestamp. |
| updatedAt | DateTime | Required |  | Last update timestamp. |
| users | User[] | Required |  | Stores users (User[]). |
| departments | Department[] | Required |  | Stores departments (Department[]). |
| tasks | Task[] | Required |  | Stores tasks (Task[]). |
| attendance | AttendanceRecord[] | Required |  | Stores attendance (AttendanceRecord[]). |
| leaves | LeaveRequest[] | Required |  | Stores leaves (LeaveRequest[]). |
| shifts | Shift[] | Required |  | Stores shifts (Shift[]). |
| biometricDevices | BiometricDevice[] | Required |  | Stores biometricDevices (BiometricDevice[]). |
| geofenceZones | GeoFenceZone[] | Required |  | Stores geofenceZones (GeoFenceZone[]). |
| weeklyReports | WeeklyReport[] | Required |  | Stores weeklyReports (WeeklyReport[]). |
| notifications | Notification[] | Required |  | Stores notifications (Notification[]). |
| overtimeRequests | OvertimeRequest[] | Required |  | Stores overtimeRequests (OvertimeRequest[]). |
| publicHolidays | PublicHoliday[] | Required |  | Stores publicHolidays (PublicHoliday[]). |
| employeeProfiles | EmployeeProfile[] | Required |  | Stores employeeProfiles (EmployeeProfile[]). |
| expenses | Expense[] | Required |  | Stores expenses (Expense[]). |
| budgets | Budget[] | Required |  | Stores budgets (Budget[]). |

### Model: Department

| Field name | Type | Required / Optional | Default value | Description |
| --- | --- | --- | --- | --- |
| id | String | Required | cuid( | Primary identifier. |
| name | String | Required |  | Stores name (String). |
| color | String | Required | "#6366f1" | Stores color (String). |
| headcount | Int | Required | 0 | Stores headcount (Int). |
| managerId | String? | Optional |  | Stores managerId (String?). |
| managerName | String | Required | "" | Stores managerName (String). |
| createdAt | DateTime | Required | now( | Creation timestamp. |
| updatedAt | DateTime | Required |  | Last update timestamp. |
| organizationId | String | Required |  | Tenant/organization scope key. |
| organization | Organization | Required |  | Prisma relation field. |
| users | User[] | Required |  | Stores users (User[]). |
| tasks | Task[] | Required |  | Stores tasks (Task[]). |

### Model: User

| Field name | Type | Required / Optional | Default value | Description |
| --- | --- | --- | --- | --- |
| id | String | Required | cuid( | Primary identifier. |
| name | String | Required |  | Stores name (String). |
| email | String | Required |  | Login email. |
| passwordHash | String | Required |  | bcrypt password hash. |
| role | String | Required | "employee" | Authorization role. |
| position | String | Required | "" | Stores position (String). |
| phone | String | Required | "" | Stores phone (String). |
| avatar | String | Required | "" | Stores avatar (String). |
| status | String | Required | "active" | Workflow/status value. |
| joinDate | String | Required | "" | Stores joinDate (String). |
| employeeCode | String | Required | "" | Stores employeeCode (String). |
| departmentId | String? | Optional |  | Stores departmentId (String?). |
| department | Department? | Optional |  | Prisma relation field. |
| mfaEnabled | Boolean | Required | false | Stores mfaEnabled (Boolean). |
| mfaSecret | String? | Optional |  | Stores mfaSecret (String?). |
| createdAt | DateTime | Required | now( | Creation timestamp. |
| updatedAt | DateTime | Required |  | Last update timestamp. |
| organizationId | String | Required |  | Tenant/organization scope key. |
| organization | Organization | Required |  | Prisma relation field. |
| attendance | AttendanceRecord[] | Required |  | Stores attendance (AttendanceRecord[]). |
| assignedTasks | Task[] | Required |  | Prisma relation field. |
| createdTasks | Task[] | Required |  | Prisma relation field. |
| reviewedTasks | Task[] | Required |  | Prisma relation field. |
| sessions | Session[] | Required |  | Stores sessions (Session[]). |
| leaves | LeaveRequest[] | Required |  | Stores leaves (LeaveRequest[]). |
| comments | TaskComment[] | Required |  | Stores comments (TaskComment[]). |
| timeLogs | TaskTimeLog[] | Required |  | Stores timeLogs (TaskTimeLog[]). |
| shifts | Shift[] | Required |  | Stores shifts (Shift[]). |
| reports | WeeklyReport[] | Required |  | Stores reports (WeeklyReport[]). |
| overtimeRequests | OvertimeRequest[] | Required |  | Stores overtimeRequests (OvertimeRequest[]). |
| employeeProfile | EmployeeProfile? | Optional |  | Stores employeeProfile (EmployeeProfile?). |
| expenses | Expense[] | Required |  | Stores expenses (Expense[]). |

### Model: Session

| Field name | Type | Required / Optional | Default value | Description |
| --- | --- | --- | --- | --- |
| id | String | Required | cuid( | Primary identifier. |
| userId | String | Required |  | Related user identifier. |
| refreshToken | String | Required |  | Refresh token stored for sessions. |
| expiresAt | DateTime | Required |  | Refresh/session expiry. |
| createdAt | DateTime | Required | now( | Creation timestamp. |
| user | User | Required |  | Prisma relation field. |

### Model: Task

| Field name | Type | Required / Optional | Default value | Description |
| --- | --- | --- | --- | --- |
| id | String | Required | cuid( | Primary identifier. |
| title | String | Required |  | Stores title (String). |
| description | String | Required | "" | Stores description (String). |
| assigneeId | String | Required |  | Stores assigneeId (String). |
| assignee | User | Required |  | Prisma relation field. |
| creatorId | String? | Optional |  | Stores creatorId (String?). |
| creator | User? | Optional |  | Prisma relation field. |
| reviewerId | String? | Optional |  | Stores reviewerId (String?). |
| reviewer | User? | Optional |  | Prisma relation field. |
| priority | String | Required | "medium" | Stores priority (String). |
| status | String | Required | "todo" | Workflow/status value. |
| dueDate | String | Required |  | Stores dueDate (String). |
| tags | String | Required | "[]" | Stores tags (String). |
| projectId | String | Required | "general" | Stores projectId (String). |
| projectName | String | Required | "General" | Stores projectName (String). |
| estimatedHours | Int | Required | 8 | Stores estimatedHours (Int). |
| loggedHours | Int | Required | 0 | Stores loggedHours (Int). |
| departmentId | String? | Optional |  | Stores departmentId (String?). |
| department | Department? | Optional |  | Prisma relation field. |
| createdAt | DateTime | Required | now( | Creation timestamp. |
| updatedAt | DateTime | Required |  | Last update timestamp. |
| organizationId | String | Required |  | Tenant/organization scope key. |
| organization | Organization | Required |  | Prisma relation field. |
| comments | TaskComment[] | Required |  | Stores comments (TaskComment[]). |
| timeLogs | TaskTimeLog[] | Required |  | Stores timeLogs (TaskTimeLog[]). |

### Model: AttendanceRecord

| Field name | Type | Required / Optional | Default value | Description |
| --- | --- | --- | --- | --- |
| id | String | Required | cuid( | Primary identifier. |
| userId | String | Required |  | Related user identifier. |
| user | User | Required |  | Prisma relation field. |
| date | String | Required |  | Calendar date stored as string. |
| clockIn | String? | Optional |  | Stores clockIn (String?). |
| clockOut | String? | Optional |  | Stores clockOut (String?). |
| status | String | Required | "present" | Workflow/status value. |
| method | String | Required | "web" | Stores method (String). |
| latitude | Float? | Optional |  | Stores latitude (Float?). |
| longitude | Float? | Optional |  | Stores longitude (Float?). |
| hoursWorked | Float? | Optional |  | Stores hoursWorked (Float?). |
| notes | String? | Optional |  | Stores notes (String?). |
| correctedIn | String? | Optional |  | Stores correctedIn (String?). |
| correctedOut | String? | Optional |  | Stores correctedOut (String?). |
| correctionReason | String? | Optional |  | Stores correctionReason (String?). |
| correctedBy | String? | Optional |  | Stores correctedBy (String?). |
| createdAt | DateTime | Required | now( | Creation timestamp. |
| updatedAt | DateTime | Required |  | Last update timestamp. |
| organizationId | String | Required |  | Tenant/organization scope key. |
| organization | Organization | Required |  | Prisma relation field. |

### Model: LeaveRequest

| Field name | Type | Required / Optional | Default value | Description |
| --- | --- | --- | --- | --- |
| id | String | Required | cuid( | Primary identifier. |
| userId | String | Required |  | Related user identifier. |
| user | User | Required |  | Prisma relation field. |
| startDate | String | Required |  | Stores startDate (String). |
| endDate | String | Required |  | Stores endDate (String). |
| type | String | Required |  | Stores type (String). |
| status | String | Required | "pending" | Workflow/status value. |
| reason | String? | Optional |  | Stores reason (String?). |
| managerNotes | String? | Optional |  | Stores managerNotes (String?). |
| createdAt | DateTime | Required | now( | Creation timestamp. |
| updatedAt | DateTime | Required |  | Last update timestamp. |
| organizationId | String | Required |  | Tenant/organization scope key. |
| organization | Organization | Required |  | Prisma relation field. |

### Model: TaskComment

| Field name | Type | Required / Optional | Default value | Description |
| --- | --- | --- | --- | --- |
| id | String | Required | cuid( | Primary identifier. |
| taskId | String | Required |  | Stores taskId (String). |
| task | Task | Required |  | Prisma relation field. |
| userId | String | Required |  | Related user identifier. |
| user | User | Required |  | Prisma relation field. |
| content | String | Required |  | Stores content (String). |
| createdAt | DateTime | Required | now( | Creation timestamp. |

### Model: TaskTimeLog

| Field name | Type | Required / Optional | Default value | Description |
| --- | --- | --- | --- | --- |
| id | String | Required | cuid( | Primary identifier. |
| taskId | String | Required |  | Stores taskId (String). |
| task | Task | Required |  | Prisma relation field. |
| userId | String | Required |  | Related user identifier. |
| user | User | Required |  | Prisma relation field. |
| hours | Float | Required |  | Stores hours (Float). |
| date | String | Required |  | Calendar date stored as string. |
| note | String? | Optional |  | Stores note (String?). |
| createdAt | DateTime | Required | now( | Creation timestamp. |

### Model: Shift

| Field name | Type | Required / Optional | Default value | Description |
| --- | --- | --- | --- | --- |
| id | String | Required | cuid( | Primary identifier. |
| userId | String | Required |  | Related user identifier. |
| user | User | Required |  | Prisma relation field. |
| date | String | Required |  | Calendar date stored as string. |
| startTime | String? | Optional |  | Stores startTime (String?). |
| endTime | String? | Optional |  | Stores endTime (String?). |
| type | String | Required |  | Stores type (String). |
| notes | String? | Optional |  | Stores notes (String?). |
| createdAt | DateTime | Required | now( | Creation timestamp. |
| updatedAt | DateTime | Required |  | Last update timestamp. |
| organizationId | String | Required |  | Tenant/organization scope key. |
| organization | Organization | Required |  | Prisma relation field. |

### Model: BiometricDevice

| Field name | Type | Required / Optional | Default value | Description |
| --- | --- | --- | --- | --- |
| id | String | Required | cuid( | Primary identifier. |
| name | String | Required |  | Stores name (String). |
| ipAddress | String | Required |  | Stores ipAddress (String). |
| port | Int | Required | 4370 | Stores port (Int). |
| deviceType | String | Required | "zkteco" | Stores deviceType (String). |
| location | String | Required | "" | Stores location (String). |
| serialNumber | String | Required | "" | Stores serialNumber (String). |
| firmwareVersion | String | Required | "" | Stores firmwareVersion (String). |
| hardwareModel | String | Required | "" | Stores hardwareModel (String). |
| status | String | Required | "unknown" | Workflow/status value. |
| lastSyncAt | DateTime? | Optional |  | Stores lastSyncAt (DateTime?). |
| lastSeenAt | DateTime? | Optional |  | Stores lastSeenAt (DateTime?). |
| apiKeyHash | String? | Optional |  | SHA-256 hardware key hash. |
| apiKeyLast4 | String | Required | "" | Stores apiKeyLast4 (String). |
| apiKeyCreatedAt | DateTime? | Optional |  | Stores apiKeyCreatedAt (DateTime?). |
| isActive | Boolean | Required | true | Stores isActive (Boolean). |
| isSimulated | Boolean | Required | true | Stores isSimulated (Boolean). |
| notes | String | Required | "" | Stores notes (String). |
| createdAt | DateTime | Required | now( | Creation timestamp. |
| updatedAt | DateTime | Required |  | Last update timestamp. |
| organizationId | String | Required |  | Tenant/organization scope key. |
| organization | Organization | Required |  | Prisma relation field. |
| syncLogs | DeviceSyncLog[] | Required |  | Stores syncLogs (DeviceSyncLog[]). |

### Model: DeviceSyncLog

| Field name | Type | Required / Optional | Default value | Description |
| --- | --- | --- | --- | --- |
| id | String | Required | cuid( | Primary identifier. |
| deviceId | String | Required |  | Stores deviceId (String). |
| device | BiometricDevice | Required |  | Prisma relation field. |
| employeeCode | String | Required |  | Stores employeeCode (String). |
| userId | String? | Optional |  | Related user identifier. |
| eventType | String | Required |  | Stores eventType (String). |
| eventTime | String | Required |  | Stores eventTime (String). |
| terminalEventId | String? | Optional |  | Stores terminalEventId (String?). |
| verificationMode | String | Required | "" | Stores verificationMode (String). |
| rawData | String | Required | "{}" | Stores rawData (String). |
| processed | Boolean | Required | false | Stores processed (Boolean). |
| createdAt | DateTime | Required | now( | Creation timestamp. |

### Model: GeoFenceZone

| Field name | Type | Required / Optional | Default value | Description |
| --- | --- | --- | --- | --- |
| id | String | Required | cuid( | Primary identifier. |
| name | String | Required |  | Stores name (String). |
| latitude | Float | Required |  | Stores latitude (Float). |
| longitude | Float | Required |  | Stores longitude (Float). |
| radiusMeters | Int | Required | 200 | Stores radiusMeters (Int). |
| isActive | Boolean | Required | true | Stores isActive (Boolean). |
| notes | String | Required | "" | Stores notes (String). |
| createdAt | DateTime | Required | now( | Creation timestamp. |
| updatedAt | DateTime | Required |  | Last update timestamp. |
| organizationId | String | Required |  | Tenant/organization scope key. |
| organization | Organization | Required |  | Prisma relation field. |

### Model: WeeklyReport

| Field name | Type | Required / Optional | Default value | Description |
| --- | --- | --- | --- | --- |
| id | String | Required | cuid( | Primary identifier. |
| userId | String | Required |  | Related user identifier. |
| user | User | Required |  | Prisma relation field. |
| startDate | String | Required |  | Stores startDate (String). |
| endDate | String | Required |  | Stores endDate (String). |
| status | String | Required | "draft" | Workflow/status value. |
| additionalNotes | String | Required | "" | Stores additionalNotes (String). |
| reviewNotes | String | Required | "" | Stores reviewNotes (String). |
| createdAt | DateTime | Required | now( | Creation timestamp. |
| updatedAt | DateTime | Required |  | Last update timestamp. |
| organizationId | String | Required |  | Tenant/organization scope key. |
| organization | Organization | Required |  | Prisma relation field. |
| activities | ReportActivity[] | Required |  | Stores activities (ReportActivity[]). |
| roadblocks | ReportRoadblock[] | Required |  | Stores roadblocks (ReportRoadblock[]). |
| plans | ReportUpcomingPlan[] | Required |  | Stores plans (ReportUpcomingPlan[]). |
| supportItems | ReportSupportItem[] | Required |  | Stores supportItems (ReportSupportItem[]). |
| insights | ReportInsight[] | Required |  | Stores insights (ReportInsight[]). |

### Model: ReportActivity

| Field name | Type | Required / Optional | Default value | Description |
| --- | --- | --- | --- | --- |
| id | String | Required | cuid( | Primary identifier. |
| reportId | String | Required |  | Stores reportId (String). |
| report | WeeklyReport | Required |  | Prisma relation field. |
| taskName | String | Required |  | Stores taskName (String). |
| type | String | Required |  | Stores type (String). |
| status | String | Required |  | Workflow/status value. |
| impact | String | Required | "" | Stores impact (String). |
| hoursSpent | Float | Required | 0 | Stores hoursSpent (Float). |
| links | String | Required | "" | Stores links (String). |

### Model: ReportRoadblock

| Field name | Type | Required / Optional | Default value | Description |
| --- | --- | --- | --- | --- |
| id | String | Required | cuid( | Primary identifier. |
| reportId | String | Required |  | Stores reportId (String). |
| report | WeeklyReport | Required |  | Prisma relation field. |
| challenge | String | Required |  | Stores challenge (String). |
| impact | String | Required | "" | Stores impact (String). |
| mitigation | String | Required | "" | Stores mitigation (String). |
| supportRequired | String | Required | "" | Stores supportRequired (String). |
| responsibleParty | String | Required | "" | Stores responsibleParty (String). |
| deadline | String | Required | "" | Stores deadline (String). |

### Model: ReportUpcomingPlan

| Field name | Type | Required / Optional | Default value | Description |
| --- | --- | --- | --- | --- |
| id | String | Required | cuid( | Primary identifier. |
| reportId | String | Required |  | Stores reportId (String). |
| report | WeeklyReport | Required |  | Prisma relation field. |
| plannedActivity | String | Required |  | Stores plannedActivity (String). |
| typeAssigned | String | Required | "Assigned" | Stores typeAssigned (String). |
| typeScope | String | Required | "Departmental" | Stores typeScope (String). |
| deliverables | String | Required | "" | Stores deliverables (String). |
| targetDate | String | Required | "" | Stores targetDate (String). |
| dependencies | String | Required | "" | Stores dependencies (String). |

### Model: ReportSupportItem

| Field name | Type | Required / Optional | Default value | Description |
| --- | --- | --- | --- | --- |
| id | String | Required | cuid( | Primary identifier. |
| reportId | String | Required |  | Stores reportId (String). |
| report | WeeklyReport | Required |  | Prisma relation field. |
| description | String | Required |  | Stores description (String). |
| supportType | String | Required | "" | Stores supportType (String). |
| requestedFrom | String | Required | "" | Stores requestedFrom (String). |
| urgency | String | Required | "medium" | Stores urgency (String). |
| dueDate | String | Required | "" | Stores dueDate (String). |

### Model: ReportInsight

| Field name | Type | Required / Optional | Default value | Description |
| --- | --- | --- | --- | --- |
| id | String | Required | cuid( | Primary identifier. |
| reportId | String | Required |  | Stores reportId (String). |
| report | WeeklyReport | Required |  | Prisma relation field. |
| insight | String | Required |  | Stores insight (String). |
| category | String | Required |  | Stores category (String). |
| impact | String | Required | "" | Stores impact (String). |

### Model: Notification

| Field name | Type | Required / Optional | Default value | Description |
| --- | --- | --- | --- | --- |
| id | String | Required | cuid( | Primary identifier. |
| message | String | Required |  | Stores message (String). |
| type | String | Required |  | Stores type (String). |
| metadata | Json | Required |  | JSON metadata payload. |
| isRead | Boolean | Required | false | Stores isRead (Boolean). |
| targetRole | String | Required |  | Stores targetRole (String). |
| createdAt | DateTime | Required | now( | Creation timestamp. |
| organizationId | String | Required |  | Tenant/organization scope key. |
| organization | Organization | Required |  | Prisma relation field. |

### Model: OvertimeRequest

| Field name | Type | Required / Optional | Default value | Description |
| --- | --- | --- | --- | --- |
| id | String | Required | cuid( | Primary identifier. |
| userId | String | Required |  | Related user identifier. |
| user | User | Required |  | Prisma relation field. |
| date | String | Required |  | Calendar date stored as string. |
| regularHours | Float | Required |  | Stores regularHours (Float). |
| overtimeHours | Float | Required |  | Stores overtimeHours (Float). |
| reason | String? | Optional |  | Stores reason (String?). |
| status | String | Required | "pending" | Workflow/status value. |
| reviewedBy | String? | Optional |  | Stores reviewedBy (String?). |
| reviewNotes | String? | Optional |  | Stores reviewNotes (String?). |
| createdAt | DateTime | Required | now( | Creation timestamp. |
| updatedAt | DateTime | Required |  | Last update timestamp. |
| organizationId | String | Required |  | Tenant/organization scope key. |
| organization | Organization | Required |  | Prisma relation field. |

### Model: PublicHoliday

| Field name | Type | Required / Optional | Default value | Description |
| --- | --- | --- | --- | --- |
| id | String | Required | cuid( | Primary identifier. |
| name | String | Required |  | Stores name (String). |
| date | String | Required |  | Calendar date stored as string. |
| type | String | Required | "public" | Stores type (String). |
| createdAt | DateTime | Required | now( | Creation timestamp. |
| organizationId | String | Required |  | Tenant/organization scope key. |
| organization | Organization | Required |  | Prisma relation field. |

### Model: EmployeeProfile

| Field name | Type | Required / Optional | Default value | Description |
| --- | --- | --- | --- | --- |
| id | String | Required | cuid( | Primary identifier. |
| userId | String | Required |  | Related user identifier. |
| user | User | Required |  | Prisma relation field. |
| employmentType | String | Required | "full_time" | Stores employmentType (String). |
| probationEndDate | String? | Optional |  | Stores probationEndDate (String?). |
| noticePeriodDays | Int | Required | 30 | Stores noticePeriodDays (Int). |
| salary | Float? | Optional |  | Stores salary (Float?). |
| bankName | String | Required | "" | Stores bankName (String). |
| bankAccount | String | Required | "" | Stores bankAccount (String). |
| emergencyContact | String | Required | "" | Stores emergencyContact (String). |
| emergencyPhone | String | Required | "" | Stores emergencyPhone (String). |
| onboardingStatus | String | Required | "pending" | Stores onboardingStatus (String). |
| offboardingStatus | String? | Optional |  | Stores offboardingStatus (String?). |
| terminationDate | String? | Optional |  | Stores terminationDate (String?). |
| terminationReason | String? | Optional |  | Stores terminationReason (String?). |
| organizationId | String | Required |  | Tenant/organization scope key. |
| organization | Organization | Required |  | Prisma relation field. |
| createdAt | DateTime | Required | now( | Creation timestamp. |
| updatedAt | DateTime | Required |  | Last update timestamp. |

### Model: Expense

| Field name | Type | Required / Optional | Default value | Description |
| --- | --- | --- | --- | --- |
| id | String | Required | cuid( | Primary identifier. |
| title | String | Required |  | Stores title (String). |
| amount | Float | Required |  | Stores amount (Float). |
| currency | String | Required | "GHS" | Stores currency (String). |
| category | String | Required |  | Stores category (String). |
| submittedBy | String | Required |  | Stores submittedBy (String). |
| user | User | Required |  | Prisma relation field. |
| status | String | Required | "pending" | Workflow/status value. |
| receiptUrl | String? | Optional |  | Stores receiptUrl (String?). |
| notes | String? | Optional |  | Stores notes (String?). |
| date | String | Required |  | Calendar date stored as string. |
| approvedBy | String? | Optional |  | Stores approvedBy (String?). |
| organizationId | String | Required |  | Tenant/organization scope key. |
| organization | Organization | Required |  | Prisma relation field. |
| createdAt | DateTime | Required | now( | Creation timestamp. |
| updatedAt | DateTime | Required |  | Last update timestamp. |

### Model: Budget

| Field name | Type | Required / Optional | Default value | Description |
| --- | --- | --- | --- | --- |
| id | String | Required | cuid( | Primary identifier. |
| name | String | Required |  | Stores name (String). |
| amount | Float | Required |  | Stores amount (Float). |
| spent | Float | Required | 0 | Stores spent (Float). |
| period | String | Required |  | Stores period (String). |
| category | String | Required |  | Stores category (String). |
| organizationId | String | Required |  | Tenant/organization scope key. |
| organization | Organization | Required |  | Prisma relation field. |
| createdAt | DateTime | Required | now( | Creation timestamp. |
| updatedAt | DateTime | Required |  | Last update timestamp. |

### Relations

- Department.organization -> Organization (fields: [organizationId], references: [id], onDelete: Cascade)
- User.department -> Department (fields: [departmentId], references: [id])
- User.organization -> Organization (fields: [organizationId], references: [id], onDelete: Cascade)
- User.assignedTasks -> Task[] ("TaskAssignee")
- User.createdTasks -> Task[] ("TaskCreator")
- User.reviewedTasks -> Task[] ("TaskReviewer")
- Session.user -> User (fields: [userId], references: [id], onDelete: Cascade)
- Task.assignee -> User ("TaskAssignee", fields: [assigneeId], references: [id])
- Task.creator -> User ("TaskCreator", fields: [creatorId], references: [id])
- Task.reviewer -> User ("TaskReviewer", fields: [reviewerId], references: [id])
- Task.department -> Department (fields: [departmentId], references: [id])
- Task.organization -> Organization (fields: [organizationId], references: [id], onDelete: Cascade)
- AttendanceRecord.user -> User (fields: [userId], references: [id], onDelete: Cascade)
- AttendanceRecord.organization -> Organization (fields: [organizationId], references: [id], onDelete: Cascade)
- LeaveRequest.user -> User (fields: [userId], references: [id], onDelete: Cascade)
- LeaveRequest.organization -> Organization (fields: [organizationId], references: [id], onDelete: Cascade)
- TaskComment.task -> Task (fields: [taskId], references: [id], onDelete: Cascade)
- TaskComment.user -> User (fields: [userId], references: [id], onDelete: Cascade)
- TaskTimeLog.task -> Task (fields: [taskId], references: [id], onDelete: Cascade)
- TaskTimeLog.user -> User (fields: [userId], references: [id], onDelete: Cascade)
- Shift.user -> User (fields: [userId], references: [id], onDelete: Cascade)
- Shift.organization -> Organization (fields: [organizationId], references: [id], onDelete: Cascade)
- BiometricDevice.organization -> Organization (fields: [organizationId], references: [id], onDelete: Cascade)
- DeviceSyncLog.device -> BiometricDevice (fields: [deviceId], references: [id], onDelete: Cascade)
- GeoFenceZone.organization -> Organization (fields: [organizationId], references: [id], onDelete: Cascade)
- WeeklyReport.user -> User (fields: [userId], references: [id], onDelete: Cascade)
- WeeklyReport.organization -> Organization (fields: [organizationId], references: [id], onDelete: Cascade)
- ReportActivity.report -> WeeklyReport (fields: [reportId], references: [id], onDelete: Cascade)
- ReportRoadblock.report -> WeeklyReport (fields: [reportId], references: [id], onDelete: Cascade)
- ReportUpcomingPlan.report -> WeeklyReport (fields: [reportId], references: [id], onDelete: Cascade)
- ReportSupportItem.report -> WeeklyReport (fields: [reportId], references: [id], onDelete: Cascade)
- ReportInsight.report -> WeeklyReport (fields: [reportId], references: [id], onDelete: Cascade)
- Notification.organization -> Organization (fields: [organizationId], references: [id], onDelete: Cascade)
- OvertimeRequest.user -> User (fields: [userId], references: [id], onDelete: Cascade)
- OvertimeRequest.organization -> Organization (fields: [organizationId], references: [id], onDelete: Cascade)
- PublicHoliday.organization -> Organization (fields: [organizationId], references: [id], onDelete: Cascade)
- EmployeeProfile.user -> User (fields: [userId], references: [id], onDelete: Cascade)
- EmployeeProfile.organization -> Organization (fields: [organizationId], references: [id], onDelete: Cascade)
- Expense.user -> User (fields: [submittedBy], references: [id])
- Expense.organization -> Organization (fields: [organizationId], references: [id], onDelete: Cascade)
- Budget.organization -> Organization (fields: [organizationId], references: [id], onDelete: Cascade)

### `@@unique` and `@@index` Constraints


- Department: @@unique([name, organizationId]) � enforces uniqueness/idempotency within a tenant or entity.
- Department: @@index([organizationId]) � accelerates tenant, relation, and filter lookups.
- User: @@index([departmentId]) � accelerates tenant, relation, and filter lookups.
- User: @@index([organizationId]) � accelerates tenant, relation, and filter lookups.
- Session: @@index([userId]) � accelerates tenant, relation, and filter lookups.
- Task: @@index([assigneeId]) � accelerates tenant, relation, and filter lookups.
- Task: @@index([creatorId]) � accelerates tenant, relation, and filter lookups.
- Task: @@index([reviewerId]) � accelerates tenant, relation, and filter lookups.
- Task: @@index([departmentId]) � accelerates tenant, relation, and filter lookups.
- Task: @@index([organizationId]) � accelerates tenant, relation, and filter lookups.
- AttendanceRecord: @@unique([userId, date]) � enforces uniqueness/idempotency within a tenant or entity.
- AttendanceRecord: @@index([userId]) � accelerates tenant, relation, and filter lookups.
- AttendanceRecord: @@index([organizationId]) � accelerates tenant, relation, and filter lookups.
- LeaveRequest: @@index([userId]) � accelerates tenant, relation, and filter lookups.
- LeaveRequest: @@index([organizationId]) � accelerates tenant, relation, and filter lookups.
- TaskComment: @@index([taskId]) � accelerates tenant, relation, and filter lookups.
- TaskComment: @@index([userId]) � accelerates tenant, relation, and filter lookups.
- TaskTimeLog: @@index([taskId]) � accelerates tenant, relation, and filter lookups.
- TaskTimeLog: @@index([userId]) � accelerates tenant, relation, and filter lookups.
- Shift: @@unique([userId, date]) � enforces uniqueness/idempotency within a tenant or entity.
- Shift: @@index([userId]) � accelerates tenant, relation, and filter lookups.
- Shift: @@index([organizationId]) � accelerates tenant, relation, and filter lookups.
- BiometricDevice: @@index([organizationId]) � accelerates tenant, relation, and filter lookups.
- DeviceSyncLog: @@unique([deviceId, terminalEventId]) � enforces uniqueness/idempotency within a tenant or entity.
- DeviceSyncLog: @@index([deviceId]) � accelerates tenant, relation, and filter lookups.
- DeviceSyncLog: @@index([userId]) � accelerates tenant, relation, and filter lookups.
- GeoFenceZone: @@index([organizationId]) � accelerates tenant, relation, and filter lookups.
- WeeklyReport: @@unique([userId, startDate]) � enforces uniqueness/idempotency within a tenant or entity.
- WeeklyReport: @@index([userId]) � accelerates tenant, relation, and filter lookups.
- WeeklyReport: @@index([organizationId]) � accelerates tenant, relation, and filter lookups.
- ReportActivity: @@index([reportId]) � accelerates tenant, relation, and filter lookups.
- ReportRoadblock: @@index([reportId]) � accelerates tenant, relation, and filter lookups.
- ReportUpcomingPlan: @@index([reportId]) � accelerates tenant, relation, and filter lookups.
- ReportSupportItem: @@index([reportId]) � accelerates tenant, relation, and filter lookups.
- ReportInsight: @@index([reportId]) � accelerates tenant, relation, and filter lookups.
- Notification: @@index([organizationId]) � accelerates tenant, relation, and filter lookups.
- OvertimeRequest: @@index([userId]) � accelerates tenant, relation, and filter lookups.
- OvertimeRequest: @@index([organizationId]) � accelerates tenant, relation, and filter lookups.
- PublicHoliday: @@unique([date, organizationId]) � enforces uniqueness/idempotency within a tenant or entity.
- PublicHoliday: @@index([organizationId]) � accelerates tenant, relation, and filter lookups.
- EmployeeProfile: @@index([userId]) � accelerates tenant, relation, and filter lookups.
- EmployeeProfile: @@index([organizationId]) � accelerates tenant, relation, and filter lookups.
- Expense: @@index([submittedBy]) � accelerates tenant, relation, and filter lookups.
- Expense: @@index([organizationId]) � accelerates tenant, relation, and filter lookups.
- Budget: @@index([organizationId]) � accelerates tenant, relation, and filter lookups.

## SECTION 5 — Database Migrations History

### iwms-api/prisma/migrations/20260619091653_init/migration.sql

- Migration name/timestamp: 20260619091653_init/migration.sql.

- Tables/columns added/changed/removed: Organization, Department, User, Session, Task, AttendanceRecord, LeaveRequest, TaskComment, TaskTimeLog, Shift, BiometricDevice, DeviceSyncLog, GeoFenceZone, WeeklyReport, ReportActivity, ReportRoadblock, ReportUpcomingPlan, ReportSupportItem, ReportInsight, Notification, OvertimeRequest.

- Indexes/constraints: Organization_name_key, Organization_joinCode_key, Department_organizationId_idx, Department_name_organizationId_key, User_email_key, User_departmentId_idx, User_organizationId_idx, Session_refreshToken_key, Session_userId_idx, Task_assigneeId_idx, Task_creatorId_idx, Task_reviewerId_idx, Task_departmentId_idx, Task_organizationId_idx, AttendanceRecord_userId_idx, AttendanceRecord_organizationId_idx, AttendanceRecord_userId_date_key, LeaveRequest_userId_idx, LeaveRequest_organizationId_idx, TaskComment_taskId_idx, TaskComment_userId_idx, TaskTimeLog_taskId_idx, TaskTimeLog_userId_idx, Shift_userId_idx, Shift_organizationId_idx, Shift_userId_date_key, BiometricDevice_organizationId_idx, DeviceSyncLog_deviceId_idx, DeviceSyncLog_userId_idx, DeviceSyncLog_deviceId_terminalEventId_key, GeoFenceZone_organizationId_idx, WeeklyReport_userId_idx, WeeklyReport_organizationId_idx, WeeklyReport_userId_startDate_key, ReportActivity_reportId_idx, ReportRoadblock_reportId_idx, ReportUpcomingPlan_reportId_idx, ReportSupportItem_reportId_idx, ReportInsight_reportId_idx, Notification_organizationId_idx, OvertimeRequest_userId_idx, OvertimeRequest_organizationId_idx.

- Why it existed: initial platform schema for core IWMS modules.

### iwms-api/prisma/migrations/20260619092738_add_public_holiday/migration.sql

- Migration name/timestamp: 20260619092738_add_public_holiday/migration.sql.

- Tables/columns added/changed/removed: PublicHoliday.

- Indexes/constraints: PublicHoliday_organizationId_idx, PublicHoliday_date_organizationId_key.

- Why it existed: adds holidays for attendance/absence handling.

### iwms-api/prisma/migrations/20260620054705_add_hr_and_finance_models/migration.sql

- Migration name/timestamp: 20260620054705_add_hr_and_finance_models/migration.sql.

- Tables/columns added/changed/removed: EmployeeProfile, Expense, Budget.

- Indexes/constraints: EmployeeProfile_userId_key, EmployeeProfile_userId_idx, EmployeeProfile_organizationId_idx, Expense_submittedBy_idx, Expense_organizationId_idx, Budget_organizationId_idx.

- Why it existed: adds HR employee profiles and Finance expense/budget models.

### iwms-api/prisma/migrations/migration_lock.toml

- Migration name/timestamp: migrations/migration_lock.toml.

- Tables/columns added/changed/removed: no table changes; metadata/lock file.

- Indexes/constraints: none.

- Why it existed: Prisma migration metadata.

## SECTION 6 — Backend API — Complete Route Map

### FILE: iwms-api/routes/attendance.js

PREFIX: /api/attendance

#### GET /live-feed

- Auth: YES

- Approx line: 44

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### GET /summary

- Auth: YES

- Approx line: 75

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### GET /timesheets

- Auth: YES

- Approx line: 183

- Query params: startDate, endDate, userId, departmentId

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### GET /timesheets/export

- Auth: YES

- Approx line: 277

- Query params: startDate, endDate, userId, departmentId

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### GET /

- Auth: YES

- Approx line: 446

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### GET /stats

- Auth: YES

- Approx line: 471

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /clock-in

- Auth: YES

- Approx line: 522

- Query params: none parsed

- Path params: none parsed

- Body fields: latitude, longitude, method

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /clock-out

- Auth: YES

- Approx line: 599

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /hardware-punch

- Auth: NO

- Approx line: 692

- Query params: none parsed

- Path params: none parsed

- Body fields: device_id, uid, name, event_type, timestamp, flags, terminal_event_id, terminalEventId, firmware

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### GET /presence

- Auth: YES

- Approx line: 983

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### PATCH /:id

- Auth: YES

- Approx line: 1067

- Query params: none parsed

- Path params: none parsed

- Body fields: clockIn, clockOut, status, method, notes, correctionReason

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

### FILE: iwms-api/routes/auth.js

PREFIX: /api/auth

#### POST /signup

- Auth: NO

- Approx line: 22

- Query params: none parsed

- Path params: none parsed

- Body fields: organizationName, userName, email, password

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /join

- Auth: NO

- Approx line: 125

- Query params: none parsed

- Path params: none parsed

- Body fields: joinCode, userName, email, password

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /login

- Auth: NO

- Approx line: 210

- Query params: none parsed

- Path params: none parsed

- Body fields: email, password

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /login/mfa

- Auth: NO

- Approx line: 278

- Query params: none parsed

- Path params: none parsed

- Body fields: tempToken, code

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /refresh

- Auth: NO

- Approx line: 358

- Query params: none parsed

- Path params: none parsed

- Body fields: refreshToken

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /logout

- Auth: YES

- Approx line: 390

- Query params: none parsed

- Path params: none parsed

- Body fields: refreshToken

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### GET /me

- Auth: YES

- Approx line: 399

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

### FILE: iwms-api/routes/departments.js

PREFIX: /api/departments

#### GET /

- Auth: YES

- Approx line: 5

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /

- Auth: YES

- Approx line: 15

- Query params: none parsed

- Path params: none parsed

- Body fields: name, color, managerId, managerName

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### PATCH /:id

- Auth: YES

- Approx line: 31

- Query params: none parsed

- Path params: none parsed

- Body fields: name, color, managerId, managerName, headcount

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

### FILE: iwms-api/routes/devices.js

PREFIX: /api/devices

#### GET /

- Auth: YES

- Approx line: 235

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /

- Auth: YES

- Approx line: 280

- Query params: none parsed

- Path params: none parsed

- Body fields: name, ipAddress, port, deviceType, location, serialNumber, firmwareVersion, hardwareModel, notes, isSimulated

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### PATCH /:id

- Auth: YES

- Approx line: 315

- Query params: none parsed

- Path params: id

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /:id/provision-key

- Auth: YES

- Approx line: 358

- Query params: none parsed

- Path params: id

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### DELETE /:id

- Auth: YES

- Approx line: 392

- Query params: none parsed

- Path params: id

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /:id/ping

- Auth: YES

- Approx line: 422

- Query params: none parsed

- Path params: id

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /:id/heartbeat

- Auth: NO

- Approx line: 474

- Query params: none parsed

- Path params: id

- Body fields: firmwareVersion, hardwareModel, batteryLevel, wifiRssi, freeMemory, uptimeSeconds

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /:id/events

- Auth: NO

- Approx line: 525

- Query params: none parsed

- Path params: id

- Body fields: employeeCode, eventType, eventTime, terminalEventId, verificationMode, confidence, batteryLevel, wifiRssi, firmwareVersion, rawData, processNow

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /:id/sync

- Auth: YES

- Approx line: 641

- Query params: none parsed

- Path params: id

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### GET /:id/logs

- Auth: YES

- Approx line: 723

- Query params: limit

- Path params: id

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /pairing-code

- Auth: NO

- Approx line: 753

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### GET /pair/status

- Auth: NO

- Approx line: 774

- Query params: code

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /pair

- Auth: YES

- Approx line: 805

- Query params: none parsed

- Path params: none parsed

- Body fields: code, name, location, notes

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /unknown-card

- Auth: NO

- Approx line: 865

- Query params: none parsed

- Path params: none parsed

- Body fields: uid, deviceSerial

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

### FILE: iwms-api/routes/finance.js

PREFIX: /api/finance

#### GET /dashboard

- Auth: YES

- Approx line: 38

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### GET /expenses

- Auth: YES

- Approx line: 122

- Query params: status, category, startDate, endDate

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /expenses

- Auth: YES

- Approx line: 165

- Query params: none parsed

- Path params: none parsed

- Body fields: title, amount, category, date, notes, receiptUrl

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### PATCH /expenses/:id

- Auth: YES

- Approx line: 191

- Query params: none parsed

- Path params: id

- Body fields: status, approvedBy

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### GET /budgets

- Auth: YES

- Approx line: 238

- Query params: period

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /budgets

- Auth: YES

- Approx line: 254

- Query params: none parsed

- Path params: none parsed

- Body fields: name, amount, period, category

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### PATCH /budgets/:id

- Auth: YES

- Approx line: 290

- Query params: none parsed

- Path params: id

- Body fields: name, amount, spent

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### GET /payroll-summary

- Auth: YES

- Approx line: 316

- Query params: period

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

### FILE: iwms-api/routes/geofence.js

PREFIX: /api/geofence

#### GET /

- Auth: YES

- Approx line: 18

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /

- Auth: YES

- Approx line: 28

- Query params: none parsed

- Path params: none parsed

- Body fields: name, latitude, longitude, radiusMeters, notes

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### PATCH /:id

- Auth: YES

- Approx line: 54

- Query params: none parsed

- Path params: id

- Body fields: name, latitude, longitude, radiusMeters, isActive, notes

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### DELETE /:id

- Auth: YES

- Approx line: 90

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /validate

- Auth: YES

- Approx line: 115

- Query params: none parsed

- Path params: none parsed

- Body fields: latitude, longitude

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

### FILE: iwms-api/routes/holidays.js

PREFIX: /api/holidays

#### GET /

- Auth: YES

- Approx line: 5

- Query params: year

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /

- Auth: YES

- Approx line: 25

- Query params: none parsed

- Path params: none parsed

- Body fields: name, date, type

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### DELETE /:id

- Auth: YES

- Approx line: 74

- Query params: none parsed

- Path params: id

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

### FILE: iwms-api/routes/hr.js

PREFIX: /api/hr

#### GET /dashboard

- Auth: YES

- Approx line: 38

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### GET /employees

- Auth: YES

- Approx line: 204

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### GET /employees/:id

- Auth: YES

- Approx line: 243

- Query params: none parsed

- Path params: id

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### PATCH /employees/:id/profile

- Auth: YES

- Approx line: 299

- Query params: none parsed

- Path params: id

- Body fields: employmentType, probationEndDate, noticePeriodDays, salary, bankName, bankAccount, emergencyContact, emergencyPhone, onboardingStatus, offboardingStatus, terminationDate, terminationReason

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /employees/:id/onboard

- Auth: YES

- Approx line: 356

- Query params: none parsed

- Path params: id

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /employees/:id/offboard

- Auth: YES

- Approx line: 366

- Query params: none parsed

- Path params: id

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### GET /leave-requests

- Auth: YES

- Approx line: 376

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### GET /headcount

- Auth: YES

- Approx line: 401

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

### FILE: iwms-api/routes/leaves.js

PREFIX: /api/leaves

#### GET /

- Auth: YES

- Approx line: 5

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /

- Auth: YES

- Approx line: 59

- Query params: none parsed

- Path params: none parsed

- Body fields: startDate, endDate, type, reason

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### PATCH /:id

- Auth: YES

- Approx line: 105

- Query params: none parsed

- Path params: id

- Body fields: status, managerNotes

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

### FILE: iwms-api/routes/management.js

PREFIX: /api/management

#### GET /dashboard

- Auth: YES

- Approx line: 5

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

### FILE: iwms-api/routes/mfa.js

PREFIX: /api/auth/mfa

#### POST /setup

- Auth: YES

- Approx line: 7

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /enable

- Auth: YES

- Approx line: 31

- Query params: none parsed

- Path params: none parsed

- Body fields: secret, token

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /disable

- Auth: YES

- Approx line: 61

- Query params: none parsed

- Path params: none parsed

- Body fields: token

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

### FILE: iwms-api/routes/notifications.js

PREFIX: /api/notifications

#### POST /test-email

- Auth: YES

- Approx line: 8

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /test-late-alert

- Auth: YES

- Approx line: 35

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /broadcast

- Auth: YES

- Approx line: 80

- Query params: none parsed

- Path params: none parsed

- Body fields: event, data

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### GET /socket-status

- Auth: YES

- Approx line: 103

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### GET /

- Auth: YES

- Approx line: 113

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /:id/read

- Auth: YES

- Approx line: 141

- Query params: none parsed

- Path params: id

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /read-all

- Auth: YES

- Approx line: 164

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

### FILE: iwms-api/routes/organization.js

PREFIX: /api/organization

#### GET /

- Auth: YES

- Approx line: 5

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /regenerate-code

- Auth: YES

- Approx line: 29

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### PATCH /

- Auth: YES

- Approx line: 65

- Query params: none parsed

- Path params: none parsed

- Body fields: name

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

### FILE: iwms-api/routes/overtime.js

PREFIX: /api/overtime

#### GET /

- Auth: YES

- Approx line: 5

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /

- Auth: YES

- Approx line: 43

- Query params: none parsed

- Path params: none parsed

- Body fields: userId, date, regularHours, overtimeHours, reason

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### PATCH /:id

- Auth: YES

- Approx line: 87

- Query params: none parsed

- Path params: id

- Body fields: status, reviewNotes

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

### FILE: iwms-api/routes/reports.js

PREFIX: /api/reports

#### GET /auto-populate

- Auth: YES

- Approx line: 19

- Query params: startDate, endDate

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### GET /my-reports

- Auth: YES

- Approx line: 98

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### GET /review-list

- Auth: YES

- Approx line: 113

- Query params: departmentId, employeeId, startDate, status

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### GET /:id

- Auth: YES

- Approx line: 187

- Query params: none parsed

- Path params: id

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /save

- Auth: YES

- Approx line: 235

- Query params: none parsed

- Path params: none parsed

- Body fields: startDate, endDate, additionalNotes, activities, roadblocks, plans, supportItems, insights, action // 'draft' or 'submit'

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /:id/review

- Auth: YES

- Approx line: 392

- Query params: none parsed

- Path params: id

- Body fields: status, reviewNotes

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### GET /:id/export

- Auth: YES

- Approx line: 440

- Query params: none parsed

- Path params: id

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

### FILE: iwms-api/routes/shifts.js

PREFIX: /api/shifts

#### GET /

- Auth: YES

- Approx line: 5

- Query params: startDate, endDate, departmentId, userId

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /

- Auth: YES

- Approx line: 51

- Query params: none parsed

- Path params: none parsed

- Body fields: userId, date, type, startTime, endTime, notes

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

### FILE: iwms-api/routes/tasks.js

PREFIX: /api/tasks

#### GET /

- Auth: YES

- Approx line: 5

- Query params: status, priority, assigneeId, projectId

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /

- Auth: YES

- Approx line: 78

- Query params: none parsed

- Path params: none parsed

- Body fields: title, description, assigneeId, reviewerId, priority, status, dueDate, tags, projectId, projectName, estimatedHours, departmentId

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### PATCH /:id

- Auth: YES

- Approx line: 165

- Query params: none parsed

- Path params: id

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### DELETE /:id

- Auth: YES

- Approx line: 310

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### GET /:id

- Auth: YES

- Approx line: 333

- Query params: none parsed

- Path params: id

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /:id/comments

- Auth: YES

- Approx line: 395

- Query params: none parsed

- Path params: id

- Body fields: content

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /:id/timelogs

- Auth: YES

- Approx line: 442

- Query params: none parsed

- Path params: id

- Body fields: hours, date, note

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

### FILE: iwms-api/routes/users.js

PREFIX: /api/users

#### GET /

- Auth: YES

- Approx line: 10

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### GET /:id

- Auth: YES

- Approx line: 66

- Query params: none parsed

- Path params: id

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### POST /

- Auth: YES

- Approx line: 119

- Query params: none parsed

- Path params: none parsed

- Body fields: name, email, password, roleName, position, phone, departmentName, joinDate, employeeCode

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### PATCH /:id

- Auth: YES

- Approx line: 170

- Query params: none parsed

- Path params: id

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

#### DELETE /:id

- Auth: YES

- Approx line: 229

- Query params: none parsed

- Path params: none parsed

- Body fields: none parsed

- Returns: JSON

- Side effects / Socket.io events emitted: none parsed

- Notes: Read the route body before editing for exact Prisma includes, validation, and flattened response shape. Authenticated routes generally scope by `organizationId`.

## SECTION 7 — Backend Library Files

### iwms-api/lib/cron.js

- Purpose: Background jobs and attendance stat helper.

- Exports/functions: startCronJobs, getAttendanceStats

- Cron jobs: 0 8 * * 1, 0 10 * * 1-5, * * * * *, 0 3 * * *, 0 0 * * *

- External services: node-cron

### iwms-api/lib/mailer.js

- Purpose: SMTP/Ethereal mailer and HTML templates.

- Exports/functions: sendMail, weeklyReportHtml, lateAlertHtml, overtimeAlertHtml, initMailer

- Cron jobs: none

- External services: Nodemailer/Ethereal SMTP

### iwms-api/lib/prisma.js

- Purpose: Shared Prisma client singleton.

- Exports/functions: module value only

- Cron jobs: none

- External services: Prisma/PostgreSQL

### iwms-api/lib/runtime.js

- Purpose: Runtime helpers for env, booleans, time math, and hardware API key hashing.

- Exports/functions: getSecret, parseBoolean, currentTimeHHMM, diffHoursHHMM, hashDeviceApiKey, isValidDeviceApiKey, toMinutes

- Cron jobs: none

- External services: none

## SECTION 8 — Frontend — Complete Page Map

### PAGE: iwms/src/app/attendance-dashboard/page.tsx

ROUTE: /attendance-dashboard

VISIBLE TO: protected by `AppLayout`; sidebar visibility controlled in `Sidebar.tsx`; direct page-level role checks vary by page.

Purpose: /attendance-dashboard page for its corresponding IWMS workflow.

API calls: attendanceApi.summary, attendanceApi.liveFeed

State variables: search: inferred default ''; deptFilter: inferred default 'all'; statusFilter: inferred default 'all'; methodFilter: inferred default 'all'

Socket.io events listened: none parsed

Known issues: Attendance table columns cut off on mobile.

Status: PARTIAL

### PAGE: iwms/src/app/attendance/page.tsx

ROUTE: /attendance

VISIBLE TO: protected by `AppLayout`; sidebar visibility controlled in `Sidebar.tsx`; direct page-level role checks vary by page.

Purpose: /attendance page for its corresponding IWMS workflow.

API calls: attendanceApi.list, attendanceApi.clockIn, attendanceApi.clockOut, departmentsApi.list, attendanceApi.stats, attendanceApi.correct

State variables: elapsed: inferred default 0; editRecord: any default null; editIn: inferred default ''; editOut: inferred default ''; editStatus: inferred default ''; correctionReason: inferred default ''

Socket.io events listened: export_reports, edit_attendance

Known issues: Attendance table columns cut off on mobile.

Status: PARTIAL

### PAGE: iwms/src/app/dashboard/page.tsx

ROUTE: /dashboard

VISIBLE TO: protected by `AppLayout`; sidebar visibility controlled in `Sidebar.tsx`; direct page-level role checks vary by page.

Purpose: /dashboard page for its corresponding IWMS workflow.

API calls: attendanceApi.stats, tasksApi.list, attendanceApi.list, managementApi.getDashboard

State variables: todoInput: inferred default ''; todos: { id: number; text: string; completed: boolean }[] default [
    { id: 1, text: 'Approve pending overtime requests', completed: false },
    { id: 2, text: 'Review HR onboarding checklist', completed: true },
    { id: 3, text: 'Audit geofence zone logs', completed: false },
  ]; applicantFilter: 'all' | 'shortlisted' | 'interviewing' default 'all'

Socket.io events listened: none parsed

Known issues: No known issue from prompt/source scan.

Status: WORKING/PARTIAL

### PAGE: iwms/src/app/department-dashboard/page.tsx

ROUTE: /department-dashboard

VISIBLE TO: protected by `AppLayout`; sidebar visibility controlled in `Sidebar.tsx`; direct page-level role checks vary by page.

Purpose: /department-dashboard page for its corresponding IWMS workflow.

API calls: usersApi.list, tasksApi.list, attendanceApi.presence, attendanceApi.list

State variables: searchQuery: inferred default ''

Socket.io events listened: none parsed

Known issues: Reported crash: T.filter is not a function.

Status: BROKEN

### PAGE: iwms/src/app/finance/page.tsx

ROUTE: /finance

VISIBLE TO: protected by `AppLayout`; sidebar visibility controlled in `Sidebar.tsx`; direct page-level role checks vary by page.

Purpose: /finance page for its corresponding IWMS workflow.

API calls: financeApi.getDashboard, financeApi.listExpenses, financeApi.listBudgets, financeApi.getPayrollSummary, financeApi.submitExpense, financeApi.approveExpense, financeApi.createBudget, financeApi.updateBudget

State variables: activeTab: Tab default 'dashboard'; periodFilter: inferred default currentPeriodStr; expenseSearch: inferred default ''; expenseStatusFilter: inferred default 'all'; expenseCategoryFilter: inferred default 'all'; isExpenseModalOpen: inferred default false; isBudgetModalOpen: inferred default false; isAdjustBudgetModalOpen: inferred default false; expenseForm: inferred default {
    title: '',
    amount: '',
    category: 'operations',
    date: new Date(; budgetForm: inferred default {
    name: '',
    amount: '',
    category: 'operations',
    period: currentPeriodStr
  }; adjustBudgetForm: inferred default {
    id: '',
    name: '',
    amount: '',
    spent: ''
  }

Socket.io events listened: none parsed

Known issues: No known issue from prompt/source scan.

Status: WORKING/PARTIAL

### PAGE: iwms/src/app/get-started/page.tsx

ROUTE: /get-started

VISIBLE TO: protected by `AppLayout`; sidebar visibility controlled in `Sidebar.tsx`; direct page-level role checks vary by page.

Purpose: /get-started page for its corresponding IWMS workflow.

API calls: none parsed

State variables: none parsed

Socket.io events listened: none parsed

Known issues: No known issue from prompt/source scan.

Status: WORKING/PARTIAL

### PAGE: iwms/src/app/holidays/page.tsx

ROUTE: /holidays

VISIBLE TO: protected by `AppLayout`; sidebar visibility controlled in `Sidebar.tsx`; direct page-level role checks vary by page.

Purpose: /holidays page for its corresponding IWMS workflow.

API calls: holidaysApi.list, holidaysApi.create, holidaysApi.remove

State variables: currentDate: inferred default new Date(; showAddModal: inferred default false; showDeleteModal: any default null; holidayName: inferred default ''; holidayDate: inferred default ''; holidayType: inferred default 'public'

Socket.io events listened: none parsed

Known issues: No known issue from prompt/source scan.

Status: WORKING/PARTIAL

### PAGE: iwms/src/app/hr/page.tsx

ROUTE: /hr

VISIBLE TO: protected by `AppLayout`; sidebar visibility controlled in `Sidebar.tsx`; direct page-level role checks vary by page.

Purpose: /hr page for its corresponding IWMS workflow.

API calls: hrApi.getDashboard, hrApi.listEmployees, hrApi.listLeaveRequests, hrApi.getHeadcount, hrApi.getEmployee, leavesApi.approve, hrApi.updateProfile, hrApi.onboard, hrApi.offboard

State variables: activeTab: Tab default 'dashboard'; searchQuery: inferred default ''; statusFilter: inferred default 'all'; selectedEmployeeId: string | null default null; inspectorTab: 'overview' | 'employment' | 'onboarding' | 'offboarding' default 'overview'

Socket.io events listened: none parsed

Known issues: No known issue from prompt/source scan.

Status: WORKING/PARTIAL

### PAGE: iwms/src/app/leave/page.tsx

ROUTE: /leave

VISIBLE TO: protected by `AppLayout`; sidebar visibility controlled in `Sidebar.tsx`; direct page-level role checks vary by page.

Purpose: /leave page for its corresponding IWMS workflow.

API calls: leavesApi.list, leavesApi.create, leavesApi.approve

State variables: startDate: inferred default ''; endDate: inferred default ''; type: inferred default 'vacation'; reason: inferred default ''; managerNotes: inferred default ''; showApplyModal: inferred default false; showApprovalModal: any default null

Socket.io events listened: none parsed

Known issues: No known issue from prompt/source scan.

Status: WORKING/PARTIAL

### PAGE: iwms/src/app/login/page.tsx

ROUTE: /login

VISIBLE TO: protected by `AppLayout`; sidebar visibility controlled in `Sidebar.tsx`; direct page-level role checks vary by page.

Purpose: /login page for its corresponding IWMS workflow.

API calls: none parsed

State variables: email: inferred default ''; password: inferred default ''; error: inferred default ''; loading: inferred default false; mfaRequired: inferred default false; tempToken: inferred default ''; mfaCode: inferred default ''

Socket.io events listened: none parsed

Known issues: No known issue from prompt/source scan.

Status: WORKING/PARTIAL

### PAGE: iwms/src/app/management/page.tsx

ROUTE: /management

VISIBLE TO: protected by `AppLayout`; sidebar visibility controlled in `Sidebar.tsx`; direct page-level role checks vary by page.

Purpose: /management page for its corresponding IWMS workflow.

API calls: managementApi.getDashboard, organizationApi.getDetails, usersApi.list, tasksApi.list, attendanceApi.list

State variables: selectedDeptId: string | null default null; sortField: 'tasksCompleted' | 'attendanceRate' | 'hoursWorked' default 'tasksCompleted'; sortOrder: 'asc' | 'desc' default 'desc'

Socket.io events listened: none parsed

Known issues: Department Performance chart empty and task status empty-state bug.

Status: PARTIAL

### PAGE: iwms/src/app/overtime/page.tsx

ROUTE: /overtime

VISIBLE TO: protected by `AppLayout`; sidebar visibility controlled in `Sidebar.tsx`; direct page-level role checks vary by page.

Purpose: /overtime page for its corresponding IWMS workflow.

API calls: overtimeApi.list, overtimeApi.review, overtimeApi.create

State variables: reviewNotes: inferred default ''; reviewingRequest: any default null; actionType: 'approved' | 'rejected' | null default null; showModal: inferred default false; logDate: inferred default ''; logRegularHours: inferred default 8; logOvertimeHours: inferred default 0; logReason: inferred default ''

Socket.io events listened: none parsed

Known issues: No known issue from prompt/source scan.

Status: WORKING/PARTIAL

### PAGE: iwms/src/app/page.tsx

ROUTE: /

VISIBLE TO: protected by `AppLayout`; sidebar visibility controlled in `Sidebar.tsx`; direct page-level role checks vary by page.

Purpose: / page for its corresponding IWMS workflow.

API calls: none parsed

State variables: none parsed

Socket.io events listened: none parsed

Known issues: No known issue from prompt/source scan.

Status: WORKING/PARTIAL

### PAGE: iwms/src/app/presence/page.tsx

ROUTE: /presence

VISIBLE TO: protected by `AppLayout`; sidebar visibility controlled in `Sidebar.tsx`; direct page-level role checks vary by page.

Purpose: /presence page for its corresponding IWMS workflow.

API calls: attendanceApi.presence

State variables: search: inferred default ''; activeStatus: string default 'all'; activeDept: string default 'all'; viewMode: 'grid' | 'table' default 'grid'

Socket.io events listened: none parsed

Known issues: Department tabs overflow without scroll on mobile.

Status: PARTIAL

### PAGE: iwms/src/app/register/page.tsx

ROUTE: /register

VISIBLE TO: protected by `AppLayout`; sidebar visibility controlled in `Sidebar.tsx`; direct page-level role checks vary by page.

Purpose: /register page for its corresponding IWMS workflow.

API calls: authApi.signup, authApi.join

State variables: mode: 'signup' | 'join' default 'signup'; organizationName: inferred default ''; joinCode: inferred default ''; userName: inferred default ''; email: inferred default ''; password: inferred default ''; error: inferred default ''; loading: inferred default false; success: inferred default false

Socket.io events listened: none parsed

Known issues: No known issue from prompt/source scan.

Status: WORKING/PARTIAL

### PAGE: iwms/src/app/reports/page.tsx

ROUTE: /reports

VISIBLE TO: protected by `AppLayout`; sidebar visibility controlled in `Sidebar.tsx`; direct page-level role checks vary by page.

Purpose: /reports page for its corresponding IWMS workflow.

API calls: attendanceApi.stats, tasksApi.list, usersApi.list

State variables: generating: inferred default false; generated: inferred default false

Socket.io events listened: none parsed

Known issues: No known issue from prompt/source scan.

Status: WORKING/PARTIAL

### PAGE: iwms/src/app/settings/page.tsx

ROUTE: /settings

VISIBLE TO: protected by `AppLayout`; sidebar visibility controlled in `Sidebar.tsx`; direct page-level role checks vary by page.

Purpose: /settings page for its corresponding IWMS workflow.

API calls: organizationApi.getDetails, organizationApi.updateDetails, organizationApi.regenerateCode, usersApi.list, devicesApi.list, geofenceApi.list, devicesApi.ping, devicesApi.sync, devicesApi.provisionKey, devicesApi.getLogs, devicesApi.create, devicesApi.pair, devicesApi.pushEvent, devicesApi.remove, geofenceApi.create, geofenceApi.remove, mfaApi.setup, mfaApi.enable, mfaApi.disable

State variables: mfaSetupData: { secret: string; qrCodeUrl: string } | null default null; mfaCode: inferred default ''; mfaDisableCode: inferred default ''; showMfaSetupModal: inferred default false; showMfaDisableModal: inferred default false; mfaError: inferred default ''; loading: inferred default false; devices: any[] default []; zones: any[] default []; usersList: any[] default []; loadingDevices: inferred default false; loadingZones: inferred default false; pingingId: string | null default null; syncingId: string | null default null; provisioningId: string | null default null; provisionedKey: { name: string; apiKey: string; apiKeyLast4: string } | null default null; showAddDeviceModal: inferred default false; showPairDeviceModal: inferred default false; showAddZoneModal: inferred default false; showLogsDrawer: inferred default false; selectedDevice: any | null default null; deviceLogs: any[] default []; loadingLogs: inferred default false; deviceName: inferred default ''; deviceIp: inferred default ''; devicePort: inferred default '4370'; deviceType: inferred default 'zkteco'; deviceLocation: inferred default ''; deviceSerial: inferred default ''; deviceNotes: inferred default ''; deviceIsSimulated: inferred default true; pairCode: inferred default ''; pairName: inferred default ''; pairLocation: inferred default ''; pairNotes: inferred default ''; pairing: inferred default false; punchEmployeeCode: inferred default ''; punchDeviceId: inferred default ''; punchType: inferred default 'check_in'; punchTime: inferred default ''; submittingPunch: inferred default false; zoneName: inferred default ''; zoneLat: inferred default ''; zoneLng: inferred default ''; zoneRadius: inferred default '200'; zoneNotes: inferred default ''; notifications: inferred default {
    email: true,
    push: true,
    weekly: true,
    alerts: false,
  }; securityLevel: inferred default 'standard'; orgDetails: { name: string; joinCode: string } | null default null; orgNameInput: inferred default ''; loadingOrg: inferred default false; savingOrg: inferred default false

Socket.io events listened: none parsed

Known issues: No known issue from prompt/source scan.

Status: WORKING/PARTIAL

### PAGE: iwms/src/app/tasks/page.tsx

ROUTE: /tasks

VISIBLE TO: protected by `AppLayout`; sidebar visibility controlled in `Sidebar.tsx`; direct page-level role checks vary by page.

Purpose: /tasks page for its corresponding IWMS workflow.

API calls: tasksApi.list, usersApi.list, tasksApi.update, tasksApi.remove, tasksApi.create

State variables: draggingId: string | null default null; filter: Priority | 'all' default 'all'; searchQ: inferred default ''; sortBy: 'dueDate' | 'priority' | 'title' default 'dueDate'; viewMode: 'kanban' | 'gantt' default 'kanban'; showModal: inferred default false; activeTaskId: string | null default null; activeDropStatus: Status | null default null; dragPreview: { task: any; x: number; y: number; width: number } | null default null; actionsMenuTaskId: string | null default null; actionsMenuPosition: { x: number; y: number } | null default null; newTask: inferred default { title: '', description: '', priority: 'medium' as Priority, dueDate: '', tags: '', assigneeId: '', reviewerId: '' }; otherDragging: { userName: string; taskTitle: string } | null default null

Socket.io events listened: assign_tasks

Known issues: Kanban board not horizontally scrollable on mobile.

Status: PARTIAL

### PAGE: iwms/src/app/team/[id]/page.tsx

ROUTE: /team/[id]

VISIBLE TO: protected by `AppLayout`; sidebar visibility controlled in `Sidebar.tsx`; direct page-level role checks vary by page.

Purpose: /team/[id] page for its corresponding IWMS workflow.

API calls: shiftsApi.list, shiftsApi.create, usersApi.get, departmentsApi.list, usersApi.update, attendanceApi.list, tasksApi.list, leavesApi.list

State variables: showShiftModal: inferred default false; shiftDate: inferred default ''; shiftType: inferred default 'day'; shiftStart: inferred default '09:00'; shiftEnd: inferred default '17:00'; shiftNotes: inferred default ''; shiftError: inferred default ''; showEditProfileModal: inferred default false; editName: inferred default ''; editPosition: inferred default ''; editPhone: inferred default ''; editEmployeeCode: inferred default ''; editDepartmentName: inferred default ''; editRoleName: inferred default ''; editStatus: inferred default ''; editPassword: inferred default ''; editError: inferred default ''

Socket.io events listened: none parsed

Known issues: No known issue from prompt/source scan.

Status: WORKING/PARTIAL

### PAGE: iwms/src/app/team/page.tsx

ROUTE: /team

VISIBLE TO: protected by `AppLayout`; sidebar visibility controlled in `Sidebar.tsx`; direct page-level role checks vary by page.

Purpose: /team page for its corresponding IWMS workflow.

API calls: usersApi.list, departmentsApi.list, usersApi.create

State variables: view: 'grid' | 'list' default 'grid'; activeDept: inferred default 'all'; searchQ: inferred default ''; showAddModal: inferred default false; newUser: inferred default { name: '', email: '', department: 'Engineering', position: '', role: 'employee', password: 'Welcome123!' }

Socket.io events listened: manage_users

Known issues: No known issue from prompt/source scan.

Status: WORKING/PARTIAL

### PAGE: iwms/src/app/timesheets/page.tsx

ROUTE: /timesheets

VISIBLE TO: protected by `AppLayout`; sidebar visibility controlled in `Sidebar.tsx`; direct page-level role checks vary by page.

Purpose: /timesheets page for its corresponding IWMS workflow.

API calls: attendanceApi.timesheets, departmentsApi.list, attendanceApi.exportTimesheets

State variables: currentMonday: Date default (; deptFilter: inferred default 'all'; selectedCell: { employeeName: string; day: any } | null default null

Socket.io events listened: export_reports

Known issues: Timesheets table columns cut off on mobile.

Status: PARTIAL

### PAGE: iwms/src/app/weekly-reports/page.tsx

ROUTE: /weekly-reports

VISIBLE TO: protected by `AppLayout`; sidebar visibility controlled in `Sidebar.tsx`; direct page-level role checks vary by page.

Purpose: /weekly-reports page for its corresponding IWMS workflow.

API calls: reportsApi.myReports, reportsApi.reviewList, usersApi.list, departmentsApi.list, reportsApi.autoPopulate, reportsApi.save, reportsApi.review, reportsApi.exportDocx, reportsApi.get

State variables: activeTab: 'my' | 'team' default 'my'; editingReport: any | null default null; viewingReport: any | null default null; selectedWeek: inferred default weeks[0]; reviewNotes: inferred default ''; submittingReview: inferred default false; exportingId: string | null default null; filterDept: inferred default ''; filterEmp: inferred default ''; filterWeek: inferred default ''; filterStatus: inferred default ''; activities: any[] default []; roadblocks: any[] default []; plans: any[] default []; supportItems: any[] default []; insights: any[] default []; additionalNotes: inferred default ''

Socket.io events listened: none parsed

Known issues: No known issue from prompt/source scan.

Status: WORKING/PARTIAL

## SECTION 9 — Frontend Components

### iwms/src/components/AppLayout.tsx

- Component name: AppLayout

- What it renders: reusable AppLayout UI for layout, metrics, tasks, charts, notifications, or navigation.

- Props: { children }: { children: React.ReactNode }

- Internal state: mobileSidebarOpen (inferred) default false

- Events/callbacks: onMobileClose, onClick, onMenuClick

- Known issues: no component-local issue found beyond page-level bugs.

### iwms/src/components/GanttChart.tsx

- Component name: GanttChart

- What it renders: reusable GanttChart UI for layout, metrics, tasks, charts, notifications, or navigation.

- Props: { tasks, onTaskClick }: { tasks: Task[]; onTaskClick: (id: string

- Internal state: none parsed

- Events/callbacks: onTaskClick, onMouseEnter, onMouseLeave, onClick

- Known issues: no component-local issue found beyond page-level bugs.

### iwms/src/components/KpiCard.tsx

- Component name: KpiCard

- What it renders: reusable KpiCard UI for layout, metrics, tasks, charts, notifications, or navigation.

- Props: { icon: Icon, iconColor, iconBg, label, value, subLabel, subValue, subColor, linkLabel, onLinkClick, }: KpiCardProps

- Internal state: none parsed

- Events/callbacks: onColor, onBg, onLinkClick, onClick

- Known issues: no component-local issue found beyond page-level bugs.

### iwms/src/components/Sidebar.tsx

- Component name: Sidebar

- What it renders: reusable Sidebar UI for layout, metrics, tasks, charts, notifications, or navigation.

- Props: { mobileOpen, onMobileClose }: SidebarProps = {}

- Internal state: collapsed (boolean) default (

- Events/callbacks: onLeft, onRight, onMobileClose, onClick

- Known issues: no component-local issue found beyond page-level bugs.

### iwms/src/components/TaskDetailPanel.tsx

- Component name: TaskDetailPanel

- What it renders: reusable TaskDetailPanel UI for layout, metrics, tasks, charts, notifications, or navigation.

- Props: { taskId, onClose }: { taskId: string; onClose: (

- Internal state: activeTab ('comments' | 'timelogs') default 'comments'; commentContent (inferred) default ''; hours (inferred) default ''; logDate (inferred) default new Date(; logNote (inferred) default ''

- Events/callbacks: onClose, onFn, onSuccess, onError, onClick, onSubmit, onChange

- Known issues: no component-local issue found beyond page-level bugs.

### iwms/src/components/Toast.tsx

- Component name: useToast

- What it renders: reusable useToast UI for layout, metrics, tasks, charts, notifications, or navigation.

- Props: No explicit props parsed

- Internal state: toasts (ToastMessage[]) default []; isRemoving (inferred) default false

- Events/callbacks: onClose, onClick, onDuration

- Known issues: no component-local issue found beyond page-level bugs.

### iwms/src/components/TopBar.tsx

- Component name: TopBar

- What it renders: reusable TopBar UI for layout, metrics, tasks, charts, notifications, or navigation.

- Props: { onMenuClick }: { onMenuClick?: (

- Internal state: time (inferred) default ''; notifOpen (inferred) default false; showLogoutConfirm (inferred) default false; notifications (
    { id: string; text: string; time: string; type: 'info' | 'success' | 'warning' | 'error' | 'task'; metadata?: { uid?: string; deviceSerial?: string } }[]
  ) default [
    { id: 'static-1', text: 'Weekly report scheduled for Monday 8:00 AM', time: 'System', type: 'info' },
    { id: 'static-2', text: 'Real-time synchronization engine is online.', time: 'System', type: 'success' },
  ]

- Events/callbacks: onDown, onMenuClick, onClick, onMouseEnter, onMouseLeave

- Known issues: no component-local issue found beyond page-level bugs.

## SECTION 10 — Frontend Hooks and Lib Files

### iwms/src/hooks/useSocket.ts

- Purpose: Hook/helper module.

- Exports: useSocket, useSocketEvent

- Side effects: none parsed

### iwms/src/lib/api.ts

- Purpose: Axios REST client, token helpers, refresh interceptor, typed API modules.

- Exports: api, getAccessToken, setTokens, clearTokens, authApi, organizationApi, usersApi, departmentsApi, tasksApi, attendanceApi, leavesApi, shiftsApi, mfaApi, devicesApi, geofenceApi, reportsApi, notificationsApi, overtimeApi, holidaysApi, managementApi, hrApi, financeApi

- Side effects: localStorage token/user persistence; Axios client and interceptors

### iwms/src/lib/auth-context.tsx

- Purpose: Auth context, login/MFA/logout, permission check, post-login routing.

- Exports: Role, Permission, User, AuthProvider, useAuth, getPostLoginRoute

- Side effects: localStorage token/user persistence

### iwms/src/lib/mock-data.ts

- Purpose: Legacy/demo data and types.

- Exports: Role, User, AttendanceRecord, Task, Department, DEPARTMENTS, USERS, ATTENDANCE, TASKS, WEEKLY_ATTENDANCE, MONTHLY_TREND, TASK_STATUS_COUNTS, DEMO_USERS

- Side effects: none parsed

### iwms/src/lib/query-provider.tsx

- Purpose: React Query provider defaults.

- Exports: QueryProvider

- Side effects: React Query client defaults

### iwms/src/lib/socket.ts

- Purpose: Socket.io connection and event helper.

- Exports: getSocket, connectSocket, disconnectSocket, SocketEvent

- Side effects: Socket.io client

## SECTION 11 — Authentication System (Complete)

1. Registration: `/api/auth/signup` creates an organization and first user; `/api/auth/join` adds a user to an org by join code. Passwords are bcrypt hashed.

2. Login: frontend `AuthProvider.login` calls `/api/auth/login`; if MFA is enabled backend returns `mfaRequired` and `tempToken`; frontend calls `/api/auth/login/mfa` with TOTP code.

3. Token storage: `iwms_access_token`, `iwms_refresh_token`, and `iwms_user` in localStorage.

4. Token refresh: Axios 401 interceptor posts refresh token to `/api/auth/refresh`, updates access token, retries queued requests, or clears storage and redirects.

5. Route protection: frontend `AppLayout`; backend `fastify.authenticate` with JWT verify.

6. Roles: `super_admin`, `admin`, `hr_manager`, `manager`, `team_lead`, `employee`; permissions are stored in frontend user object and checked with `hasPermission`.

7. Department gates: HR and Finance sidebar entries are department-aware; task assignment uses department and position rules; managers often see their department.

8. Session model: `Session` stores user, refresh token, expiry, and creation time; sessions are created during auth flows, deleted on logout, and cleaned by 03:00 cron.

## SECTION 12 — Socket.io Event Map (Complete)

| Event Name | Direction | Emitted By | Listened By | Payload Shape | When Triggered |
| --- | --- | --- | --- | --- | --- |
| assign_tasks | client listens | N/A | iwms/src/app/tasks/page.tsx | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| attendance:clockIn | server -> client / client listens | iwms-api/routes/attendance.js | iwms/src/components/AppLayout.tsx, iwms/src/components/TopBar.tsx | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| attendance:clockOut | server -> client / client listens | iwms-api/routes/attendance.js | iwms/src/components/AppLayout.tsx, iwms/src/components/TopBar.tsx | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| attendance:late | server -> client | iwms-api/routes/attendance.js | N/A | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| attendance:lateAlert | server -> client / client listens | iwms-api/routes/notifications.js, iwms-api/lib/cron.js | iwms/src/components/AppLayout.tsx, iwms/src/components/TopBar.tsx | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| attendance:updated | server -> client | iwms-api/routes/attendance.js | N/A | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| connect | client listens | N/A | iwms/src/lib/socket.ts | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| connect_error | client listens | N/A | iwms/src/lib/socket.ts | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| device:added | server -> client | iwms-api/routes/devices.js | N/A | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| device:eventAdded | server -> client | iwms-api/routes/devices.js | N/A | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| device:heartbeat | server -> client | iwms-api/routes/devices.js | N/A | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| device:ping | server -> client | iwms-api/routes/devices.js | N/A | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| device:removed | server -> client | iwms-api/routes/devices.js | N/A | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| device:synced | server -> client | iwms-api/routes/devices.js | N/A | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| disconnect | client -> server / client listens | iwms-api/server.js | iwms/src/lib/socket.ts | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| edit_attendance | client listens | N/A | iwms/src/app/attendance/page.tsx | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| export_reports | client listens | N/A | iwms/src/app/attendance/page.tsx, iwms/src/app/timesheets/page.tsx | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| holiday:created | server -> client | iwms-api/routes/holidays.js | N/A | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| holiday:deleted | server -> client | iwms-api/routes/holidays.js | N/A | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| leave:created | server -> client | iwms-api/routes/leaves.js | N/A | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| leave:updated | server -> client | iwms-api/routes/leaves.js | N/A | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| manage_users | client listens | N/A | iwms/src/app/team/page.tsx | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| notification:new | server -> client / client listens | iwms-api/routes/devices.js | iwms/src/components/TopBar.tsx | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| overtime:created | server -> client | iwms-api/routes/overtime.js | N/A | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| overtime:updated | server -> client | iwms-api/routes/overtime.js | N/A | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| report:generated | server -> client | iwms-api/lib/cron.js | N/A | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| shift:updated | server -> client | iwms-api/routes/shifts.js | N/A | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| stats:request | client -> server | iwms-api/server.js, iwms/src/lib/socket.ts | N/A | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| stats:update | server -> client | iwms-api/server.js, iwms-api/lib/cron.js | N/A | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| task:approved | server -> client / client listens | iwms-api/routes/tasks.js | iwms/src/components/TopBar.tsx | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| task:commentAdded | server -> client | iwms-api/routes/tasks.js | N/A | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| task:dragEnd | client -> server | iwms-api/server.js, iwms/src/app/tasks/page.tsx | N/A | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| task:dragStart | client -> server | iwms-api/server.js, iwms/src/app/tasks/page.tsx | N/A | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| task:dragged | server -> client | iwms-api/server.js | N/A | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| task:reviewRequested | server -> client / client listens | iwms-api/routes/tasks.js | iwms/src/components/TopBar.tsx | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |
| task:updated | server -> client / client listens | iwms-api/routes/tasks.js | iwms/src/components/AppLayout.tsx, iwms/src/components/TopBar.tsx | See emitting route/server/cron source for exact object. Common fields include ids, title/name, timestamps, status, and org/user context. | Triggered by listed source files. |

## SECTION 13 — Hardware Integration (Pico Firmware)

Hardware components and wiring: ILI9341 TFT SPI0 GP14-CS, GP15-RST, GP16-MISO, GP17-DC, GP18-SCK, GP19-MOSI; XPT2046 touch SPI1 GP9-IRQ, GP10-SCK, GP11-MOSI, GP12-MISO, GP13-CS; MFRC522 RFID GP0-RST, GP2-SCK, GP3-MOSI, GP4-MISO, GP5-CS; buzzer GP1; DS1302 GP20 CLK, GP21 DAT, GP22 RST; reset/provisioning button GP6.

- das/.gitignore: vendored driver asset/documentation/support file.

- das/cleanup_userdb.py: classes none; functions top-level script.

- das/clear_logs.py: classes none; functions top-level script.

- das/clear_queue.py: classes none; functions top-level script.

- das/config.py: classes none; functions top-level script.

- das/ds1302.py: classes DS1302; functions __init__, _b2d, _d2b, _write_byte, _read_byte, _write_reg, _read_reg, _unlock, _lock, datetime, is_running, start.

- das/main.py: classes Touch; functions beep, __init__, read, _read_channel, _map, load_json, save_json, _rtc_tuple, get_display_time, get_iso_timestamp, get_hour_minute, hours_worked, cleanup_logs, draw_header, draw_main_desktop, process_rfid_scan, app_register, app_logs, app_data_dump, app_about.

- das/micropython-ili9341-master/font_to_py.py: classes ByteWriter, Bitmap, Glyph, Font; functions __init__, _eol, _eot, _bol, obyte, odata, eot, var_write, __init__, display, bitblt, get_hbyte, get_vbyte, __init__, width, height, from_glyphslot, unpack_mono_bitmap, __init__, get_dimensions, _glyph_for_character, _render_char, stream_char, build_arrays, build_binary_array, _chr_addr, get_width, get_ch, write_func, write_font, write_data, write_binary_font, quit.

- das/micropython-ili9341-master/glcdfont.py: classes none; functions height, max_width, hmap, reverse, monospaced, min_ch, max_ch, get_width, get_ch.

- das/micropython-ili9341-master/ili934xnew.py: classes ILI9341; functions color565, __init__, set_color, set_pos, reset_scroll, set_font, init, reset, _write, _data, _writeblock, _readblock, _read, pixel, fill_rectangle, erase, blit, chars, scroll, next_line, write, print.

- das/micropython-ili9341-master/image/m5stack.jpg: vendored driver asset/documentation/support file.

- das/micropython-ili9341-master/image/rotations.png: vendored driver asset/documentation/support file.

- das/micropython-ili9341-master/LICENSE: vendored driver asset/documentation/support file.

- das/micropython-ili9341-master/m5stack.py: classes none; functions top-level script.

- das/micropython-ili9341-master/main.py: classes none; functions top-level script.

- das/micropython-ili9341-master/README.md: vendored driver asset/documentation/support file.

- das/micropython-ili9341-master/rotations_test.py: classes none; functions top-level script.

- das/micropython-ili9341-master/tt14.py: classes none; functions height, max_width, hmap, reverse, monospaced, min_ch, max_ch, _chr_addr, get_width, get_ch.

- das/micropython-ili9341-master/tt24.py: classes none; functions height, max_width, hmap, reverse, monospaced, min_ch, max_ch, _chr_addr, get_width, get_ch.

- das/micropython-ili9341-master/tt32.py: classes none; functions height, max_width, hmap, reverse, monospaced, min_ch, max_ch, _chr_addr, get_width, get_ch.

- das/micropython-mfrc522-master/.gitignore: vendored driver asset/documentation/support file.

- das/micropython-mfrc522-master/deploy_esp.sh: vendored driver asset/documentation/support file.

- das/micropython-mfrc522-master/deploy_wipy.sh: vendored driver asset/documentation/support file.

- das/micropython-mfrc522-master/examples/MultiReaders.py: classes Readers; functions uidToString, __init__, add, checkReader, checkAnyReader.

- das/micropython-mfrc522-master/examples/read.py: classes none; functions do_read.

- das/micropython-mfrc522-master/examples/write.py: classes none; functions do_write.

- das/micropython-mfrc522-master/LICENSE: vendored driver asset/documentation/support file.

- das/micropython-mfrc522-master/mfrc522.py: classes MFRC522; functions __init__, _wreg, _rreg, _sflags, _cflags, _tocard, _crc, init, reset, antenna_on, request, anticoll, select_tag, auth, stop_crypto1, read, write.

- das/micropython-mfrc522-master/Pico_example/CreateNdefTag.py: classes none; functions checksum.

- das/micropython-mfrc522-master/Pico_example/EraseNdefTag.py: classes none; functions top-level script.

- das/micropython-mfrc522-master/Pico_example/Pico_read.py: classes none; functions uidToString.

- das/micropython-mfrc522-master/Pico_example/Pico_write.py: classes none; functions uidToString.

- das/micropython-mfrc522-master/Pico_example/Read4Readers.py: classes myRFIDReader; functions uidToString, __init__, Read.

- das/micropython-mfrc522-master/Pico_example/ReadNdefTag.py: classes none; functions top-level script.

- das/micropython-mfrc522-master/README.md: vendored driver asset/documentation/support file.

- das/micropython-mfrc522-master/RfidAccess.py: classes RfidAccess; functions __init__, findAccessIndex, setTrailerAccess, setBlockAccess, encodeAccess, decodeAccess, decodeAccessFromBlock3, showTrailerAccess, showBlockAccess, showAccess, fillBlock3.

- das/pairing.py: classes none; functions start_pairing_flow.

- das/provisioning.py: classes DNSServer, IN; functions __init__, handle, close, url_decode, parse_urlencoded, build_setup_page, start_provisioning.

- das/set_time.py: classes none; functions top-level script.

- das/wifi_sync.py: classes WiFiSync; functions __init__, connect, poll_connect, disconnect, is_connected, ip_address, tick, send_heartbeat, post_event, flush_queue, queue_length, _terminal_event_id, _try_post, _load_queue, _enqueue, _save_queue, post_unknown_card.

Full attendance punch flow: scan card in `main.py`, lookup UID in local `user_db.json`, determine event type and flags using RTC/config rules, log locally, POST via `WiFiSync.post_event`, then show display/buzzer feedback. Unknown cards are posted to `/api/devices/unknown-card` when online.

Offline queue: `wifi_sync.py` stores temporary network/server failures in `offline_queue.json`, caps with `MAX_QUEUE_SIZE`, and `flush_queue()` retries when WiFi is connected; 404/409 are discarded during flush.

DS1302 RTC: `ds1302.py` reads/writes BCD registers; `set_time.py` sets time once; `main.py` only defaults invalid years.

WiFi sync module: `connect`, `poll_connect`, `tick`, `send_heartbeat`, `post_event`, `flush_queue`, `post_unknown_card`.

Provisioning flow: `provisioning.py` opens AP `IWMS-Setup`, serves setup form, writes `local_config.json`, reboots. Pairing flow uses `pairing.py` and backend device pairing/provision-key routes.

Configuration variables: DS1302 pins, WiFi credentials/timeouts, provisioning SSID/reset pin, server URL, punch endpoint, device id/name/key/firmware, attendance thresholds, local DB/log/queue files, queue limit, retry intervals, cleanup interval.

Known limitations: local UID database must be maintained; LAN URL cannot be localhost; no TLS/cert handling shown for Pico; validation failures are not queued; vendored drivers are included directly.

## SECTION 14 — What Is Fully Working

| Feature name | Frontend page/component | Backend endpoint(s) | Hardware involvement | Confirmation |
| --- | --- | --- | --- | --- |
| Auth login/refresh/logout | /login, AuthProvider | /api/auth/login, /api/auth/refresh, /api/auth/logout | None | Implemented in code; not runtime-tested in this documentation pass. |
| Attendance clock in/out | /attendance ClockWidget | /api/attendance/clock-in, /api/attendance/clock-out | Optional geolocation and Pico punch ingestion | Implemented with Socket.io events. |
| Task CRUD/comments/time logs | /tasks, TaskDetailPanel | /api/tasks* | None | Implemented with realtime task events. |
| Leave/overtime/holidays | /leave, /overtime, /holidays | /api/leaves, /api/overtime, /api/holidays | None | Implemented in frontend/backend. |
| Pico heartbeat/punch sync | Firmware scripts plus device APIs | /api/devices/*, /api/attendance/hardware-punch | Pico 2 W RFID terminal | Code exists; physical hardware not tested in this pass. |

## SECTION 15 — What Is Partially Built

| Feature name | What is built | What is missing | Files involved | Estimated effort |
| --- | --- | --- | --- | --- |
| HR module | Schema/API/page wrappers | Workflow polish, validation, access audit | iwms/src/app/hr/page.tsx; iwms-api/routes/hr.js | M |
| Finance module | Schema/API/page wrappers | Payroll/budget completeness and permission consistency | iwms/src/app/finance/page.tsx; iwms-api/routes/finance.js | M |
| Hardware provisioning/pairing | Firmware and backend routes | Documented production rollout and UI confirmation | das/*; iwms-api/routes/devices.js | M |
| Responsive mobile polish | Some overflow wrappers/classes | Known table/tab/Kanban fixes | attendance/tasks/timesheets/presence pages | S-M |

## SECTION 16 — Known Bugs (Current)

| Bug ID | Page or component affected | Exact error message if applicable | Root cause | Severity | Fix location |
| --- | --- | --- | --- | --- | --- |
| BUG-01 | /my-team page (actual route appears to be /department-dashboard) | T.filter is not a function | Likely non-array API data passed to `.filter`; normalize with `Array.isArray` and inspect management/team response shape. | Critical | iwms/src/app/department-dashboard/page.tsx |
| BUG-02 | Kanban board | No exception; board not horizontally scrollable on mobile | Kanban columns need overflow-x wrapper/min-width handling. | High | iwms/src/app/tasks/page.tsx |
| BUG-03 | Timesheets table | No exception; columns cut off on mobile | Table needs responsive overflow/min-width wrapper. | Medium | iwms/src/app/timesheets/page.tsx |
| BUG-04 | Management Dashboard Department Performance chart | Chart renders with no bars | Data shape/dataKey mismatch or empty response handling. | High | iwms/src/app/management/page.tsx and iwms-api/routes/management.js |
| BUG-05 | Task Status Distribution | Shows `No 0 TOTAL TASKS` when empty | Empty-state text/count composition is wrong. | Low | iwms/src/app/management/page.tsx |
| BUG-06 | Attendance table | No exception; columns cut off on mobile | Attendance table needs responsive overflow/min-width wrapper. | Medium | iwms/src/app/attendance/page.tsx |
| BUG-07 | Team Presence mobile tabs | No exception; department tabs overflow without scroll | Tabs need horizontal scroll and stable widths. | Medium | iwms/src/app/presence/page.tsx |

## SECTION 17 — Responsiveness Status

| Page | 375px | 768px | 1024px | 1440px | Notes |
| --- | --- | --- | --- | --- | --- |
| /attendance-dashboard | ⚠️ Issues | ⚠️ Issues | ✅ Good | ✅ Good | Attendance table clipping. |
| /attendance | ⚠️ Issues | ⚠️ Issues | ✅ Good | ✅ Good | Attendance table clipping. |
| /dashboard | ✅ Good | ✅ Good | ✅ Good | ✅ Good | No known responsive issue. |
| /department-dashboard | ✅ Good | ✅ Good | ✅ Good | ✅ Good | No known responsive issue. |
| /finance | ✅ Good | ✅ Good | ✅ Good | ✅ Good | No known responsive issue. |
| /get-started | ✅ Good | ✅ Good | ✅ Good | ✅ Good | No known responsive issue. |
| /holidays | ✅ Good | ✅ Good | ✅ Good | ✅ Good | No known responsive issue. |
| /hr | ✅ Good | ✅ Good | ✅ Good | ✅ Good | No known responsive issue. |
| /leave | ✅ Good | ✅ Good | ✅ Good | ✅ Good | No known responsive issue. |
| /login | ✅ Good | ✅ Good | ✅ Good | ✅ Good | No known responsive issue. |
| /management | ✅ Good | ✅ Good | ✅ Good | ✅ Good | No known responsive issue. |
| /overtime | ✅ Good | ✅ Good | ✅ Good | ✅ Good | No known responsive issue. |
| / | ✅ Good | ✅ Good | ✅ Good | ✅ Good | No known responsive issue. |
| /presence | ⚠️ Issues | ✅ Good | ✅ Good | ✅ Good | Tabs overflow on mobile. |
| /register | ✅ Good | ✅ Good | ✅ Good | ✅ Good | No known responsive issue. |
| /reports | ✅ Good | ✅ Good | ✅ Good | ✅ Good | No known responsive issue. |
| /settings | ✅ Good | ✅ Good | ✅ Good | ✅ Good | No known responsive issue. |
| /tasks | ⚠️ Issues | ✅ Good | ✅ Good | ✅ Good | Kanban mobile scroll bug. |
| /team/[id] | ✅ Good | ✅ Good | ✅ Good | ✅ Good | No known responsive issue. |
| /team | ✅ Good | ✅ Good | ✅ Good | ✅ Good | No known responsive issue. |
| /timesheets | ⚠️ Issues | ✅ Good | ✅ Good | ✅ Good | Timesheets table clipping. |
| /weekly-reports | ✅ Good | ✅ Good | ✅ Good | ✅ Good | No known responsive issue. |

## SECTION 18 — Role-Based Access Map

| Page / Feature | super_admin | admin | manager | employee | HR dept | Finance dept |
| --- | --- | --- | --- | --- | --- | --- |
| Dashboard | Yes | Yes | Yes | Yes | Yes | Yes |
| Management | Yes | Yes | Yes | No | No | No |
| Tasks | Yes | Yes | Yes/dept scoped | Yes/self/dept rules | Yes | Yes |
| Attendance | Yes | Yes | Dept scoped | Own | Yes | Own unless admin |
| Edit attendance | Yes | Yes | Manager scoped | No | Yes | No |
| Presence | Yes | Yes | Yes | No | Yes | No |
| Timesheets | Yes | Yes | Dept scoped | Own | Yes | Own unless admin |
| Leave submit | Yes | Yes | Yes | Yes | Yes | Yes |
| Leave approve | Yes | Yes | Yes | No | Yes | No |
| Overtime approve | Yes | Yes | Yes | No | Yes | No |
| My Team / department-dashboard | No | No | Yes | No | No | No |
| Team directory | Yes | Yes | Scoped | Scoped | Yes | Scoped |
| Weekly reports | Yes | Yes | Yes | Yes | Yes | Yes |
| Analytics | Yes | Yes | Yes | No | Yes | No |
| HR Dashboard | Yes | Yes | No unless HR dept | No | Yes | No |
| Finance Dashboard | Yes | Yes | No unless Finance dept | No | No | Yes via dept/sidebar rule |
| Settings | Yes | Yes | No | No | No | No |

## SECTION 19 — Role-Based Login Routing

File/function: `iwms/src/lib/auth-context.tsx` function `getPostLoginRoute` around line 136; applied by `AppLayout` around line 111. Rules: super_admin/admin -> /management; HR department -> /hr; Finance department -> /finance; manager -> /department-dashboard; fallback -> /dashboard. Known issue: manager target can hit the reported /my-team crash.

## SECTION 20 — Third-Party Services and Dependencies

| Service/library name | Version | What it is used for | Where configured | Known limitations/issues |
| --- | --- | --- | --- | --- |
| @tanstack/react-query | ^5.101.0 | Frontend library/service | iwms/package.json | Keep compatible with Next 16/React 19. |
| axios | ^1.16.1 | Frontend library/service | iwms/package.json | Keep compatible with Next 16/React 19. |
| clsx | ^2.1.1 | Frontend library/service | iwms/package.json | Keep compatible with Next 16/React 19. |
| lucide-react | ^1.17.0 | Frontend library/service | iwms/package.json | Keep compatible with Next 16/React 19. |
| next | 16.2.7 | Frontend library/service | iwms/package.json | Keep compatible with Next 16/React 19. |
| react | 19.2.4 | Frontend library/service | iwms/package.json | Keep compatible with Next 16/React 19. |
| react-dom | 19.2.4 | Frontend library/service | iwms/package.json | Keep compatible with Next 16/React 19. |
| recharts | ^3.8.1 | Frontend library/service | iwms/package.json | Keep compatible with Next 16/React 19. |
| socket.io-client | ^4.8.3 | Frontend library/service | iwms/package.json | Keep compatible with Next 16/React 19. |
| @fastify/cors | ^11.2.0 | Backend library/service | iwms-api/package.json | Requires production env/network readiness where applicable. |
| @fastify/jwt | ^10.1.0 | Backend library/service | iwms-api/package.json | Requires production env/network readiness where applicable. |
| @fastify/rate-limit | ^11.0.0 | Backend library/service | iwms-api/package.json | Requires production env/network readiness where applicable. |
| @prisma/client | ^5.22.0 | Backend library/service | iwms-api/package.json | Requires production env/network readiness where applicable. |
| bcryptjs | ^3.0.3 | Backend library/service | iwms-api/package.json | Requires production env/network readiness where applicable. |
| docxtemplater | ^3.68.7 | Backend library/service | iwms-api/package.json | Requires production env/network readiness where applicable. |
| dotenv | ^17.4.2 | Backend library/service | iwms-api/package.json | Requires production env/network readiness where applicable. |
| fastify | ^5.8.5 | Backend library/service | iwms-api/package.json | Requires production env/network readiness where applicable. |
| node-cron | ^4.2.1 | Backend library/service | iwms-api/package.json | Requires production env/network readiness where applicable. |
| nodemailer | ^8.0.10 | Backend library/service | iwms-api/package.json | Requires production env/network readiness where applicable. |
| pizzip | ^3.2.0 | Backend library/service | iwms-api/package.json | Requires production env/network readiness where applicable. |
| prisma | ^5.22.0 | Backend library/service | iwms-api/package.json | Requires production env/network readiness where applicable. |
| qrcode | ^1.5.4 | Backend library/service | iwms-api/package.json | Requires production env/network readiness where applicable. |
| socket.io | ^4.8.3 | Backend library/service | iwms-api/package.json | Requires production env/network readiness where applicable. |
| speakeasy | ^2.0.0 | Backend library/service | iwms-api/package.json | Requires production env/network readiness where applicable. |

## SECTION 21 — Deployment

- Frontend: `iwms` Next app, `npm run build`, `npm run start`; likely Vercel from CORS hints; output `.next`.

- Backend: `iwms-api` Fastify app, `npm start` / `node server.js`, no committed process manager config.

- Database: PostgreSQL via Prisma migrations; use `npx prisma migrate deploy` in production.

- Environment variables: set in host/Vercel/backend dashboard, never committed.

- CI/CD: no workflow config found.

## SECTION 22 — What The Next Agent Should Do First

| Priority | Task description | Why it matters | Files to touch | Estimated complexity |
| --- | --- | --- | --- | --- |
| P0 | Fix /my-team (/department-dashboard) crash. | Manager workflow is blocked. | iwms/src/app/department-dashboard/page.tsx; maybe iwms-api/routes/management.js | S |
| P1 | Fix mobile scroll/clipping bugs. | Core mobile usability. | tasks, attendance, timesheets, presence pages; globals.css | M |
| P1 | Fix Management Department Performance chart. | Visible broken analytics. | iwms/src/app/management/page.tsx; iwms-api/routes/management.js | S-M |
| P2 | Audit HR/Finance role+department backend enforcement. | Avoid sidebar/API mismatch. | Sidebar.tsx; routes/hr.js; routes/finance.js | M |
| P2 | Run smoke tests/builds and hardware simulator. | This document is source-derived. | Critical pages/routes | M |
| P3 | Move mailer from Ethereal to production SMTP config. | Production alerts need real delivery. | iwms-api/lib/mailer.js; env | S |

## SECTION 23 — Coding Conventions and Patterns

Backend: Fastify plugin route files, `{ onRequest: [fastify.authenticate] }` for protected routes, `organizationId` scoping from JWT, Socket.io via `global.io` and `org:${organizationId}` / `user:${id}` rooms, error shape usually `{ error: string }`, success returns raw JSON arrays/objects with frontend-friendly flattened fields.

Frontend: API calls through `src/lib/api.ts`, React Query array keys and invalidation, auth through `useAuth`, sockets through `useSocket`/`useSocketEvent`, CSS mix of Tailwind utilities, global CSS variables/classes, and inline styles, App Router `page.tsx` files and PascalCase components.

## SECTION 24 — Instructions For The Next Agent

You are inheriting a functional but still uneven multi-tenant IWMS. Read before editing. Preserve auth, refresh, device-key checks, and `organizationId` scoping. Start with the manager crash, then mobile table/Kanban/tab issues, then management chart correctness. Keep response shapes compatible with `src/lib/api.ts`; use existing Fastify/Prisma/React Query/Socket.io patterns; do not commit secrets; verify with builds and browser smoke tests after changes.
