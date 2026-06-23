// Fix: Supabase direct DB is IPv6-only. Node.js defaults to IPv4-first DNS
// which returns ENOENT when no A record exists. 'verbatim' preserves AAAA records.
require('dns').setDefaultResultOrder('verbatim');
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const DEPARTMENTS = [
  { name: 'Management', color: '#6366f1' },
  { name: 'Product Development', color: '#10b981' },
  { name: 'Finance', color: '#06b6d4' },
  { name: 'Administration', color: '#3b82f6' },
  { name: 'Training Department', color: '#eab308' },
  { name: 'Operations', color: '#a855f7' },
  { name: 'Human Resources', color: '#f97316' },
  { name: 'Business and Marketing Department', color: '#ec4899' },
];

const EMPLOYEES = [
  // --- Management ---
  {
    name: 'Prince Boateng Asare',
    email: 'prince@company.com',
    role: 'admin',
    position: 'Management / Partner',
    department: 'Management',
    code: 'MGMT001'
  },
  {
    name: 'Joshua Opoku',
    email: 'joshua@company.com',
    role: 'admin',
    position: 'Management / Partner',
    department: 'Management',
    code: 'MGMT002'
  },
  {
    name: 'Adoma',
    email: 'adoma@company.com',
    role: 'admin',
    position: 'Management / Partner',
    department: 'Management',
    code: 'MGMT003'
  },
  {
    name: 'System Owner',
    email: 'owner@company.com',
    role: 'super_admin',
    position: 'System Administrator',
    department: 'Management',
    code: 'ADM001'
  },

  // --- Product Development ---
  {
    name: 'Osman',
    email: 'osman@company.com',
    role: 'manager',
    position: 'Head of Development',
    department: 'Product Development',
    code: 'DEV001'
  },
  {
    name: 'Godfred Sam',
    email: 'godfred@company.com',
    role: 'team_lead',
    position: 'Assistant Head of Department',
    department: 'Product Development',
    code: '136-4-13-10'  // Hardware RFID UID
  },
  {
    name: 'Benedicta',
    email: 'benedicta@company.com',
    role: 'employee',
    position: 'Staff',
    department: 'Product Development',
    code: 'DEV002'
  },
  {
    name: 'Shaibu Adamu',
    email: 'shaibu@company.com',
    role: 'employee',
    position: 'Staff',
    department: 'Product Development',
    code: '59-76-78-211'  // Hardware RFID UID
  },
  {
    name: 'Kelvin',
    email: 'kelvin@company.com',
    role: 'employee',
    position: 'Staff',
    department: 'Product Development',
    code: '156-81-137-24'  // Hardware RFID UID
  },
  {
    name: 'Elizabeth',
    email: 'elizabeth@company.com',
    role: 'employee',
    position: 'Staff',
    department: 'Product Development',
    code: 'DEV003'
  },
  {
    name: 'Samuel',
    email: 'samuel@company.com',
    role: 'employee',
    position: 'Staff',
    department: 'Product Development',
    code: '136-4-16-23'  // Hardware RFID UID
  },
  {
    name: 'Trinity',
    email: 'trinity@company.com',
    role: 'employee',
    position: 'Intern',
    department: 'Product Development',
    code: 'DEV-INT001'
  },
  {
    name: 'Emmanuel',
    email: 'emmanuel@company.com',
    role: 'employee',
    position: 'Intern',
    department: 'Product Development',
    code: 'DEV-INT002'
  },
  {
    name: 'Michael Kwesi',
    email: 'michael@company.com',
    role: 'employee',
    position: 'National Service',
    department: 'Product Development',
    code: '6-47-166-27'  // Hardware RFID UID
  },

  // --- Finance ---
  {
    name: 'Marian',
    email: 'marian@company.com',
    role: 'manager',
    position: 'Finance Manager',
    department: 'Finance',
    code: 'FIN001'
  },

  // --- Administration ---
  {
    name: 'Pearl Sam',
    email: 'sticialstudio@gmail.com',
    role: 'manager',
    position: 'Administrator',
    department: 'Administration',
    code: 'ADM-PEARL'
  },

  // --- Training Department ---
  {
    name: 'Joseph',
    email: 'joseph@company.com',
    role: 'manager',
    position: 'Head of Development',
    department: 'Training Department',
    code: 'TRN001'
  },
  {
    name: 'Rukaya',
    email: 'rukaya@company.com',
    role: 'employee',
    position: 'Staff',
    department: 'Training Department',
    code: 'TRN002'
  },
  {
    name: 'Kofi',
    email: 'kofi@company.com',
    role: 'employee',
    position: 'Staff',
    department: 'Training Department',
    code: 'TRN003'
  },

  // --- Operations ---
  {
    name: 'Micah',
    email: 'micah@company.com',
    role: 'manager',
    position: 'Operation Manager',
    department: 'Operations',
    code: 'OPS001'
  },

  // --- Human Resources ---
  {
    name: 'Irene',
    email: 'irene@company.com',
    role: 'manager',
    position: 'HR Manager',
    department: 'Human Resources',
    code: 'HR001'
  },

  // --- Business and Marketing ---
  {
    name: 'Gemimah Opata',
    email: 'gemimah@company.com',
    role: 'manager',
    position: 'Head of Department',
    department: 'Business and Marketing Department',
    code: 'MKT001'
  },
  {
    name: 'Jemimah Asare',
    email: 'jemimah@company.com',
    role: 'employee',
    position: 'Staff',
    department: 'Business and Marketing Department',
    code: 'MKT002'
  },
  {
    name: 'Jacob',
    email: 'jacob@company.com',
    role: 'employee',
    position: 'Staff',
    department: 'Business and Marketing Department',
    code: 'MKT003'
  },
  {
    name: 'Kukua',
    email: 'kukua@company.com',
    role: 'employee',
    position: 'Staff',
    department: 'Business and Marketing Department',
    code: 'MKT004'
  }
];

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'EM';
}

