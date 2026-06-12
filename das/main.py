"""
main.py — STEMAIDER Attendance System v3
Raspberry Pi Pico 2 W  |  MicroPython

Hardware:
  ILI9341 TFT display   SPI0  GP14-CS, GP15-RST, GP16-MISO, GP17-DC, GP18-SCK, GP19-MOSI
  XPT2046 touch screen  SPI1  GP9-IRQ, GP10-SCK, GP11-MOSI, GP12-MISO, GP13-CS
  MFRC522 RFID reader   Soft  GP0-RST, GP2-SCK, GP3-MOSI, GP4-MISO, GP5-CS
  Buzzer                       GP1

Changes from v2:
  • FIX  RTC no longer reset on every reboot — time only initialised if clearly invalid
  • FIX  cleanup_logs() now also removes old entries from the in-memory dict
  • FIX  cleanup_logs() no longer called every 50 ms — runs once per hour
  • ADD  WiFi auto-connect and reconnect (via wifi_sync.py)
  • ADD  Punch events POSTed to IWMS on every successful scan
  • ADD  Offline queue: events buffered on disk when WiFi is down, auto-retried
  • ADD  WiFi status indicator (top-right of header: green = online, red = offline)
  • ADD  Queued-event counter shown in header when > 0
  • TIDY Removed excessive blank lines; configuration moved to config.py
"""

from machine import Pin, SPI, SoftSPI, RTC
from ili934xnew import ILI9341
from mfrc522 import MFRC522
import glcdfont
import tt24
import time
import json
import os

import config
from wifi_sync import WiFiSync

# ── RTC ───────────────────────────────────────────────────────────────────────
# ── DS1302 RTC ────────────────────────────────────────────────────────────────
from ds1302 import DS1302
rtc = DS1302(
    clk=Pin(config.DS1302_CLK, Pin.OUT),
    dat=Pin(config.DS1302_DAT, Pin.OUT),
    rst=Pin(config.DS1302_RST, Pin.OUT),
)

_t = rtc.datetime()
if not (2024 <= _t[0] <= 2035):
    # First boot / dead battery — set a starting time.
    # After the battery is in and time is correct, this branch won't run again.
    rtc.datetime((2026, 6, 8, 0, 8, 30, 0, 0))  # (year, month, day, wday, hour, minute, second, subsecond)
    print("RTC: set to default time — please set correct time via shell")
# ── Display SPI0 ─────────────────────────────────────────────────────────────
spi = SPI(0, baudrate=32_000_000, sck=Pin(18), mosi=Pin(19), miso=Pin(16))
display = ILI9341(spi, Pin(17), Pin(15), Pin(14), 320, 240, 3)

# ── Touch SPI1 ───────────────────────────────────────────────────────────────
touch_spi = SPI(1, baudrate=2_000_000, sck=Pin(10), mosi=Pin(11), miso=Pin(12))
t_cs  = Pin(13, Pin.OUT)
t_irq = Pin(9,  Pin.IN, Pin.PULL_UP)
t_cs.value(1)

# ── RFID SoftSPI (SPI0 and SPI1 already in use) ───────────────────────────────
rfid_spi = SoftSPI(
    baudrate=2_500_000, polarity=0, phase=0,
    sck=Pin(2), mosi=Pin(3), miso=Pin(4)
)
reader = MFRC522(rfid_spi, cs=Pin(5, Pin.OUT), rst=Pin(0, Pin.OUT))

# ── Buzzer ────────────────────────────────────────────────────────────────────
_buzzer = Pin(1, Pin.OUT)

def beep(times=1, duration=0.08):
    for _ in range(times):
        _buzzer.on();  time.sleep(duration)
        _buzzer.off(); time.sleep(duration)

