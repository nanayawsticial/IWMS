import time
import machine
import json
import network
try:
    import requests
except ImportError:
    import urequests as requests

import config

def start_pairing_flow(display, touch, tt24, glcdfont):
    # Colors
    WHITE = 0xFFFF
    BLACK = 0x0000
    GREEN = 0x07E0
    RED = 0xF800
    DARK_GY = 0x18C3
    ACCENT = 0x3186

    # Ensure WiFi is active and connected
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    
    # Enable power management for client connection stability
    try:
        wlan.config(pm=0xa7a0c0)
    except:
        pass

    # Show initial screen
    display.set_color(WHITE, BLACK)
    display.erase()
    display.fill_rectangle(0, 0, 320, 35, ACCENT)
    display.set_font(tt24)
    display.set_color(WHITE, ACCENT)
    display.set_pos(45, 5)
    display.print("DEVICE PAIRING")

    display.set_font(glcdfont)
    display.set_color(WHITE, BLACK)
    display.set_pos(15, 60)
    display.print("Connecting to WiFi: " + config.WIFI_SSID)

    # Reconnect if not connected
    if not wlan.isconnected():
        wlan.connect(config.WIFI_SSID, config.WIFI_PASSWORD)
        retries = 0
        while not wlan.isconnected() and retries < 40:
            time.sleep_ms(250)
            retries += 1

    if not wlan.isconnected():
        display.set_color(RED, BLACK)
        display.set_pos(15, 80)
        display.print("WiFi connection failed!")
        display.set_color(WHITE, BLACK)
        display.set_pos(15, 100)
        display.print("Check credentials in config.py")
        
        # Render EXIT button
        display.fill_rectangle(90, 180, 140, 35, DARK_GY)
        display.set_color(WHITE, DARK_GY)
        display.set_pos(145, 192)
        display.print("EXIT")
        
        while True:
            pos = touch.read()
            if pos:
                tx, ty = pos
                if 90 <= tx <= 230 and 180 <= ty <= 215:
                    break
            time.sleep_ms(100)
        return False

    display.set_color(GREEN, BLACK)
    display.set_pos(15, 80)
    display.print("Connected! IP: " + wlan.ifconfig()[0])
    time.sleep(1)

    while True:
        # Request pairing code
        display.set_color(WHITE, BLACK)
        display.erase()
        display.fill_rectangle(0, 0, 320, 35, ACCENT)
        display.set_font(tt24)
        display.set_color(WHITE, ACCENT)
        display.set_pos(45, 5)
        display.print("DEVICE PAIRING")

        display.set_font(glcdfont)
        display.set_color(WHITE, BLACK)
        display.set_pos(15, 65)
        display.print("Fetching pairing code from:")
        display.set_color(GREEN, BLACK)
        display.set_pos(15, 85)
        display.print(config.SERVER_URL)

        url = config.SERVER_URL.rstrip('/') + "/api/devices/pairing-code"
        pairing_code = None
        
        try:
            res = requests.post(url, timeout=10)
            if res.status_code == 201:
                data = res.json()
                pairing_code = data.get("code")
            res.close()
        except Exception as e:
            print("Pairing: failed to get code:", e)

        if not pairing_code:
            display.set_color(RED, BLACK)
            display.set_pos(15, 115)
            display.print("Server connection failed!")
            display.set_color(WHITE, BLACK)
            display.set_pos(15, 135)
            display.print("Retrying in 5 seconds...")
            
            # Draw CANCEL button
            display.fill_rectangle(90, 180, 140, 35, DARK_GY)
            display.set_color(WHITE, DARK_GY)
            display.set_pos(135, 192)
            display.print("CANCEL")
            
            # Wait 5 seconds or cancel click
            start_wait = time.ticks_ms()
            canceled = False
            while time.ticks_diff(time.ticks_ms(), start_wait) < 5000:
                pos = touch.read()
                if pos:
                    tx, ty = pos
                    if 90 <= tx <= 230 and 180 <= ty <= 215:
                        canceled = True
                        break
                time.sleep_ms(50)
            if canceled:
                return False
            continue

        # Display pairing code
        display.set_color(WHITE, BLACK)
        display.erase()
        display.fill_rectangle(0, 0, 320, 35, ACCENT)
        display.set_font(tt24)
        display.set_color(WHITE, ACCENT)
        display.set_pos(45, 5)
        display.print("DEVICE PAIRING")

        display.set_font(glcdfont)
        display.set_color(WHITE, BLACK)
        display.set_pos(15, 55)
        display.print("1. Open the IWMS dashboard Settings.")
        display.set_pos(15, 75)
        display.print("2. Click 'Pair Physical Device'.")
        display.set_pos(15, 95)
        display.print("3. Enter this pairing code:")

        # Show 6-digit code in large font (using tt24)
        display.set_font(tt24)
        display.set_color(GREEN, BLACK)
        # Format code as XXX XXX
        formatted_code = pairing_code[:3] + " " + pairing_code[3:]
        display.set_pos(100, 120)
        display.print(formatted_code)

        # Draw CANCEL button
        display.set_font(glcdfont)
        display.fill_rectangle(90, 185, 140, 35, DARK_GY)
        display.set_color(WHITE, DARK_GY)
        display.set_pos(135, 197)
        display.print("CANCEL")

        # Poll status
        status_url = config.SERVER_URL.rstrip('/') + "/api/devices/pair/status?code=" + pairing_code
        paired = False
        expired = False
        canceled = False

        print("Pairing: starting polling for code", pairing_code)
        
        while not paired and not expired and not canceled:
            # Check touch for Cancel click
            pos = touch.read()
            if pos:
                tx, ty = pos
                if 90 <= tx <= 230 and 185 <= ty <= 220:
                    canceled = True
                    break

            try:
                res = requests.get(status_url, timeout=2)
                if res.status_code == 200:
                    data = res.json()
                    if data.get("paired"):
                        device_id = data.get("deviceId")
                        device_key = data.get("deviceKey")
                        paired = True
                        break
                elif res.status_code == 400:
                    data = res.json()
                    if data.get("expired"):
                        expired = True
                        break
                res.close()
            except Exception as e:
                # Ignore temporary network errors during polling
                pass

            # Wait 3 seconds with touch check
            for _ in range(60):
                pos = touch.read()
                if pos:
                    tx, ty = pos
                    if 90 <= tx <= 230 and 185 <= ty <= 220:
                        canceled = True
                        break
                time.sleep_ms(50)

        if canceled:
            print("Pairing canceled by user")
            return False

        if expired:
            print("Pairing code expired, fetching a new one")
            continue

        if paired:
            print("Pairing SUCCESS! Saving credentials...")
            display.set_color(WHITE, BLACK)
            display.erase()
            display.set_font(tt24)
            display.set_color(GREEN, BLACK)
            display.set_pos(70, 80)
            display.print("PAIRED SUCCESS!")
            
            display.set_font(glcdfont)
            display.set_color(WHITE, BLACK)
            display.set_pos(40, 125)
            display.print("Saving credentials & rebooting...")

            config_data = {
                "wifi_ssid": config.WIFI_SSID,
                "wifi_password": config.WIFI_PASSWORD,
                "server_url": config.SERVER_URL,
                "device_id": device_id,
                "device_key": device_key
            }

            try:
                with open("local_config.json", "w") as f:
                    json.dump(config_data, f)
                print("Pairing: Config saved to local_config.json")
            except Exception as e:
                print("Pairing: Error saving config:", e)

            time.sleep(2)
            machine.reset()
