# Especificación: Expansión Fase 2 - Gestión de Usuarios y Departamentos

## 1. Intención y Contexto
Completar la infraestructura organizacional del sistema antes de introducir el motor de políticas. El sistema no puede asignar tareas de un trámite si no existen departamentos, ni puede ejecutarlas si no hay funcionarios asignados a ellos. 

Esta expansión abarca el CRUD completo de Departamentos y el CRUD de Usuarios, estableciendo la relación entre ellos y aplicando un control de acceso estricto basado en 4 roles fundamentales.

## 2. Definición de Roles (RBAC)

1. **ADMINISTRADOR (ADMIN)**
   - **Acceso:** Plataforma Web.
   - **Responsabilidad:** Control total del sistema.
   - **Permisos:** Gestión de usuarios, departamentos, configuraciones globales y auditoría.

2. **DISEÑADOR (DESIGNER)**
   - **Acceso:** Plataforma Web.
   - **Responsabilidad:** Creación y mantenimiento de las Políticas de Negocio.
   - **Permisos:** Leer usuarios/departamentos (para poder diseñar asignaciones en las políticas), crear/editar flujos y políticas.

3. **FUNCIONARIO (OPERATOR)**
   - **Acceso:** Plataforma Web.
   - **Responsabilidad:** Atención directa y procesamiento de trámites.
   - **Permisos:** 
     - Pertenece a uno o más **Departamentos**.
     - **Inicia trámites** a nombre del cliente (valida datos, selecciona política, adjunta documentos iniciales).
     - Ejecuta las tareas que la política de negocio asigna a su(s) departamento(s).

4. **CLIENTE (CLIENT)**
   - **Acceso:** Aplicación Móvil (y portal web de solo lectura si aplica).
   - **Responsabilidad:** Consumidor final del trámite.
   - **Permisos:** Seguimiento de estado de sus trámites, recepción de notificaciones, y ejecución de acciones atómicas externas (ej. Firma Electrónica). No inicia trámites.

## 3. Requerimientos de Backend (Spring Boot)

### 3.1. Gestión de Departamentos (Department)
- **Modelo:** `id`, `name`, `description`, `isActive`, `createdAt`, `updatedAt`.
- **Endpoints:**
  - `GET /api/departments` (Lista paginada / Todos activos).
  - `GET /api/departments/{id}` (Detalle).
  - `POST /api/departments` (Crear - Solo ADMIN).
  - `PUT /api/departments/{id}` (Actualizar - Solo ADMIN).
  - `PATCH /api/departments/{id}/status` (Activar/Desactivar - Soft delete).

### 3.2. Gestión de Usuarios (User)
*Ampliación del modelo base de la Fase 2.*
- **Regla central de administración:** El **ADMINISTRADOR** es quien decide al crear o editar un usuario si será `DESIGNER`, `OPERATOR` o `CLIENT`. El sistema no permite autoasignación de roles ni cambio de rol por parte del propio usuario.
- **Modelo Actualizado:** `id`, `username`, `email`, `password`, `role`, `isActive`, `departmentIds` (Relación N:M o 1:N con Departamentos).
- **Validación de negocio:**
  - Si `role = OPERATOR`, `departmentIds` es obligatorio y debe contener al menos un departamento válido.
  - Si `role = DESIGNER`, `ADMIN` o `CLIENT`, `departmentIds` debe enviarse vacío o ignorarse en backend.
- **Endpoints:**
  - `GET /api/users` (Lista con filtros por rol y departamento).
  - `GET /api/users/{id}` (Detalle incluyendo departamentos asignados).
  - `POST /api/users` (Crear usuario - Asigna rol y departamentos. Contraseña generada o por defecto).
  - `PUT /api/users/{id}` (Actualizar datos, rol y departamentos).
  - `PATCH /api/users/{id}/status` (Activar/Desactivar acceso).

## 4. Requerimientos de Frontend (Angular)

Aplicando las reglas de la skill `interface-design` (intent-driven, clean UI):

### 4.1. Pantalla: Gestión de Departamentos
- **Layout:** Vista de lista (Tabla) con buscador.
- **Acciones:** Botón principal "Nuevo Departamento" abre un *Slide-over* (Panel lateral) o *Modal* limpio para no perder el contexto de la lista.
- **Datos visibles:** Nombre, Descripción, Cantidad de Funcionarios (opcional), Estado (Badge Activo/Inactivo).

### 4.2. Pantalla: Gestión de Usuarios
- **Layout:** Tabla con buscador y filtros (Dropdowns para filtrar por Rol y por Departamento).
- **Acciones:** Botón "Nuevo Usuario" abre un *Slide-over*.
- **Formulario de Usuario:**
  - Datos personales (Nombre, Email).
  - Selector de Rol (Select) administrado exclusivamente por el **ADMINISTRADOR**, quien decide si el usuario será Diseñador, Funcionario o Cliente.
  - Selector múltiple de Departamentos que **aparece únicamente** si el rol seleccionado es **FUNCIONARIO**.
  - Si el rol cambia de **FUNCIONARIO** a otro distinto, la UI debe limpiar la selección de departamentos para evitar datos inconsistentes.
  - Si el rol es **DISEÑADOR**, **ADMINISTRADOR** o **CLIENTE**, el bloque de departamentos no se muestra.

## 5. Criterios de Aceptación
- [ ] Un usuario administrador puede crear, editar y deshabilitar departamentos.
- [ ] Un usuario administrador define el rol del usuario al momento de alta o edición.
- [ ] Un usuario administrador puede crear funcionarios y asignarlos a múltiples departamentos.
- [ ] Si el rol elegido es FUNCIONARIO, el formulario exige al menos un departamento antes de guardar.
- [ ] Si el rol elegido no es FUNCIONARIO, el formulario no muestra selector de departamentos y el backend no persiste departamentos para ese usuario.
- [ ] La UI frontend respeta el shell unificado (`DashboardComponent`) y carga estos submódulos solo si el rol del usuario logueado es ADMIN.
- [ ] Los endpoints están protegidos verificando el token JWT y el rol `ADMIN`.
- [ ] Un Funcionario no puede asignarse permisos ni editar su propio rol.
