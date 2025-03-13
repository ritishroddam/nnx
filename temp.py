import requests

url = "http://64.227.137.175:8888/ignitionReport/fetch_ignition_report"
payload = {
    "license_plate_number": "KA25BB2393",
    "from_date": "2025-03-12T00:00",
    "to_date": "2025-03-12T23:59"
}
headers = {
    "Content-Type": "application/json"
}

response = requests.post(url, json=payload, headers=headers)

print(response.status_code)
print(response.text)  # Print the raw response text for debugging

try:
    print(response.json())
except requests.exceptions.JSONDecodeError:
    print("Response is not in JSON format")