import network
import socket
import time
import machine
import json
import os

HTML_PAGE = """<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>IWMS Biometric Setup</title>
    <style>
        body { font-family: -apple-system, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 20px; margin: 0; }
        .card { background-color: #1e293b; padding: 20px; border-radius: 12px; max-width: 400px; margin: 0 auto; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        h2 { text-align: center; color: #3b82f6; margin-top: 0; }
        label { display: block; margin: 12px 0 6px; font-size: 14px; font-weight: bold; color: #94a3b8; }
        input[type="text"], input[type="password"] { width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #334155; background-color: #0f172a; color: #fff; box-sizing: border-box; }
        button { width: 100%; padding: 12px; background-color: #3b82f6; border: none; border-radius: 6px; color: white; font-weight: bold; font-size: 16px; margin-top: 20px; cursor: pointer; }
        button:hover { background-color: #2563eb; }
        .footer { text-align: center; font-size: 12px; color: #64748b; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="card">
        <h2>IWMS Terminal Setup</h2>
        <form method="POST" action="/save">
            <label>WiFi SSID</label>
            <input type="text" name="ssid" placeholder="Enter WiFi Name" required>
            
            <label>WiFi Password</label>
            <input type="password" name="password" placeholder="Enter WiFi Password">
            
            <label>Server URL</label>
            <input type="text" name="server_url" placeholder="e.g. http://192.168.1.100:3001" required>
            
            <label>Device ID</label>
            <input type="text" name="device_id" placeholder="e.g. pico-gate-01" required>
            
            <label>Device API Key</label>
            <input type="text" name="device_key" placeholder="iwms_live_..." required>
            
            <button type="submit">Save & Reboot</button>
        </form>
    </div>
    <div class="footer">STEMAIDER IWMS Biometric Terminal</div>
</body>
</html>
"""

HTML_SUCCESS = """<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Setup Successful</title>
    <style>
        body { font-family: -apple-system, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 20px; margin: 0; text-align: center; }
        .card { background-color: #1e293b; padding: 30px; border-radius: 12px; max-width: 400px; margin: 50px auto; }
        h2 { color: #10b981; }
        p { color: #94a3b8; }
    </style>
</head>
<body>
    <div class="card">
        <h2>Setup Saved!</h2>
        <p>The device is rebooting to connect to your WiFi and server. You can close this window now.</p>
    </div>
</body>
</html>
"""

def parse_urlencoded(body):
    params = {}
    if not body:
        return params
    for pair in body.split('&'):
        if '=' in pair:
            key, val = pair.split('=', 1)
            # Basic URL decoding
            val = val.replace('+', ' ')
            i = 0
            res = []
            while i < len(val):
                if val[i] == '%' and i + 2 < len(val):
                    try:
                        res.append(chr(int(val[i+1:i+3], 16)))
                        i += 3
                    except:
                        res.append(val[i])
                        i += 1
                else:
                    res.append(val[i])
                    i += 1
            params[key] = "".join(res)
    return params