async function main() {
  console.log('Starting seed: Seeding departments and employees...');

  // 1. Seed Organization
  const org = await prisma.organization.upsert({
    where: { name: 'Company Inc.' },
    update: { joinCode: 'COMPANY-123' },
    create: { name: 'Company Inc.', joinCode: 'COMPANY-123' }
  });
  const orgId = org.id;
  console.log(`Using Organization: ${org.name} (${orgId})`);

  // 2. Seed Departments
  const deptMap = {};
  for (const dept of DEPARTMENTS) {
    const createdDept = await prisma.department.upsert({
      where: { name_organizationId: { name: dept.name, organizationId: orgId } },
      update: { color: dept.color },
      create: { name: dept.name, color: dept.color, organizationId: orgId }
    });
    deptMap[dept.name] = createdDept;
  }
  console.log(`Seeded ${Object.keys(deptMap).length} departments.`);

  // 3. Seed Employees
  const defaultPasswordHash = await bcrypt.hash('Micah123', 10);
  const userMap = {};

  for (const emp of EMPLOYEES) {
    const deptId = deptMap[emp.department]?.id || null;
    const cleanEmail = emp.email.toLowerCase().trim();

    const createdUser = await prisma.user.upsert({
      where: { email: cleanEmail },
      update: {
        name: emp.name,
        role: emp.role,
        position: emp.position,
        employeeCode: emp.code,
        departmentId: deptId,
        organizationId: orgId
      },
      create: {
        name: emp.name,
        email: cleanEmail,
        passwordHash: defaultPasswordHash,
        role: emp.role,
        position: emp.position,
        employeeCode: emp.code,
        departmentId: deptId,
        organizationId: orgId,
        avatar: initials(emp.name),
        status: 'active',
        joinDate: new Date().toISOString().split('T')[0]
      }
    });

    userMap[emp.name] = createdUser;
  }
  console.log(`Seeded ${EMPLOYEES.length} employees.`);

  // 3. Update Department HOD info & headcount
  for (const deptName of Object.keys(deptMap)) {
    const dept = deptMap[deptName];
    
    // Find HOD (role = manager or role = super_admin/admin for Management)
    const manager = EMPLOYEES.find(e => e.department === deptName && (e.role === 'manager' || e.role === 'super_admin'));
    const managerUser = manager ? userMap[manager.name] : null;

    const count = await prisma.user.count({ where: { departmentId: dept.id } });

    await prisma.department.update({
      where: { id: dept.id },
      data: {
        managerId: managerUser?.id || null,
        managerName: managerUser?.name || '',
        headcount: count
      }
    });
  }
  console.log('Updated department manager associations and headcounts.');
  console.log('Database seeding complete!');
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