# ── Touch driver ──────────────────────────────────────────────────────────────
class Touch:
    def __init__(self, spi, cs, irq):
        self.spi = spi
        self.cs  = cs
        self.irq = irq
        self.x_min, self.x_max = 200, 3800
        self.y_min, self.y_max = 200, 3800

    def read(self):
        if self.irq.value():
            return None
        self.cs.value(0)
        x = self._read_channel(0x90)
        y = self._read_channel(0xD0)
        self.cs.value(1)
        x = self._map(x, self.x_min, self.x_max, 0, 320)
        y = self._map(y, self.y_min, self.y_max, 240, 0)
        return (x, y)

    def _read_channel(self, cmd):
        buf = bytearray([cmd, 0, 0])
        self.spi.write_readinto(buf, buf)
        return ((buf[1] << 8) | buf[2]) >> 3

    def _map(self, v, in_min, in_max, out_min, out_max):
        v = max(in_min, min(in_max, v))
        return int((v - in_min) * (out_max - out_min) / (in_max - in_min) + out_min)

touch = Touch(touch_spi, t_cs, t_irq)

# ── WiFi + IWMS sync ──────────────────────────────────────────────────────────
wifi_sync = WiFiSync()

# ── Colours ───────────────────────────────────────────────────────────────────
WHITE    = 0xFFFF
BLACK    = 0x0000
DARK_GY  = 0x18C3
LIGHT_GY = 0x632C
ACCENT   = 0x3186
GREEN    = 0x07E0
RED      = 0xF800
YELLOW   = 0xFFE0

# ── Persistent storage helpers ────────────────────────────────────────────────
def load_json(filename, default):
    try:
        with open(filename, "r") as f:
            return json.load(f)
    except Exception as e:
        print("load_json({}): {} — using default".format(filename, e))
        return default

def save_json(filename, data):
    """Atomic write: write to .tmp then rename, so a power failure during write
    leaves the original intact."""
    tmp = filename + ".tmp"
    try:
        with open(tmp, "w") as f:
            json.dump(data, f)
        try:
            os.remove(filename)
        except:
            pass
        os.rename(tmp, filename)
    except Exception as e:
        print("save_json({}): {}".format(filename, e))

# ── User database ─────────────────────────────────────────────────────────────
_DEFAULT_USERS = {
    #"136-4-13-10":   "Godfred Sam",
    #"156-81-137-24": "Kelvin",
    #"211-58-49-248": "Samual",
    #"59-76-78-211":  "Shaibu",
    #"6-47-166-27":   "Michael Kwesi",
}

user_db      = load_json(config.DB_FILE,  _DEFAULT_USERS)
attendance   = load_json(config.LOG_FILE, {})

save_json(config.DB_FILE, user_db)   # ensure file exists

# ── State ─────────────────────────────────────────────────────────────────────
current_mode    = "NONE"   # "NONE" | "IN" | "OUT"
last_touch_ms   = 0
last_scan_ms    = 0
last_cleanup_ms = 0

# ── Time helpers ──────────────────────────────────────────────────────────────
def _rtc_tuple():
    t = rtc.datetime()          # DS1302 returns (year, month, day, wday, hour, minute, second, subsecond)
    y, mo, d, wday, h, mi, s, _ = t
    if not (2024 <= y <= 2035 and 1 <= mo <= 12 and 1 <= d <= 31
            and 0 <= h <= 23 and 0 <= mi <= 59):
        print("RTC: invalid data", t)
        return None
    return (y, mo, d, h, mi, s)

def get_display_time():
    """Returns (date_str, time_str)  e.g. ("2026-06-08", "09:15")"""
    t = _rtc_tuple()
    if t is None:
        return ("1970-01-01", "--:--")
    y, mo, d, h, mi, _ = t
    return ("{:04d}-{:02d}-{:02d}".format(y, mo, d),
            "{:02d}:{:02d}".format(h, mi))

