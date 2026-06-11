# Phase 5: Pico 2 W RFID Terminal

This phase connects a Raspberry Pi Pico 2 W RFID reader to IWMS attendance. The terminal reads an RFID UID, sends it to the API, and IWMS maps that UID to a user's `employeeCode`.

## Current Contract

The current RFID flow uses the attendance hardware punch endpoint:

```http
POST /api/attendance/hardware-punch
Content-Type: application/json
```

```json
{
  "device_id": "pico-gate-01",
  "uid": "136-4-13-10",
  "name": "Optional Display Name",
  "event_type": "clock_in",
  "timestamp": "2026-06-09T09:05:00",
  "flags": [],
  "terminal_event_id": "pico-gate-01-13641310-clock_in-20260609090500",
  "firmware": "pico2w-rfid-0.2.0"
}
```

`event_type` must be `clock_in` or `clock_out`.

`terminal_event_id` should be stable for the same physical scan. If the Pico buffers a punch and retries it later, the API returns a successful duplicate response instead of applying the same punch twice.

## IWMS Setup

1. In Settings, register a biometric hardware device with serial number `pico-gate-01`.
2. Keep the device active.
3. In Team, open the employee profile and edit `Employee Code / RFID UID`.
4. Set the employee code to the exact UID returned by the RFID reader, for example `136-4-13-10`.

The API rejects unknown devices and unknown employee UIDs. Employee codes must be unique so one RFID card cannot point to multiple users.

## Firmware Flow

1. Boot the Pico 2 W and connect to WiFi.
2. Read the RFID card UID.
3. Convert the UID to the same decimal-dash format stored in IWMS, such as `136-4-13-10`.
4. Generate a stable `terminal_event_id` for that scan.
5. Send a `clock_in` or `clock_out` hardware punch.
6. Show success or failure on the TFT screen.
7. If WiFi or the API is unavailable, save the punch locally and retry later with the same `terminal_event_id`.

The starter firmware in `firmware/pico2w/main.py` covers WiFi, the hardware punch request, retry-safe event ids, and a small offline queue. The active device-side project in `G:\Dash\das` includes the TFT/touch/RFID flow and now posts the same retry-safe payload.

## Local Verification

From `G:\Dash`, run:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\test_punch.ps1
```

Optional environment overrides:

```powershell
$env:IWMS_TEST_UID = "136-4-13-10"
$env:IWMS_TEST_EVENT_TYPE = "clock_in"
$env:IWMS_TEST_TIMESTAMP = "2026-06-09T09:05:00"
$env:IWMS_TEST_TERMINAL_EVENT_ID = "manual-test-001"
powershell.exe -ExecutionPolicy Bypass -File .\test_punch.ps1
```

## Security Hardening Next

The current RFID route is suitable for local development and trusted LAN testing. Before production deployment, add one of these protections to `/api/attendance/hardware-punch`:

- Provisioned device key header.
- Network allowlist or VPN-only access.
- HMAC signing over `terminal_event_id`, timestamp, and payload.
