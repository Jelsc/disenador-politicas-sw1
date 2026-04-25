# Migración de `departmentId` a `departmentIds`

Esta migración convierte usuarios viejos que todavía tienen:

- `departmentId: "abc123"`

a:

- `departmentIds: ["abc123"]`

y además elimina el campo viejo `departmentId`.

## Cuándo ejecutarla

Ejecutala **solo si ya tenés datos previos** en Mongo creados antes del cambio a múltiples departamentos.

## Comando

```bash
mongosh "mongodb://localhost:27017/tuapp" docs/migrate-users-departmentId-to-departmentIds.js
```

## Qué hace

1. Busca usuarios con `departmentId` válido.
2. Crea `departmentIds` con ese valor dentro de un array.
3. Borra `departmentId`.
4. Normaliza usuarios sin departamentos para que queden con `departmentIds: []`.

## Validación rápida

En `mongosh`:

```javascript
db.users.find({}, { username: 1, role: 1, departmentIds: 1, departmentId: 1 })
```

Después de migrar:

- `departmentId` no debería existir.
- `departmentIds` debería existir siempre.

## Importante

Los `OPERATOR` deberían quedar con al menos un departamento válido. Si alguno queda con `departmentIds: []`, eso indica datos previos inconsistentes y conviene corregirlos manualmente desde la administración o directamente en Mongo.
