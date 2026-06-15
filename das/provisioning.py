import network
import usocket as socket
import ujson as json
import utime as time
import machine
import gc

import config

# Colors for screen
WHITE = 0xFFFF
BLACK = 0x0000
GREEN = 0x07E0
RED = 0xF800
ACCENT = 0x3186

SETUP_HTML_TEMPLATE = """<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IWMS Device Setup</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: #0f172a;
            color: #f1f5f9;
            margin: 0;
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            box-sizing: border-box;
        }
        .card {
            background: rgba(30, 41, 59, 0.7);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 30px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
        }
        h1 {
            font-size: 24px;
            font-weight: 700;
            margin-top: 0;
            margin-bottom: 20px;
            text-align: center;
            background: linear-gradient(135deg, #38bdf8, #818cf8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .error {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #fca5a5;
            padding: 10px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 14px;
            text-align: center;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 8px;
            font-size: 14px;
            font-weight: 500;
            color: #94a3b8;
        }
        input {
            width: 100%;
            padding: 12px;
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            color: #fff;
            font-size: 16px;
            box-sizing: border-box;
            transition: border-color 0.2s;
        }
        input:focus {
            outline: none;
            border-color: #6366f1;
        }
        button {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #6366f1, #4f46e5);
            border: none;
            border-radius: 8px;
            color: #fff;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
            transition: opacity 0.2s;
        }
        button:active {
            opacity: 0.9;
        }
        .footer {
            margin-top: 25px;
            text-align: center;
            font-size: 12px;
            color: #64748b;
        }
    </style>
</head>
<body>
    <div class="card">
        <h1>IWMS SETUP</h1>
        {error_placeholder}
        <form method="POST" action="/">
            <div class="form-group">
                <label for="ssid">WiFi Network Name (SSID)</label>
                <input type="text" id="ssid" name="ssid" placeholder="Enter network name" required>
            </div>
            <div class="form-group">
                <label for="password">WiFi Password</label>
                <input type="password" id="password" name="password" placeholder="Enter password">
            </div>
            <div class="form-group">
                <label for="server_url">IWMS Server URL</label>
                <input type="text" id="server_url" name="server_url" value="{server_url_default}" required>
            </div>
            <button type="submit">Connect Device</button>
        </form>
        <div class="footer">STEMAIDER Attendance Terminal</div>
    </div>
</body>
</html>
"""

SUCCESS_HTML = """<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WiFi Configured</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: #0f172a;
            color: #f1f5f9;
            margin: 0;
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            box-sizing: border-box;
        }
        .card {
            background: rgba(30, 41, 59, 0.7);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 30px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
            text-align: center;
        }
        h1 {
            font-size: 24px;
            font-weight: 700;
            color: #10b981;
            margin-top: 0;
            margin-bottom: 20px;
        }
        p {
            color: #94a3b8;
            font-size: 16px;
            line-height: 1.5;
            margin-bottom: 25px;
        }
        .spinner {
            border: 4px solid rgba(255, 255, 255, 0.1);
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border-left-color: #10b981;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="card">
        <h1>WiFi Saved!</h1>
        <p>The device will now restart and connect to your network. You can close this window now.</p>
        <div class="spinner"></div>
    </div>
</body>
</html>
"""

class DNSServer:
    def __init__(self, ip='192.168.4.1'):
        self.ip = ip
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.socket.bind(('0.0.0.0', 53))
        self.socket.setblocking(False)

    def handle(self):
        try:
            data, addr = self.socket.recvfrom(512)
            transaction_id = data[:2]
            # Standard query response flags, questions:1, answer:1
            packet = transaction_id + b"\x81\x80\x00\x01\x00\x01\x00\x00\x00\x00"
            idx = 12
            while idx < len(data) and data[idx] != 0:
                idx += data[idx] + 1
            if idx + 5 <= len(data):
                query_section = data[12:idx+5]
                packet += query_section
                ip_bytes = bytes(map(int, self.ip.split('.')))
                # A Record pointer reference, type A, class IN, TTL 60s, length 4
                packet += b"\xc0\x0c\x00\x01\x00\x01\x00\x00\x00\x3c\x00\x04" + ip_bytes
                self.socket.sendto(packet, addr)
        except OSError:
            pass
        except Exception as e:
            print("DNS error:", e)

    def close(self):
        try:
            self.socket.close()
        except:
            pass

def url_decode(s):
    s = s.replace("+", " ")
    parts = s.split("%")
    res = parts[0]
    for part in parts[1:]:
        if len(part) >= 2:
            try:
                hex_val = int(part[:2], 16)
                res += chr(hex_val) + part[2:]
            except:
                res += "%" + part
        else:
            res += "%" + part
    return res

def parse_urlencoded(body):
    params = {}
    if not body:
        return params
    pairs = body.split("&")
    for pair in pairs:
        if "=" in pair:
            parts = pair.split("=", 1)
            k = parts[0]
            v = parts[1] if len(parts) > 1 else ""
            params[url_decode(k)] = url_decode(v)
    return params

def build_setup_page(error_msg="", server_url_default="http://192.168.2.50:3001"):
    error_html = ""
    if error_msg:
        error_html = '<div class="error">{}</div>'.format(error_msg)
    
    html = SETUP_HTML_TEMPLATE.replace("{error_placeholder}", error_html)
    html = html.replace("{server_url_default}", server_url_default)
    return html