def get_iso_timestamp():
    """Returns ISO-8601 timestamp string  e.g. "2026-06-08T09:15:30" """
    t = _rtc_tuple()
    if t is None:
        return "1970-01-01T00:00:00"
    y, mo, d, h, mi, s = t
    return "{:04d}-{:02d}-{:02d}T{:02d}:{:02d}:{:02d}".format(y, mo, d, h, mi, s)

def get_hour_minute():
    t = _rtc_tuple()
    if t is None:
        return (0, 0)
    return (t[3], t[4])

def hours_worked(in_time, out_time):
    """Calculate decimal hours between two "HH:MM" strings."""
    sh, sm = map(int, in_time.split(":"))
    eh, em = map(int, out_time.split(":"))
    return round(((eh * 60 + em) - (sh * 60 + sm)) / 60, 2)

# ── Log cleanup ───────────────────────────────────────────────────────────────
def cleanup_logs():
    """
    Remove attendance entries older than MAX_LOG_DAYS from both disk and memory.
    Only called once per hour from the main loop.
    """
    global attendance
    if len(attendance) <= config.MAX_LOG_DAYS:
        return
    dates = sorted(attendance.keys())
    while len(dates) > config.MAX_LOG_DAYS:
        oldest = dates.pop(0)
        attendance.pop(oldest, None)   # ← also removes from in-memory dict
    save_json(config.LOG_FILE, attendance)
    print("Logs: trimmed to {} days".format(config.MAX_LOG_DAYS))

# ── Display ───────────────────────────────────────────────────────────────────
def draw_header():
    """Draw the top header bar (called on every full redraw)."""
    display.set_font(tt24)
    display.set_color(WHITE, BLACK)
    display.set_pos(20, 5)
    display.print("STEMAIDER")

    # WiFi status indicator — 12×12 square top-right
    wifi_color = GREEN if wifi_sync.is_connected() else RED
    display.fill_rectangle(295, 8, 12, 12, wifi_color)

    # Pending-sync counter (shown when there are queued events)
    q = wifi_sync.queue_length()
    if q > 0:
        display.set_font(glcdfont)
        display.set_color(YELLOW, BLACK)
        display.set_pos(248, 12)
        display.print("Q:{}".format(q))

    display.fill_rectangle(0, 38, 320, 2, ACCENT)

def draw_main_desktop():
    global current_mode

    display.set_color(WHITE, BLACK)
    display.erase()
    draw_header()

    # ── Clock In button ───────────────────────────────────────
    in_bg = GREEN if current_mode == "IN" else DARK_GY
    display.fill_rectangle(15, 50, 135, 55, in_bg)
    display.set_font(tt24)
    display.set_color(WHITE, in_bg)
    display.set_pos(38, 68)
    display.print("CLOCK IN")

    # ── Clock Out button ──────────────────────────────────────
    out_bg = RED if current_mode == "OUT" else DARK_GY
    display.fill_rectangle(160, 50, 145, 55, out_bg)
    display.set_color(WHITE, out_bg)
    display.set_pos(172, 68)
    display.print("CLOCK OUT")

    # ── Status box ────────────────────────────────────────────
    display.fill_rectangle(15, 115, 290, 65, ACCENT)
    display.set_font(glcdfont)

    date_str, time_str = get_display_time()

    display.set_color(WHITE, ACCENT)
    display.set_pos(25, 123)
    display.print("Date: " + date_str)
    display.set_pos(25, 138)
    display.print("Time: " + time_str)
    display.set_pos(25, 158)

    if current_mode == "NONE":
        display.print("Select IN or OUT Mode")
    elif current_mode == "IN":
        display.set_color(GREEN, ACCENT)
        display.print("READY -> Scan Card")
    elif current_mode == "OUT":
        display.set_color(RED, ACCENT)
        display.print("READY -> Scan Card")

    # ── Bottom menu ───────────────────────────────────────────
    for i, label in enumerate(["SET", "LOGS", "DATA", "MORE"]):
        bx = 15 + i * 75
        display.fill_rectangle(bx, 195, 65, 38, DARK_GY)
        display.set_font(glcdfont)
        display.set_color(WHITE, DARK_GY)
        display.set_pos(bx + 12, 208)
        display.print(label)

