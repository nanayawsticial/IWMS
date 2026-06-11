# set_time.py — Run this ONCE to set the DS1302 to the correct date and time.
# After running, the CR2032 battery keeps the clock ticking even when
# the Pico is off. You only need this again if you replace the battery.
#
# Steps:
#   1. Look at the current time on your phone/computer
#   2. Edit the values below to match
#   3. Run this script in Thonny (press F5)
#   4. Check the output — it should show the correct time
#   5. Run test_rtc.py to confirm the seconds are counting up

from machine import Pin
from ds1302 import DS1302

# ── UPDATE THESE VALUES TO THE CURRENT TIME ───────────────────────────────────

YEAR    = 2026
MONTH   = 6       # 1-12
DAY     = 9       # 1-31

WEEKDAY = 1       # 0=Monday  1=Tuesday  2=Wednesday  3=Thursday
                  # 4=Friday  5=Saturday  6=Sunday

HOUR    = 2       # 24-hour clock (e.g. 2 = 2 AM, 14 = 2 PM)
MINUTE  = 0      # ← change this to the current minute
SECOND  = 0       # Start from 0, run immediately after saving

# ─────────────────────────────────────────────────────────────────────────────

rtc = DS1302(20, 21, 22)

print("Setting DS1302...")
rtc.datetime((YEAR, MONTH, DAY, WEEKDAY, HOUR, MINUTE, SECOND, 0))

# Read back to confirm
t = rtc.datetime()
days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

print()
print("=" * 36)
print("  DS1302 time set successfully!")
print("=" * 36)
print("  Date   : {:04d}-{:02d}-{:02d}".format(t[0], t[1], t[2]))
print("  Day    : {}".format(days[t[3]]))
print("  Time   : {:02d}:{:02d}:{:02d}".format(t[4], t[5], t[6]))
print("  Running: {}".format(rtc.is_running()))
print("=" * 36)
print()

if not rtc.is_running():
    print("WARNING: Clock is not running!")
    print("Check your wiring:")
    print("  CLK -> GP20,  DAT -> GP21,  RST -> GP22")
    print("  VCC -> 3V3,   GND -> GND")
else:
    print("Clock is running. Now run test_rtc.py to verify.")