def start_provisioning(display, touch, tt24, glcdfont):
    # 1. Access Point Setup
    ap = network.WLAN(network.AP_IF)
    ap.active(True)
    
    ssid = getattr(config, "PROVISION_SSID", "IWMS-Setup")
    device_id = getattr(config, "DEVICE_ID", None)
    if device_id:
        ssid = "{}-{}".format(ssid, device_id)
        
    ap.config(essid=ssid, security=0)
    
    # Enable power management override for setup mode stability
    try:
        ap.config(pm=0xa7a0c0)
    except:
        pass

    # 2. Display Setup Info on Screen
    display.set_color(WHITE, BLACK)
    display.erase()
    display.fill_rectangle(0, 0, 320, 35, ACCENT)
    display.set_font(tt24)
    display.set_color(WHITE, ACCENT)
    display.set_pos(45, 5)
    display.print("WIFI SETUP MODE")
    
    display.set_font(glcdfont)
    display.set_color(WHITE, BLACK)
    display.set_pos(15, 60)
    display.print("1. Connect to WiFi network:")
    display.set_color(GREEN, BLACK)
    display.set_pos(30, 80)
    display.print(ssid)
    
    display.set_color(WHITE, BLACK)
    display.set_pos(15, 110)
    display.print("2. Open web browser and go to:")
    display.set_color(GREEN, BLACK)
    display.set_pos(30, 130)
    display.print("http://192.168.4.1")
    
    display.set_color(WHITE, BLACK)
    display.set_pos(15, 160)
    display.print("3. Enter your WiFi credentials.")
    
    # 3. DNS + HTTP Servers Setup
    dns_server = DNSServer('192.168.4.1')
    
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(('0.0.0.0', 80))
    s.listen(1)
    s.settimeout(0.05)  # non-blocking HTTP socket accept
    
    print("AP started. SSID:", ssid)
    print("Provisioning HTTP and DNS servers running concurrently...")
    
    start_time = time.ticks_ms()
    timeout_ms = 10 * 60 * 1000  # 10 minutes fallback
    
    try:
        while True:
            # 10-minute fallback check
            if time.ticks_diff(time.ticks_ms(), start_time) > timeout_ms:
                print("Provisioning idle timeout reached. Rebooting...")
                machine.reset()
                
            # Keep DNS listener handling requests concurrently
            dns_server.handle()
            
            try:
                conn, addr = s.accept()
            except OSError:
                # Socket timeout, just continue concurrent loop
                continue
                
            print("HTTP client connected from:", addr)
            conn.settimeout(3.0)
            
            try:
                request = b""
                while True:
                    data = conn.recv(1024)
                    if not data:
                        break
                    request += data
                    if b"\r\n\r\n" in request or b"\n\n" in request:
                        break
                
                req_str = request.decode('utf-8', 'ignore')
                req_lines = req_str.split("\n")
                first_line = req_lines[0] if req_lines else ""
                
                if "POST" in first_line:
                    content_length = 0
                    for line in req_lines:
                        if line.lower().startswith("content-length:"):
                            content_length = int(line.split(":")[1].strip())
                            break
                    
                    parts = req_str.split("\r\n\r\n")
                    body = parts[1] if len(parts) > 1 else ""
                    
                    remaining = content_length - len(body.encode('utf-8'))
                    if remaining > 0:
                        body += conn.recv(remaining).decode('utf-8', 'ignore')
                        
                    params = parse_urlencoded(body)
                    submitted_ssid = params.get("ssid", "").strip()
                    submitted_password = params.get("password", "").strip()
                    submitted_server_url = params.get("server_url", "").strip()
                    
                    if submitted_ssid:
                        config_data = {}
                        try:
                            with open("local_config.json", "r") as f:
                                config_data = json.load(f)
                        except:
                            pass
                        
                        config_data["wifi_ssid"] = submitted_ssid
                        config_data["wifi_password"] = submitted_password
                        if submitted_server_url:
                            config_data["server_url"] = submitted_server_url
                            
                        with open("local_config.json", "w") as f:
                            json.dump(config_data, f)
                            
                        print("WiFi credentials successfully saved to local_config.json")
                        
                        conn.sendall(b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n")
                        conn.sendall(SUCCESS_HTML.encode('utf-8'))
                        conn.close()
                        
                        # Display feedback
                        display.fill_rectangle(15, 190, 290, 45, GREEN)
                        display.set_color(WHITE, GREEN)
                        display.set_pos(25, 205)
                        display.print("SAVED! REBOOTING...")
                        
                        time.sleep(2)
                        machine.reset()
                    else:
                        conn.sendall(b"HTTP/1.1 400 Bad Request\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n")
                        conn.sendall(build_setup_page("SSID is required!").encode('utf-8'))
                else:
                    # Catch-all GET: serve the setup page (triggers captive portal redirect)
                    default_url = getattr(config, "SERVER_URL", "http://192.168.2.50:3001")
                    conn.sendall(b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n")
                    conn.sendall(build_setup_page(server_url_default=default_url).encode('utf-8'))
            except Exception as e:
                print("Error handling HTTP request:", e)
            finally:
                try:
                    conn.close()
                except:
                    pass
            gc.collect()
    finally:
        dns_server.close()
        try:
            s.close()
        except:
            pass
        ap.active(False)
