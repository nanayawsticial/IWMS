# Login
$loginBody = @{ email = "owner@company.com"; password = "ChangeMe123!" } | ConvertTo-Json
$loginRes = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method POST -ContentType "application/json" -Body $loginBody
$token = $loginRes.accessToken
Write-Host "Token: $($token.Substring(0,30))..."

# Get devices
Write-Host "`n=== DEVICES ==="
$devices = Invoke-RestMethod -Uri "http://localhost:3001/api/devices" -Method GET -Headers @{ Authorization = "Bearer $token" }
$devices | ForEach-Object { Write-Host "  ID=$($_.id) | Name=$($_.name) | Serial=$($_.serialNumber) | Status=$($_.status) | Simulated=$($_.isSimulated)" }

# Get users with employee codes
Write-Host "`n=== USERS (employeeCode) ==="
$users = Invoke-RestMethod -Uri "http://localhost:3001/api/users" -Method GET -Headers @{ Authorization = "Bearer $token" }
$users | ForEach-Object { Write-Host "  Name=$($_.name) | Code=$($_.employeeCode) | Status=$($_.status)" }