# ── Attendance processing ──────────────────────────────────────────────────────
def process_rfid_scan(uid_str):
    """Handle a card scan: update local logs and sync to IWMS."""
    global current_mode, attendance

    print("\nRFID:", uid_str, " mode:", current_mode)

    # Clear the status box
    display.fill_rectangle(15, 115, 290, 65, BLACK)
    display.fill_rectangle(15, 115, 4, 65, WHITE)

    # ── Unknown card ──────────────────────────────────────────
    if uid_str not in user_db:
        beep(3)
        display.set_font(tt24)
        display.set_color(RED, BLACK)
        display.set_pos(25, 122)
        display.print("ACCESS DENIED")
        display.set_font(glcdfont)
        display.set_pos(25, 155)
        display.print("Unknown RFID Card")
        time.sleep(3)
        current_mode = "NONE"
        draw_main_desktop()
        return

    name = user_db[uid_str]
    date_str, time_str = get_display_time()
    iso_ts = get_iso_timestamp()
    hr, mn = get_hour_minute()

    # Abort if RTC is in unknown state
    if date_str == "1970-01-01":
        beep(2)
        current_mode = "NONE"
        draw_main_desktop()
        return

    # Prepare local flags
    flags = []
    if current_mode == "IN":
        if hr > config.LATE_HOUR or (hr == config.LATE_HOUR and mn > 0):
            flags.append("LATE")
    elif current_mode == "OUT":
        if hr < config.EARLY_LEAVE_HOUR:
            flags.append("EARLY LEAVE")

    # Try online validation first if connected
    online_success = False
    if wifi_sync.is_connected():
        print("Device is online. Trying server-side validation…")
        ok, status_code, resp = wifi_sync.post_event(
            uid_str, name, "clock_in" if current_mode == "IN" else "clock_out", iso_ts, flags
        )
        
        if ok:
            # 2xx Success: update local log to match the server state
            online_success = True
            if date_str not in attendance:
                attendance[date_str] = {}
            if uid_str not in attendance[date_str]:
                attendance[date_str][uid_str] = {
                    "name":  name,
                    "in":    None,
                    "out":   None,
                    "hours": 0,
                    "flags": [],
                }
            record = attendance[date_str][uid_str]

            if current_mode == "IN":
                record["in"] = time_str
                record["flags"] = flags
                
                status_text = "ON TIME"
                display.set_color(GREEN, BLACK)
                if isinstance(resp, dict) and resp.get("status") == "late":
                    status_text = "LATE"
                    display.set_color(YELLOW, BLACK)
                
                beep(1)
                display.set_font(tt24)
                display.set_pos(25, 122)
                display.print(status_text)
                display.set_font(glcdfont)
                display.set_pos(25, 155)
                display.print(name)
            else:
                # clock_out
                record["out"] = time_str
                record["flags"] = flags
                hours = 0
                if isinstance(resp, dict):
                    hours = resp.get("hoursWorked", 0)
                record["hours"] = hours
                
                status_text = "CLOCK OUT"
                display.set_color(GREEN, BLACK)
                if "EARLY LEAVE" in flags:
                    status_text = "EARLY OUT"
                    display.set_color(YELLOW, BLACK)
                
                beep(1)
                display.set_font(tt24)
                display.set_pos(25, 122)
                display.print(status_text)
                display.set_font(glcdfont)
                display.set_pos(25, 150)
                display.print(name)
                display.set_pos(25, 165)
                display.print("Hours: " + str(hours))

            save_json(config.LOG_FILE, attendance)

        elif status_code in (404, 409):
            # Server validation error: show the conflict/error exactly and do NOT log locally.
            online_success = True  # We handled it based on server response
            
            if status_code == 409:
                # Conflict: already in / out
                beep(2)
                display.set_font(tt24)
                display.set_color(YELLOW, BLACK)
                display.set_pos(25, 122)
                if current_mode == "IN":
                    display.print("ALREADY IN")
                else:
                    display.print("ALREADY OUT")
                display.set_font(glcdfont)
                display.set_pos(25, 155)
                display.print("Already punched today")
            else:
                # 404: Not Found (no clock-in record found for today)
                beep(3)
                display.set_font(tt24)
                display.set_color(RED, BLACK)
                display.set_pos(25, 122)
                display.print("NO CLOCK IN")
                display.set_font(glcdfont)
                display.set_pos(25, 155)
                display.print("Clock IN First")

        else:
            # Temporary network / server 5xx error -> Fall back to local validation
            print("Server returned temporary error code ({}). Falling back to offline mode…".format(status_code))

    # Offline fallback (if not handled by online validation)
    if not online_success:
        # Ensure today's log entry exists
        if date_str not in attendance:
            attendance[date_str] = {}
        if uid_str not in attendance[date_str]:
            attendance[date_str][uid_str] = {
                "name":  name,
                "in":    None,
                "out":   None,
                "hours": 0,
                "flags": [],
            }
        record = attendance[date_str][uid_str]

        # ── CLOCK IN ──────────────────────────────────────────────
        if current_mode == "IN":
            if record["out"] is not None:
                beep(2)
                display.set_font(tt24)
                display.set_color(YELLOW, BLACK)
                display.set_pos(25, 122)
                display.print("DAY CLOSED")
                display.set_font(glcdfont)
                display.set_pos(25, 155)
                display.print("Already Clocked Out")

            elif record["in"] is not None:
                beep(2)
                display.set_font(tt24)
                display.set_color(YELLOW, BLACK)
                display.set_pos(25, 122)
                display.print("ALREADY IN")
                display.set_font(glcdfont)
                display.set_pos(25, 155)
                display.print("IN: " + record["in"])

            else:
                # Valid clock-in
                record["in"] = time_str
                record["flags"] = flags

                if "LATE" in flags:
                    status_text = "LATE"
                    display.set_color(YELLOW, BLACK)
                else:
                    status_text = "ON TIME"
                    display.set_color(GREEN, BLACK)

                beep(1)
                display.set_font(tt24)
                display.set_pos(25, 122)
                display.print(status_text)
                display.set_font(glcdfont)
                display.set_pos(25, 155)
                display.print(name)

                save_json(config.LOG_FILE, attendance)

                # ── Sync to IWMS ──────────────────────────────────
                if not wifi_sync.is_connected():
                    wifi_sync.post_event(uid_str, name, "clock_in", iso_ts, flags)

        # ── CLOCK OUT ─────────────────────────────────────────────
        elif current_mode == "OUT":
            if record["in"] is None:
                beep(3)
                display.set_font(tt24)
                display.set_color(RED, BLACK)
                display.set_pos(25, 122)
                display.print("NO CLOCK IN")
                display.set_font(glcdfont)
                display.set_pos(25, 155)
                display.print("Clock IN First")

            elif record["out"] is not None:
                beep(2)
                display.set_font(tt24)
                display.set_color(YELLOW, BLACK)
                display.set_pos(25, 122)
                display.print("ALREADY OUT")
                display.set_font(glcdfont)
                display.set_pos(25, 155)
                display.print("OUT: " + record["out"])

            else:
                # Valid clock-out
                record["out"] = time_str
                record["flags"] = flags

                if "EARLY LEAVE" in flags:
                    status_text = "EARLY OUT"
                    display.set_color(YELLOW, BLACK)
                else:
                    status_text = "CLOCK OUT"
                    display.set_color(GREEN, BLACK)

                record["hours"] = hours_worked(record["in"], record["out"])

                beep(1)
                display.set_font(tt24)
                display.set_pos(25, 122)
                display.print(status_text)
                display.set_font(glcdfont)
                display.set_pos(25, 150)
                display.print(name)
                display.set_pos(25, 165)
                display.print("Hours: " + str(record["hours"]))

                save_json(config.LOG_FILE, attendance)

                # ── Sync to IWMS ──────────────────────────────────
                if not wifi_sync.is_connected():
                    wifi_sync.post_event(uid_str, name, "clock_out", iso_ts, flags)

    time.sleep(3)
    current_mode = "NONE"
    draw_main_desktop()

