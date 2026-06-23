"""
wifi_sync.py — WiFi manager + IWMS attendance event sync
Features:
  • Auto-connect and reconnect
  • POST punch events to IWMS REST API
  • Offline queue: buffers failed events to disk, retries when back online
  • Call wifi_sync.tick(now) once per main loop iteration

Upload this to the Pico alongside config.py and main.py.
"""

import network
import time
import json

try:
    import requests
except ImportError:
    import urequests as requests

import config


class WiFiSync:

    def __init__(self):
        self.wlan = network.WLAN(network.STA_IF)
        self.wlan.active(True)
        self._last_retry = 0
        self._last_flush  = 0
        self._last_heartbeat = 0
        self._connecting = False
        self._connect_deadline = 0
        self._queue = self._load_queue()

    # ── Connection ────────────────────────────────────────────────────────────

    def connect(self, blocking=False):
        """
        Attempt to join the configured WiFi network.

        If blocking=True, waits up to WIFI_TIMEOUT seconds (used at boot).
        If blocking=False (default), kicks off the connection and returns
        immediately; call poll_connect() on subsequent ticks to check.

        Returns True on immediate success, False otherwise.
        """
        if self.wlan.isconnected():
            self._connecting = False
            return True

        if self._connecting:
            return False  # already in progress

        print("WiFi: connecting to '{}'…".format(config.WIFI_SSID))
        try:
            self.wlan.connect(config.WIFI_SSID, config.WIFI_PASSWORD)
        except Exception as e:
            print("WiFi: connect() error —", e)
            return False

        if blocking:
            deadline = time.ticks_add(time.ticks_ms(), config.WIFI_TIMEOUT * 1000)
            while not self.wlan.isconnected():
                if time.ticks_diff(deadline, time.ticks_ms()) <= 0:
                    print("WiFi: timed out")
                    return False
                time.sleep_ms(250)
            print("WiFi: connected —", self.wlan.ifconfig()[0])
            return True

        # Non-blocking: mark as connecting and set deadline
        self._connecting = True
        self._connect_deadline = time.ticks_add(time.ticks_ms(), config.WIFI_TIMEOUT * 1000)
        return False

    def poll_connect(self):
        """Check on a non-blocking connection attempt. Call from tick()."""
        if not self._connecting:
            return
        if self.wlan.isconnected():
            self._connecting = False
            print("WiFi: connected —", self.wlan.ifconfig()[0])
        elif time.ticks_diff(self._connect_deadline, time.ticks_ms()) <= 0:
            self._connecting = False
            print("WiFi: timed out")

    def disconnect(self):
        self.wlan.disconnect()

    def is_connected(self):
        return self.wlan.isconnected()

    def ip_address(self):
        """Return current IP string, or None if offline."""
        if self.is_connected():
            return self.wlan.ifconfig()[0]
        return None

    # ── Tick (call from main loop) ────────────────────────────────────────────

    def tick(self, now):
        """
        Housekeeping — call once per main loop iteration with time.ticks_ms().
        Handles reconnection retries, flushing the offline queue, and heartbeats.
        """
        # Check on any in-progress non-blocking connection
        if self._connecting:
            self.poll_connect()

        if not self.is_connected():
            if not self._connecting and time.ticks_diff(now, self._last_retry) >= config.WIFI_RETRY_MS:
                self._last_retry = now
                self.connect()  # non-blocking by default
            return  # No point flushing or sending heartbeat if offline

        # Send heartbeat every 60 seconds (or immediately on boot)
        if self._last_heartbeat == 0 or time.ticks_diff(now, self._last_heartbeat) >= 60_000:
            self._last_heartbeat = now
            try:
                self.send_heartbeat()
            except Exception as e:
                print("WiFiSync: tick heartbeat failed —", e)

        if self._queue:
            if time.ticks_diff(now, self._last_flush) >= config.SYNC_RETRY_MS:
                self._last_flush = now
                self.flush_queue()

    def send_heartbeat(self):
        """Send a lightweight heartbeat to the server to update status and telemetry."""
        if not self.is_connected():
            return False
            
        import gc
        device_id = getattr(config, "DEVICE_ID", None)
        device_key = getattr(config, "DEVICE_KEY", None)
        if not device_id or not device_key:
            return False
            
        url = config.SERVER_URL.rstrip('/') + "/api/devices/{}/heartbeat".format(device_id)
        
        rssi = -50
        try:
            rssi = self.wlan.status('rssi')
        except:
            pass
            
        payload = {
            "firmwareVersion": getattr(config, "FIRMWARE_VERSION", "pico2w-rfid"),
            "hardwareModel": "Raspberry Pi Pico 2 W",
            "batteryLevel": 100,
            "wifiRssi": rssi,
            "freeMemory": gc.mem_free(),
            "uptimeSeconds": time.ticks_ms() // 1000
        }
        
        try:
            body = json.dumps(payload)
            headers = {
                "Content-Type": "application/json",
                "X-Device-Key": device_key
            }
            res = requests.post(url, data=body, headers=headers, timeout=5)
            ok = res.status_code == 200
            res.close()
            return ok
        except Exception as e:
            print("Heartbeat: send failed —", e)
            return False

    # ── Event posting ─────────────────────────────────────────────────────────

    def post_event(self, uid, name, event_type, timestamp, flags=None):
        """
        Send one attendance punch event to the IWMS server.

        If the server is unreachable the event is written to the offline queue
        on disk and retried the next time WiFi is available.

        Args:
            uid:        UID string from the RFID reader  e.g. "136-4-13-10"
            name:       Employee full name
            event_type: "clock_in"  or  "clock_out"
            timestamp:  ISO-8601 string  e.g. "2026-06-08T09:15:30"
            flags:      list of flag strings, e.g. ["LATE"]

        Returns:
            (success, status_code, response_data)
            success is True if successfully processed by server (2xx)
        """
        event_id = self._terminal_event_id(uid, event_type, timestamp)
        payload = {
            "device_id":         config.DEVICE_ID,
            "uid":               uid,
            "name":              name,
            "event_type":        event_type,
            "timestamp":         timestamp,
            "flags":             flags or [],
            "terminal_event_id": event_id,
            "firmware":          getattr(config, "FIRMWARE_VERSION", "pico2w-rfid"),
        }

        if self.is_connected():
            ok, status, data = self._try_post(payload)
            if ok:
                print("Sync ✓ {} {} → {}".format(event_type, name, timestamp))
                if self._queue:
                    self.flush_queue()
                return True, status, data
            
            # If it failed due to a network/server issue (status <= 0 or 5xx), queue it
            # But if it failed due to client validation error (400, 401, 403, 404, 409), do NOT queue it
            if status <= 0 or status >= 500:
                print("Sync: temporary error ({}) — queuing event for {}".format(status, name))
                self._enqueue(payload)
                return False, status, data
            else:
                print("Sync: validation/auth error ({}) — not queuing event for {}".format(status, name))
                return False, status, data
        else:
            print("Sync: offline — queuing event for", name)
            self._enqueue(payload)
            return False, 0, {"error": "Offline", "message": "Device is offline"}

    def flush_queue(self):
        """
        Upload all queued events to the server in a single batch POST.
        On a 2xx response the queue is cleared.
        On any network/server error the queue is preserved and retried on the next flush.
        """
        if not self._queue:
            return

        print("Sync: flushing {} queued event(s) via batch endpoint...".format(len(self._queue)))

        url = config.SERVER_URL.rstrip('/') + "/api/attendance/hardware-punch/batch"
        try:
            body = json.dumps({"events": self._queue})
            headers = {"Content-Type": "application/json"}
            device_key = getattr(config, "DEVICE_KEY", None)
            if device_key:
                headers["X-Device-Key"] = device_key
            
            res = requests.post(
                url,
                data=body,
                headers=headers,
                timeout=15,
            )
            status_code = res.status_code
            res.close()

            if 200 <= status_code < 300:
                print("Sync: batch flush successful (status {}). Cleared {} event(s).".format(status_code, len(self._queue)))
                self._queue = []
                self._save_queue()
            else:
                print("Sync: batch flush failed with status {}. Will retry later.".format(status_code))
        except OSError as e:
            print("Sync: batch flush network error —", e)
        except Exception as e:
            print("Sync: batch flush unexpected error —", e)

    def queue_length(self):
        return len(self._queue)

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _terminal_event_id(self, uid, event_type, timestamp):
        safe_uid = str(uid).replace("-", "")
        safe_time = str(timestamp).replace("-", "").replace(":", "").replace("T", "")
        return "{}-{}-{}-{}".format(config.DEVICE_ID, safe_uid, event_type, safe_time)

    def _try_post(self, payload):
        """Execute one HTTP POST. Returns (ok, status_code, response_data)."""
        url = config.SERVER_URL + config.PUNCH_ENDPOINT
        try:
            body = json.dumps(payload)
            headers = {"Content-Type": "application/json"}
            # Include hardware API key if one has been provisioned
            device_key = getattr(config, "DEVICE_KEY", None)
            if device_key:
                headers["X-Device-Key"] = device_key
            res  = requests.post(
                url,
                data=body,
                headers=headers,
                timeout=10,
            )
            status_code = res.status_code
            ok = 200 <= status_code < 300
            
            resp_data = None
            try:
                resp_text = res.text
                if resp_text:
                    try:
                        resp_data = json.loads(resp_text)
                    except:
                        resp_data = resp_text
            except Exception as e:
                print("Sync: error parsing response body:", e)
                
            res.close()
            return ok, status_code, resp_data
        except OSError as e:
            # Common on Pico: EHOSTUNREACH, ETIMEDOUT, etc.
            print("Sync: network error —", e)
            return False, -1, str(e)
        except Exception as e:
            print("Sync: unexpected error —", e)
            return False, -2, str(e)

    def _load_queue(self):
        try:
            with open(config.QUEUE_FILE, "r") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
        except:
            pass
        return []

    def _enqueue(self, payload):
        max_size = getattr(config, "MAX_QUEUE_SIZE", 500)
        while len(self._queue) >= max_size:
            dropped = self._queue.pop(0)
            print("Queue: full (max {}), dropping oldest event for {}".format(max_size, dropped.get("name", "?")))
        self._queue.append(payload)
        self._save_queue()

    def _save_queue(self):
        try:
            with open(config.QUEUE_FILE, "w") as f:
                json.dump(self._queue, f)
        except Exception as e:
            print("Queue save error:", e)

    def post_unknown_card(self, uid):
        """
        POST an unknown card UID to the /api/devices/unknown-card endpoint.
        Returns (success, status_code)
        """
        if not self.is_connected():
            print("Sync: offline — cannot post unknown card", uid)
            return False, 0

        url = config.SERVER_URL.rstrip('/') + "/api/devices/unknown-card"
        payload = {
            "uid": uid,
            "deviceSerial": config.DEVICE_ID
        }
        try:
            body = json.dumps(payload)
            headers = {"Content-Type": "application/json"}
            device_key = getattr(config, "DEVICE_KEY", None)
            if device_key:
                headers["X-Device-Key"] = device_key
            res = requests.post(
                url,
                data=body,
                headers=headers,
                timeout=10,
            )
            status_code = res.status_code
            ok = 200 <= status_code < 300
            res.close()
            return ok, status_code
        except OSError as e:
            print("Sync: unknown-card network error —", e)
            return False, -1
        except Exception as e:
            print("Sync: unknown-card unexpected error —", e)
            return False, -2

