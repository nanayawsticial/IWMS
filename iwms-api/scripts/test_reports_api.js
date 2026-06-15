const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3001';

async function runTest() {
  try {
    console.log('0. Cleaning up old test report from database...');
    // Find owner user
    const owner = await prisma.user.findFirst({
      where: { email: 'owner@company.com' }
    });
    if (owner) {
      const oldReport = await prisma.weeklyReport.findFirst({
        where: { userId: owner.id, startDate: '2026-06-08' }
      });
      if (oldReport) {
        await prisma.weeklyReport.delete({ where: { id: oldReport.id } });
        console.log('Old report deleted successfully.');
      }
    }

    console.log('1. Logging in as owner@company.com...');
    const loginRes = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'owner@company.com',
        password: 'Micah123'
      })
    });
    
    if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.statusText}`);
    const loginData = await loginRes.json();
    const token = loginData.accessToken;
    console.log('Login successful. Token acquired.');

    const headers = { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` 
    };

    console.log('\n2. Testing auto-populate route...');
    const autoRes = await fetch(`${API_URL}/api/reports/auto-populate?startDate=2026-06-08&endDate=2026-06-14`, {
      headers
    });
    if (!autoRes.ok) throw new Error(`Auto-populate failed: ${autoRes.statusText}`);
    const autoData = await autoRes.json();
    console.log('Auto-populate response activities count:', autoData.activities.length);

    console.log('\n3. Saving a draft report...');
    const saveRes = await fetch(`${API_URL}/api/reports/save`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        startDate: '2026-06-08',
        endDate: '2026-06-14',
        action: 'draft',
        activities: [
          { taskName: 'Implementation of Weekly Reports', type: 'Development', status: 'In Progress', impact: 'Enables digital tracking', hoursSpent: 8.5, links: '' }
        ],
        roadblocks: [
          { challenge: 'Template formatting complexity', impact: 'High', mitigation: 'Used python-docx', supportRequired: 'None', responsibleParty: '', deadline: '' }
        ],
        plans: [
          { plannedActivity: 'Verify on real browser', typeAssigned: 'Assigned', typeScope: 'Departmental', deliverables: 'Tested page', targetDate: '2026-06-12', dependencies: '' }
        ],
        additionalNotes: 'Test draft note.'
      })
    });
    
    if (!saveRes.ok) {
      const errTxt = await saveRes.text();
      throw new Error(`Save draft failed: ${saveRes.status} - ${errTxt}`);
    }
    const saveData = await saveRes.json();
    const reportId = saveData.id;
    console.log('Draft saved successfully! Report ID:', reportId);

    console.log('\n4. Submitting the report...');
    const submitRes = await fetch(`${API_URL}/api/reports/save`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        startDate: '2026-06-08',
        endDate: '2026-06-14',
        action: 'submit',
        activities: saveData.activities,
        roadblocks: saveData.roadblocks,
        plans: saveData.plans,
        additionalNotes: 'Submitting report.'
      })
    });
    if (!submitRes.ok) throw new Error(`Submit failed: ${submitRes.statusText}`);
    const submitData = await submitRes.json();
    console.log('Report submitted successfully! Status:', submitData.status);

    console.log('\n5. Reviewing the report (approve)...');
    const reviewRes = await fetch(`${API_URL}/api/reports/${reportId}/review`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        status: 'approved',
        reviewNotes: 'Looks perfect. Excellent job.'
      })
    });
    if (!reviewRes.ok) throw new Error(`Review failed: ${reviewRes.statusText}`);
    const reviewData = await reviewRes.json();
    console.log('Review completed. Status updated to:', reviewData.status);

    console.log('\n6. Exporting to Word document...');
    const exportRes = await fetch(`${API_URL}/api/reports/${reportId}/export`, {
      headers: {
        'Authorization': `Bearer ${token}` 
      }
    });
    
    if (!exportRes.ok) throw new Error(`Export failed: ${exportRes.statusText}`);
    const arrayBuffer = await exportRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const exportPath = path.join(__dirname, '../templates/exported_test_output.docx');
    fs.writeFileSync(exportPath, buffer);
    console.log('Export successful! Document written to:', exportPath);
    console.log('File size in bytes:', fs.statSync(exportPath).size);

    console.log('\nSUCCESS: All weekly report APIs working flawlessly!');
  } catch (err) {
    console.error('TEST FAILED:', err.message);
  } finally {
    await prisma.$disconnect();
    // Clean up exported doc
    try {
      const exportPath = path.join(__dirname, '../templates/exported_test_output.docx');
      if (fs.existsSync(exportPath)) fs.unlinkSync(exportPath);
    } catch (e) {}
    process.exit(0);
  }
}

runTest();
