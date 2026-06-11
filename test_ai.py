import requests

url = "http://localhost/ai/form/assist"
data = {
    "text": "El cliente se llama Juan Pérez y la descripción del caso anota que tuvo un problema grave con el enrutador principal en la zona sur.",
    "formFields": [
        {"id": "id-desc", "label": "Descripción del caso", "type": "LONG_TEXT"},
        {"id": "id-nombre", "label": "Nombre Completo", "type": "SHORT_TEXT"}
    ]
}

response = requests.post(url, json=data)
print(response.status_code)
print(response.json())