# ── App screens ───────────────────────────────────────────────────────────────
def app_register():
    display.set_color(WHITE, BLACK)
    display.erase()
    draw_header()
    display.set_font(tt24)
    display.set_pos(20, 5)
    display.print("ENROLL USERS")
    display.set_font(glcdfont)
    display.set_pos(20, 60)
    display.print("Place RFID Card On Reader")
    display.set_pos(20, 215)
    display.print("[ Touch Screen To Exit ]")

    while True:
        st, _ = reader.request()
        if st == 0:
            st, raw_uid = reader.anticoll()
            if st == 0:
                uid_str = "-".join(str(x) for x in raw_uid[:4])
                display.fill_rectangle(15, 100, 290, 90, DARK_GY)

                if uid_str in user_db:
                    beep(2)
                    display.set_font(tt24)
                    display.set_color(YELLOW, DARK_GY)
                    display.set_pos(20, 115)
                    display.print("EXISTS")
                    display.set_font(glcdfont)
                    display.set_pos(20, 150)
                    display.print(user_db[uid_str])
                    time.sleep(2)
                else:
                    beep(1)
                    display.set_font(tt24)
                    display.set_color(WHITE, DARK_GY)
                    display.set_pos(20, 115)
                    display.print("NEW CARD")
                    display.set_font(glcdfont)
                    display.set_pos(20, 150)
                    display.print("Enter Name in Shell")
                    print("\n================================")
                    print("NEW CARD:", uid_str)
                    print("Enter employee name:")
                    name = input().strip() or "User_{}".format(len(user_db) + 1)
                    user_db[uid_str] = name
                    save_json(config.DB_FILE, user_db)
                    display.fill_rectangle(15, 100, 290, 90, GREEN)
                    display.set_font(tt24)
                    display.set_color(WHITE, GREEN)
                    display.set_pos(20, 115)
                    display.print("SAVED")
                    display.set_font(glcdfont)
                    display.set_pos(20, 150)
                    display.print(name)
                    beep(1)
                    time.sleep(2)

        if touch.read():
            break
        time.sleep_ms(50)

