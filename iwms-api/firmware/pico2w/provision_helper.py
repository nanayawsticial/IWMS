import json
import binascii
import sys

def xor_crypt(data, key):
    data_bytes = data if isinstance(data, (bytes, bytearray)) else data.encode('utf-8')
    key_bytes = key if isinstance(key, (bytes, bytearray)) else key.encode('utf-8')
    out = bytearray(len(data_bytes))
    for i in range(len(data_bytes)):
        out[i] = data_bytes[i] ^ key_bytes[i % len(key_bytes)]
    return out

def obfuscate(plain_text, key):
    if not plain_text:
        return ""
    encrypted = xor_crypt(plain_text, key)
    return binascii.b2a_base64(encrypted).decode('utf-8').strip()

def main():
    print("==============================================")
    print("IWMS Pico 2 W Terminal Provisioning Helper")
    print("==============================================")
    
    wifi_ssid = input("WiFi SSID: ").strip()
    wifi_password = input("WiFi Password: ").strip()
    api_base = input("Backend API Base URL (e.g. https://api.company.com): ").strip()
    device_serial = input("Device Serial Number (e.g. pico-gate-01): ").strip()
    device_key = input("Raw Device Key (from IWMS UI): ").strip()
    
    if not wifi_ssid or not device_serial or not device_key:
        print("\nERROR: WiFi SSID, Device Serial, and Device Key are required!")
        sys.exit(1)
        
    obfuscated_key = obfuscate(device_key, device_serial)
    
    config_data = {
        "WIFI_SSID": wifi_ssid,
        "WIFI_PASSWORD": wifi_password,
        "API_BASE": api_base,
        "DEVICE_SERIAL": device_serial,
        "DEVICE_KEY_OBFUSCATED": obfuscated_key
    }
    
    output_file = "config.json"
    with open(output_file, "w") as f:
        json.dump(config_data, f, indent=4)
        
    print(f"\nSUCCESS: Generated {output_file} successfully!")
    print("Copy both 'main.py' and 'config.json' to the root directory of your Pico 2 W.")
    print("==============================================")

if __name__ == "__main__":
    main()
