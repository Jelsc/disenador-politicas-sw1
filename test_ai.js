const fetch = require('node-fetch');

async function test() {
    const response = await fetch("http://localhost/ai/form/assist", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            "text": "El cliente se llama Juan Pérez y la descripción del caso anota que tuvo un problema grave con el enrutador principal en la zona sur.",
            "formFields": [
                {"id": "id-desc", "label": "Descripción del caso", "type": "LONG_TEXT"},
                {"id": "id-nombre", "label": "Nombre Completo", "type": "SHORT_TEXT"}
            ]
        })
    });
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
}

test();