def app_logs():
    display.set_color(WHITE, BLACK)
    display.erase()
    draw_header()
    display.set_font(tt24)
    display.set_pos(20, 5)
    display.print("TODAY LOGS")
    display.set_font(glcdfont)

    date_str, _ = get_display_time()
    day_logs = attendance.get(date_str, {})

    y = 50
    if not day_logs:
        display.set_pos(20, 80)
        display.print("No Attendance Yet")
    else:
        for uid in day_logs:
            if y > 200:
                break
            rec = day_logs[uid]
            display.set_pos(10, y);  display.print(rec["name"][:12])
            display.set_pos(120, y); display.print(rec["in"]  or "--")
            display.set_pos(180, y); display.print(rec["out"] or "--")
            y += 15

    display.set_pos(20, 220)
    display.print("[ Touch To Exit ]")

    while True:
        if touch.read():
            break
        time.sleep_ms(50)

def app_data_dump():
    display.set_color(WHITE, BLACK)
    display.erase()
    draw_header()
    display.set_font(tt24)
    display.set_pos(20, 5)
    display.print("SYSTEM DATA")
    display.set_font(glcdfont)

    display.set_pos(20, 70);  display.print("Registered Users:")
    display.set_pos(200, 70); display.print(str(len(user_db)))
    display.set_pos(20, 90);  display.print("Log Days Stored:")
    display.set_pos(200, 90); display.print(str(len(attendance)))
    display.set_pos(20, 110); display.print("WiFi:")
    display.set_pos(200, 110)
    ip = wifi_sync.ip_address()
    display.print(ip if ip else "offline")
    display.set_pos(20, 130); display.print("Queued Events:")
    display.set_pos(200, 130); display.print(str(wifi_sync.queue_length()))
    display.set_pos(20, 160); display.print("Dumping JSON to Shell…")

    print("\n========== USERS ==========")
    print(json.dumps(user_db))
    print("\n======= ATTENDANCE =========")
    print(json.dumps(attendance))

    display.set_pos(20, 220)
    display.print("[ Touch To Exit ]")

    while True:
        if touch.read():
            break
        time.sleep_ms(50)

