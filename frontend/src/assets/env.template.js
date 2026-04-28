(function(window) {
  window["env"] = window["env"] || {};
  // Estas variables seran reemplazadas por Nginx al arrancar el contenedor
  window["env"]["apiUrl"] = "${API_URL}";
  window["env"]["aiUrl"] = "${AI_URL}";
  window["env"]["wsUrl"] = "${WS_URL}";
})(this);