"""
ds1302.py — MicroPython driver for the DS1302 Real-Time Clock
3-wire protocol (CLK, DAT, RST) — NOT I2C, NOT SPI

Wiring to Pico 2 W:
  DS1302 VCC  →  3V3 out  (pin 36)
  DS1302 GND  →  GND      (pin 38)
  DS1302 CLK  →  GP20     (pin 26)
  DS1302 DAT  →  GP21     (pin 27)
  DS1302 RST  →  GP22     (pin 29)

Usage:
    from machine import Pin
    from ds1302 import DS1302

    rtc = DS1302(clk=Pin(20), dat=Pin(21), rst=Pin(22))

    # Set time ONCE (comment out after first successful set):
    rtc.datetime((2026, 6, 8, 0, 9, 30, 0, 0))

    # Read time any time:
    year, month, day, wday, hour, minute, second, _ = rtc.datetime()

The CR2032 battery keeps the DS1302 running when the Pico has no power,
so you only need to set the time once per battery life (~5 years).
"""

from machine import Pin
import time


class DS1302:
    """
    Driver for DS1302 RTC using bit-banged 3-wire serial protocol.
    datetime() uses the same tuple format as machine.RTC.datetime():
        (year, month, day, weekday, hour, minute, second, subsecond)
        weekday: 0 = Monday … 6 = Sunday
    """

    # Register addresses (write = even, read = odd)
    _REG_SEC  = 0x80   # Seconds       bit7 = Clock-Halt (CH)
    _REG_MIN  = 0x82   # Minutes
    _REG_HOUR = 0x84   # Hours         bit6=0 → 24-hour mode
    _REG_DATE = 0x86   # Day of month
    _REG_MON  = 0x88   # Month
    _REG_WDAY = 0x8A   # Day of week   1-7 on chip
    _REG_YEAR = 0x8C   # Year          00-99
    _REG_WP   = 0x8E   # Write Protect bit7=1 → locked

    def __init__(self, clk, dat, rst):
        # Accept either a raw GPIO number (int) or an already-constructed Pin object
        self._clk = Pin(clk, Pin.OUT) if isinstance(clk, int) else clk
        self._dat = Pin(dat, Pin.OUT) if isinstance(dat, int) else dat
        self._rst = Pin(rst, Pin.OUT) if isinstance(rst, int) else rst
        self._clk.value(0)
        self._rst.value(0)

    # ── BCD conversion ────────────────────────────────────────────────────────

    @staticmethod
    def _b2d(bcd):
        return (bcd >> 4) * 10 + (bcd & 0x0F)

    @staticmethod
    def _d2b(dec):
        return ((dec // 10) << 4) | (dec % 10)

    # ── Bit-bang protocol ─────────────────────────────────────────────────────

    def _write_byte(self, byte):
        """Send 8 bits LSB-first, data clocked on rising edge."""
        self._dat.init(Pin.OUT)
        for _ in range(8):
            self._dat.value(byte & 0x01)
            byte >>= 1
            self._clk.value(1)
            time.sleep_us(2)
            self._clk.value(0)
            time.sleep_us(2)

    def _read_byte(self):
        """Receive 8 bits LSB-first, sampled before rising edge."""
        self._dat.init(Pin.IN)
        result = 0
        for i in range(8):
            result |= (self._dat.value() << i)
            self._clk.value(1)
            time.sleep_us(2)
            self._clk.value(0)
            time.sleep_us(2)
        return result

    def _write_reg(self, reg, val):
        """Raw write to a register (WP must be unlocked first)."""
        self._rst.value(1)
        time.sleep_us(4)
        self._write_byte(reg & 0xFE)   # bit0 = 0 → write command
        self._write_byte(val)
        self._rst.value(0)
        self._clk.value(0)
        time.sleep_us(4)

    def _read_reg(self, reg):
        """Raw read from a register."""
        self._rst.value(1)
        time.sleep_us(4)
        self._write_byte(reg | 0x01)   # bit0 = 1 → read command
        val = self._read_byte()
        self._rst.value(0)
        self._clk.value(0)
        time.sleep_us(4)
        return val

    # ── Write protection ──────────────────────────────────────────────────────

    def _unlock(self):
        """Clear WP bit so registers can be written."""
        self._write_reg(self._REG_WP, 0x00)

    def _lock(self):
        """Set WP bit to prevent accidental overwrites."""
        self._write_reg(self._REG_WP, 0x80)

    # ── Public API ────────────────────────────────────────────────────────────

    def datetime(self, dt=None):
        """
        Get or set the current date and time.

        SET  →  rtc.datetime((2026, 6, 8, 0, 9, 30, 0, 0))
        GET  →  year, month, day, wday, hour, minute, second, _ = rtc.datetime()
        """
        if dt is not None:
            year, month, day, wday, hour, minute, second, _ = dt
            self._unlock()
            # Clear CH bit in seconds to start the oscillator
            self._write_reg(self._REG_SEC,  self._d2b(second)       & 0x7F)
            self._write_reg(self._REG_MIN,  self._d2b(minute))
            self._write_reg(self._REG_HOUR, self._d2b(hour)         & 0x3F)  # 24h
            self._write_reg(self._REG_DATE, self._d2b(day))
            self._write_reg(self._REG_MON,  self._d2b(month))
            self._write_reg(self._REG_WDAY, self._d2b((wday % 7) + 1))      # chip uses 1-7
            self._write_reg(self._REG_YEAR, self._d2b(year % 100))
            self._lock()
        else:
            second = self._b2d(self._read_reg(self._REG_SEC)  & 0x7F)
            minute = self._b2d(self._read_reg(self._REG_MIN)  & 0x7F)
            hour   = self._b2d(self._read_reg(self._REG_HOUR) & 0x3F)
            day    = self._b2d(self._read_reg(self._REG_DATE))
            month  = self._b2d(self._read_reg(self._REG_MON))
            wday   = (self._b2d(self._read_reg(self._REG_WDAY)) - 1) % 7   # back to 0-6
            year   = 2000 + self._b2d(self._read_reg(self._REG_YEAR))
            return (year, month, day, wday, hour, minute, second, 0)

    def is_running(self):
        """Return True if the clock oscillator is running (CH bit = 0)."""
        return not bool(self._read_reg(self._REG_SEC) & 0x80)

    def start(self):
        """Start the clock if it was halted (e.g. fresh chip / new battery)."""
        sec = self._read_reg(self._REG_SEC)
        if sec & 0x80:
            self._unlock()
            self._write_reg(self._REG_SEC, sec & 0x7F)
            self._lock()