def start_ap_setup(display, touch, tt24, glcdfont):
    # Colours
    WHITE = 0xFFFF
    BLACK = 0x0000
    GREEN = 0x07E0
    RED = 0xF800
    DARK_GY = 0x18C3
    ACCENT = 0x3186

    # 1. Turn off STA WiFi
    sta = network.WLAN(network.STA_IF)
    sta.active(False)

    # 2. Start AP WiFi
    ap = network.WLAN(network.AP_IF)
    ap.active(True)
    ap.config(essid="IWMS-Biometric-Setup", password="")
    
    # 3. Wait for AP to initialize
    while not ap.active():
        time.sleep_ms(100)

    ap_ip = ap.ifconfig()[0]

    # 4. Render AP Setup screen on LCD
    display.set_color(WHITE, BLACK)
    display.erase()
    
    # Draw header
    display.fill_rectangle(0, 0, 320, 35, ACCENT)
    display.set_font(tt24)
    display.set_color(WHITE, ACCENT)
    display.set_pos(35, 5)
    display.print("WIFI & API SETUP")
    
    # Details
    display.set_font(glcdfont)
    display.set_color(WHITE, BLACK)
    display.set_pos(15, 55);  display.print("Hotspot started successfully.")
    display.set_pos(15, 75);  display.print("1. Connect your phone/laptop to WiFi:")
    display.set_color(GREEN, BLACK)
    display.set_pos(25, 95);  display.print("IWMS-Biometric-Setup")
    display.set_color(WHITE, BLACK)
    display.set_pos(15, 115); display.print("2. Open your browser and go to:")
    display.set_color(GREEN, BLACK)
    display.set_pos(25, 135); display.print("http://" + ap_ip)
    
    # Draw Cancel button
    display.fill_rectangle(90, 180, 140, 35, DARK_GY)
    display.set_color(WHITE, DARK_GY)
    display.set_pos(135, 192)
    display.print("CANCEL")

    # 5. Start web server
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(('', 80))
    s.listen(1)
    s.settimeout(0.2)  # Non-blocking timeout

    print("AP Web Server running on http://{}:80/".format(ap_ip))

    success = False
    config_data = None
    canceled = False

    while not canceled and not success:
        # Check touch to cancel
        pos = touch.read()
        if pos:
            tx, ty = pos
            if 90 <= tx <= 230 and 180 <= ty <= 215:
                # Cancel clicked
                canceled = True
                break

        try:
            conn, addr = s.accept()
        except OSError:
            # Timeout, check touch again
            continue

        try:
            request = conn.recv(1024).decode('utf-8')
        except Exception:
            conn.close()
            continue

        if not request:
            conn.close()
            continue

        # Simple route checking
        lines = request.split('\r\n')
        if not lines:
            conn.close()
            continue

        req_line = lines[0]
        method, path, _ = req_line.split(' ')

        if method == 'GET' and (path == '/' or path == '/index.html'):
            # Serve the form
            conn.send('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n')
            conn.send(HTML_PAGE)
        elif method == 'POST' and path == '/save':
            # Find Content-Length and body
            content_length = 0
            for line in lines:
                if line.lower().startswith('content-length:'):
                    content_length = int(line.split(':')[1].strip())
                    break
            
            # Retrieve body
            body_parts = request.split('\r\n\r\n', 1)
            body = body_parts[1] if len(body_parts) > 1 else ""
            
            # Read remainder of the body if not fully captured in first recv
            while len(body) < content_length:
                body += conn.recv(1024).decode('utf-8')

            params = parse_urlencoded(body)

            # Check required fields
            if 'ssid' in params and 'server_url' in params and 'device_id' in params and 'device_key' in params:
                config_data = {
                    "wifi_ssid": params['ssid'],
                    "wifi_password": params.get('password', ''),
                    "server_url": params['server_url'].rstrip('/'),
                    "device_id": params['device_id'],
                    "device_key": params['device_key']
                }
                success = True
                
                # Send success page
                conn.send('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n')
                conn.send(HTML_SUCCESS)
            else:
                conn.send('HTTP/1.1 400 Bad Request\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nMissing parameters.')
        else:
            # 404
            conn.send('HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nNot Found')

        conn.close()

    # Clean up socket
    s.close()
    
    # Disable AP Mode
    ap.active(False)

    if success and config_data:
        display.set_color(WHITE, BLACK)
        display.erase()
        display.set_font(tt24)
        display.set_pos(30, 80)
        display.print("SAVING CONFIG...")
        display.set_font(glcdfont)
        display.set_pos(30, 120)
        display.print("Device will reboot now.")
        
        # Save to local_config.json
        try:
            with open("local_config.json", "w") as f:
                json.dump(config_data, f)
            print("AP: Config saved to local_config.json")
        except Exception as e:
            print("AP: Error saving config:", e)

        time.sleep(2)
        machine.reset()  # Reboot Pico
    else:
        print("AP: Setup canceled by user")
