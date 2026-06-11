$deviceId = $env:IWMS_TEST_DEVICE_ID
if (-not $deviceId) { $deviceId = "pico-gate-01" }

$uid = $env:IWMS_TEST_UID
if (-not $uid) { $uid = "136-4-13-10" }

$eventType = $env:IWMS_TEST_EVENT_TYPE
if (-not $eventType) { $eventType = "clock_in" }

$timestamp = $env:IWMS_TEST_TIMESTAMP
if (-not $timestamp) { $timestamp = "2026-06-09T09:05:00" }

$terminalEventId = $env:IWMS_TEST_TERMINAL_EVENT_ID
if (-not $terminalEventId) {
    $safeTimestamp = ($timestamp -replace 'T', '') -replace '[^A-Za-z0-9]', ''
    $safeUid = $uid -replace '[^A-Za-z0-9]', ''
    $terminalEventId = "$deviceId-$safeUid-$eventType-$safeTimestamp"
}

$deviceKey = $env:IWMS_TEST_DEVICE_KEY  # Optional: set when a key has been provisioned

$body = @{
    device_id         = $deviceId
    uid               = $uid
    name              = "Pico RFID Test"
    event_type        = $eventType
    timestamp         = $timestamp
    flags             = @()
    terminal_event_id = $terminalEventId
    firmware          = "local-test"
} | ConvertTo-Json

Write-Host "Sending: $body"
if ($deviceKey) { Write-Host "X-Device-Key: ****$($deviceKey.Substring([Math]::Max(0,$deviceKey.Length-4)))" }

$headers = @{ "Content-Type" = "application/json" }
if ($deviceKey) { $headers["X-Device-Key"] = $deviceKey }

try {
    $res = Invoke-RestMethod -Uri "http://localhost:3001/api/attendance/hardware-punch" `
        -Method POST -Headers $headers -Body $body
    $res | ConvertTo-Json
} catch {
    Write-Host "Error: $($_.Exception.Response.StatusCode)"
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    Write-Host $reader.ReadToEnd()
}

