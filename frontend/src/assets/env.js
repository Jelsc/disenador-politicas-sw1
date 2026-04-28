(function(window) {
  window["env"] = window["env"] || {};
  // Estas variables seran reemplazadas por Nginx al arrancar el contenedor
  window["env"]["apiUrl"] = "http://localhost:8080/api";
  window["env"]["aiUrl"] = "http://localhost:8000";
  window["env"]["wsUrl"] = "ws://localhost:8080/ws";
})(this);