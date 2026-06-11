async function testLogin() {
  const url = 'https://iwms-uk37.onrender.com/api/auth/login';
  const payload = {
    email: 'owner@company.com',
    password: 'ChangeMe123!'
  };

  console.log(`Sending POST login request to ${url}...`);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log(`Response status: ${response.status}`);
    const data = await response.json();
    if (response.ok) {
      console.log('Login SUCCESSFUL!');
      console.log('User role:', data.user?.role);
      console.log('Token starts with:', data.accessToken?.substring(0, 20) + '...');
    } else {
      console.log('Login FAILED:', data);
    }
  } catch (err) {
    console.error('Request error:', err);
  }
}

testLogin();
