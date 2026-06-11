(function(window) {
  window["env"] = window["env"] || {};
  // Estas variables seran reemplazadas por Nginx al arrancar el contenedor
  window["env"]["apiUrl"] = "/api";
  window["env"]["aiUrl"] = "/ai";
  window["env"]["wsUrl"] = "ws://" + (window.location ? window.location.host : "localhost") + "/ws";
})(this);