def app_about():
    display.set_color(WHITE, BLACK)
    display.erase()
    draw_header()
    display.set_font(tt24)
    display.set_pos(50, 70)
    display.print("STEMAIDER")
    display.set_font(glcdfont)
    display.set_pos(35, 110); display.print("Attendance System v3")
    display.set_pos(35, 130); display.print("Pico 2 W + RFID + WiFi")
    ip = wifi_sync.ip_address()
    display.set_pos(35, 150)
    display.print("IP: " + (ip if ip else "offline"))
    display.set_pos(35, 220)
    display.print("[ Touch To Exit ]")
    while True:
        if touch.read():
            break
        time.sleep_ms(50)

# ── Startup ───────────────────────────────────────────────────────────────────
draw_main_desktop()

print("\n====================================")
print("  STEMAIDER ATTENDANCE SYSTEM v3")
print("  Raspberry Pi Pico 2 W")
print("  Connecting to WiFi…")
print("====================================")
wifi_sync.connect()   # Non-blocking if it fails; retried in main loop
print("Registered users:", list(user_db.keys()))
print()

# ── Main loop ─────────────────────────────────────────────────────────────────
while True:
    now = time.ticks_ms()

    # ── WiFi housekeeping (reconnect + flush offline queue) ───────────────────
    wifi_sync.tick(now)

    # ── RFID scanner ──────────────────────────────────────────────────────────
    if current_mode != "NONE":
        st, _ = reader.request()
        if st == 0:
            st, raw_uid = reader.anticoll()
            if st == 0 and time.ticks_diff(now, last_scan_ms) > 1500:
                last_scan_ms = now
                uid_str = "-".join(str(x) for x in raw_uid[:4])
                process_rfid_scan(uid_str)

    # ── Touch handler ─────────────────────────────────────────────────────────
    pos = touch.read()
    if pos and time.ticks_diff(now, last_touch_ms) >= 300:
        last_touch_ms = now
        x, y = pos
        print("Touch:", x, y)

        if   15 <= x <= 150 and 50 <= y <= 105:    # Clock In
            current_mode = "IN"
            beep(1)
            draw_main_desktop()

        elif 160 <= x <= 305 and 50 <= y <= 105:   # Clock Out
            current_mode = "OUT"
            beep(1)
            draw_main_desktop()

        elif 195 <= y <= 233:                       # Bottom menu
            beep(1)
            if   15 <= x <= 80:
                app_register();  draw_main_desktop()
            elif 90 <= x <= 155:
                app_logs();      draw_main_desktop()
            elif 160 <= x <= 225:
                app_data_dump(); draw_main_desktop()
            elif 230 <= x <= 295:
                app_about();     draw_main_desktop()

        while touch.read():   # wait for finger lift
            time.sleep_ms(20)

    # ── Hourly log cleanup ────────────────────────────────────────────────────
    if time.ticks_diff(now, last_cleanup_ms) >= config.CLEANUP_INTERVAL:
        last_cleanup_ms = now
        cleanup_logs()

    time.sleep_ms(50)
