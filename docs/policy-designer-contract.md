# Contrato del diseñador de políticas

Este documento deja cerrado el criterio de diseño antes de implementar la vista del funcionario y la simulación.

## Separación de niveles

- **Pizarra colaborativa**: define el flujo ejecutable de la política con nodos Inicio, Tarea, Decisión, Paralelo, Unión y Fin.
- **Formulario del funcionario**: vive dentro de una Tarea y define los campos que llenará el operador/funcionario.
- **Cliente mobile**: no llena el formulario operativo; ve progreso, hitos visibles y firma touch cuando una tarea lo solicita.

## Flujo del diseñador

1. Crear política.
2. Diseñar el diagrama en la pizarra.
3. Agregar nodos de flujo.
4. Dar doble click sobre una Tarea.
5. Diseñar el formulario operativo del funcionario.
6. Configurar reglas generales de tarea y campos.
7. Guardar formulario y volver a la pizarra.
8. Crear una versión interna del diseño.
9. Publicar solo si el flujo pasa las validaciones.

## Criterios de aceptación por nodo

### Inicio

- Debe existir exactamente un nodo Inicio.
- No puede tener entradas.
- Debe tener al menos una salida.
- No contiene formulario.
- Configura mensaje inicial, estado inicial y condición de inicio.
- En ejecución, activa la primera tarea conectada al Inicio.

### Tarea

- Representa trabajo real del funcionario.
- Debe tener departamento responsable.
- Debe tener tipo de tarea y tiempo estimado.
- Debe tener formulario operativo con al menos un campo.
- Si solicita firma touch al cliente, debe incluir un campo `Firma cliente`.
- Puede reflejar datos/hitos al cliente, pero el cliente no edita el formulario operativo.

### Decisión

- Debe tener al menos dos salidas.
- Debe tener campo evaluado.
- Debe tener condiciones/ramas configuradas.
- Debe tener camino por defecto.
- No contiene formulario propio.
- Solo puede evaluar campos capturados por tareas y marcados como `Usar para decisión`.

### Paralelo

- Debe tener al menos una entrada.
- Debe tener dos o más salidas.
- Su modo inicial es `Activar todas las ramas`.
- Permite varias tareas activas al mismo tiempo.
- El flujo debe converger luego mediante una Unión.

### Unión

- Debe tener dos o más entradas.
- Debe tener al menos una salida.
- La regla inicial es unión total: espera todas las ramas requeridas.
- No contiene formulario propio.

### Fin

- Debe existir al menos un nodo Fin.
- No puede tener salidas.
- Define estado final del trámite.
- Puede configurar mensaje visible al cliente, notificación y documento final.

## Versionado

- El nombre de la política es el nombre público/operativo y no se reemplaza por el nombre de una versión.
- El nombre de versión es interno del diseño.
- La política inicia en `v1.0.0`.
- Cada versión interna incrementa el patch: `1.0.0` → `1.0.1` → `1.0.2`.
- Al guardar una versión, primero se guarda el borrador actual para no perder cambios no guardados.

## Zona horaria

- Las fechas visibles se muestran en zona horaria de Bolivia: `America/La_Paz`.
