# Notas Créditos Front

Sistema de gestión de notas de crédito/débito y órdenes de devolución de material. Frontend desarrollado con Angular 21 standalone, arquitectura por features, estado reactivo con signals y comunicación en tiempo real vía WebSockets.

---

## Tabla de contenidos

1. [Stack técnico](#stack-técnico)
2. [Requisitos e inicio rápido](#requisitos-e-inicio-rápido)
3. [Configuración de entorno](#configuración-de-entorno)
4. [Estructura del proyecto](#estructura-del-proyecto)
5. [Enrutamiento completo](#enrutamiento-completo)
6. [Arquitectura y patrones](#arquitectura-y-patrones)
7. [Capa HTTP](#capa-http)
8. [Autenticación y seguridad](#autenticación-y-seguridad)
9. [Servicios core](#servicios-core)
10. [Interfaces de datos](#interfaces-de-datos)
11. [Features — descripción detallada](#features--descripción-detallada)
12. [Componentes compartidos](#componentes-compartidos)
13. [Estado reactivo (Signals)](#estado-reactivo-signals)
14. [Tiempo real — WebSockets](#tiempo-real--websockets)
15. [Internacionalización](#internacionalización)
16. [Flujo de negocio](#flujo-de-negocio)
17. [Permisos y roles](#permisos-y-roles)
18. [Cómo agregar un módulo nuevo](#cómo-agregar-un-módulo-nuevo)
19. [Build y calidad](#build-y-calidad)

---

## Stack técnico

| Tecnología | Versión | Propósito |
|---|---|---|
| Angular | 21.1.0 | Framework principal (standalone components) |
| TypeScript | 5.9.2 | Tipado estático |
| RxJS | 7.8.0 | Programación reactiva / streams HTTP |
| Tailwind CSS | v4 | Estilos utilitarios |
| @ngx-translate | 17.0.0 | Internacionalización (es/en) |
| lucide-angular | 0.564.0 | Iconografía SVG |
| ng2-charts + chart.js | 8 / 4.5 | Gráficas del dashboard |
| ngx-toastr | 20.0.5 | Notificaciones toast |
| pdfmake | 0.3.5 | Generación de PDFs |
| xlsx | 0.18.5 | Exportación Excel |
| laravel-echo + pusher-js | 2.3 / 8.5 | WebSockets (Laravel Reverb) |
| moment | 2.30.1 | Manipulación de fechas |
| Vitest + jsdom | 4 / 27 | Pruebas unitarias |

---

## Requisitos e inicio rápido

**Requisitos:**
- Node.js LTS reciente
- npm 10+ (el proyecto declara `npm@10.8.1`)
- Angular CLI 21 (opcional global; puede usarse con `npx ng`)

**Instalación y ejecución:**

```bash
npm install
npm run start
# App disponible en http://localhost:4200/
```

**Scripts:**

| Script | Comando Angular | Descripción |
|---|---|---|
| `npm run start` | `ng serve` | Servidor de desarrollo con hot reload |
| `npm run build` | `ng build` | Compilación de producción optimizada |
| `npm run watch` | `ng build --watch` | Build en modo observación |
| `npm run test` | `ng test` (Vitest) | Pruebas unitarias |

---

## Configuración de entorno

La URL base de la API y la configuración de WebSocket no se manejan con `environment.ts`. En su lugar se usa un objeto global inyectado en tiempo de ejecución:

```typescript
// src/app/core/config/runtime-config.ts
window.__appRuntimeConfig = {
  apiBaseUrl: 'https://api.midominio.com',
  socketHost: 'sockets.midominio.com',
  socketPort: 6001,
  socketProtocol: 'https'
}
```

Esto permite configurar la app sin recompilar (útil para Docker/CI). Si no se define `window.__appRuntimeConfig`, los servicios usan valores por defecto.

---

## Estructura del proyecto

```
src/
└── app/
    ├── core/                        # Infraestructura transversal
    │   ├── config/
    │   │   └── runtime-config.ts    # Configuración dinámica API/sockets
    │   ├── constants/
    │   │   └── action-permission-map.ts  # Mapa acción → slugs de permiso
    │   ├── guards/
    │   │   ├── auth.guard.ts        # Protege rutas autenticadas
    │   │   ├── login.guard.ts       # Redirige usuarios ya logueados
    │   │   └── action.guard.ts      # Valida permisos por acción de ruta
    │   ├── interceptors/
    │   │   ├── auth-expiration.interceptor.ts   # Maneja 401 y bloqueo IP (423)
    │   │   └── impersonation.interceptor.ts     # Agrega X-Impersonate-User-Id
    │   └── services/                # 21 servicios core (ver sección dedicada)
    │
    ├── data/
    │   ├── interfaces/              # Contratos de tipos para API
    │   │   ├── ApiResponse-interface.ts
    │   │   ├── Request.ts
    │   │   ├── User.ts
    │   │   ├── Customer.ts
    │   │   ├── Workflow.ts
    │   │   ├── Notification.ts
    │   │   ├── DashboardChart.ts
    │   │   └── RequestService.ts
    │   └── form-fields-config.json  # Configuración de campos de formularios
    │
    ├── features/                    # Módulos por dominio funcional
    │   ├── auth/                    # Login, cambio de contraseña
    │   ├── dashboard/               # Estadísticas y gráficas
    │   ├── requests/                # Nueva solicitud, borradores, carga masiva
    │   │   └── components/shared/
    │   │       └── request-form-workflow-constraints.ts  # Reglas de enable/disable por rol y paso de workflow
    │   ├── pending/                 # Solicitudes pendientes paginadas
    │   ├── approvals/
    │   │   └── return-orders-approval/  # Aprobación de órdenes de devolución
    │   ├── clients/                 # Facturas, órdenes de devolución por cliente
    │   ├── history/                 # Historial de flujo de solicitudes
    │   ├── notifications/           # Centro de notificaciones
    │   ├── pages/
    │   │   └── my-approvals/        # Mis aprobaciones pendientes
    │   ├── profile/                 # Perfil de usuario
    │   ├── settings/                # Administración (usuarios, roles, workflows, etc.)
    │   └── not-found/               # Página 404
    │
    ├── shared/                      # Reutilizables
    │   ├── components/
    │   │   ├── ui/                  # Modal, Badge, Table, Spinner, Select, etc.
    │   │   ├── sidebar/
    │   │   ├── navbar/
    │   │   ├── footer/
    │   │   └── impersonation-banner/
    │   └── directives/
    │       └── click-outside.directive.ts
    │
    ├── app.routes.ts                # Definición de rutas principal
    ├── app.config.ts                # Bootstrapping, providers globales
    └── main.ts                      # Punto de entrada
```

---

## Enrutamiento completo

**Raíz:**
- `/` → redirige a `/auth`
- `**` → redirige a `/app/404`

### Rutas públicas (`/auth/*`) — guarda: `LoginGuard`

| Ruta | Propósito |
|---|---|
| `/auth/login` | Formulario de inicio de sesión |
| `/auth/change-password` | Cambio forzado de contraseña (primer login o reset) |

> `LoginGuard` redirige a `/app/dashboard` si ya hay sesión activa.

### Rutas protegidas (`/app/*`) — guarda: `AuthGuard`

| Ruta | Componente | Guard adicional | Propósito |
|---|---|---|---|
| `/app/dashboard` | Dashboard | — | Estadísticas y gráficas |
| `/app/request/new-request` | NewRequest | ActionGuard | Crear nueva solicitud |
| `/app/request/drafts` | Drafts | ActionGuard | Borradores del usuario |
| `/app/request/bulk-upload` | BulkUpload | ActionGuard | Carga masiva CSV/Excel |
| `/app/my-approvals` | MyApprovals | — | Aprobaciones pendientes del usuario |
| `/app/my-profile` | Profile | — | Perfil de usuario |
| `/app/approvals/return-orders` | ReturnOrdersApproval | — | Gestión de órdenes de devolución |
| `/app/clients` | Clients | — | Facturas y órdenes de devolución por cliente |
| `/app/clients/orders` | ClientOrders | — | Historial de órdenes del cliente |
| `/app/clients/my-invoices` | MyInvoices | — | Facturas propias (rol CUSTOMER) |
| `/app/pending` | Pending | — | Solicitudes pendientes filtradas por tipo |
| `/app/history` | History | — | Historial de flujo de solicitudes |
| `/app/notifications` | Notifications | — | Centro de notificaciones |
| `/app/settings/users` | Users | — | CRUD de usuarios |
| `/app/settings/newCustomer` | NewCustomer | — | Crear cliente |
| `/app/settings/customers` | Customers | — | CRUD de clientes |
| `/app/settings/roles` | Roles | — | CRUD de roles |
| `/app/settings/roles/manage-permissions` | ManageRoles | — | Asignación de permisos |
| `/app/settings/system-configuration` | SysConfig | — | Configuración del sistema |
| `/app/settings/security-management` | SecurityManage | — | Gestión de seguridad e IPs |
| `/app/settings/workflows` | Workflows | — | Definición de flujos de aprobación |
| `/app/settings/assign-user` | AssignUser | — | Asignación masiva de usuarios |
| `/app/404` | NotFound | — | Página no encontrada |

> `AuthGuard`: si `mustChangePassword === true`, redirige a `/auth/change-password`.
> `ActionGuard`: valida que el usuario tenga el slug de acción definido en `route.data['requiredAction']`.

---

## Arquitectura y patrones

### Standalone components

Todos los componentes usan `standalone: true`. No hay NgModules. Las dependencias se declaran directamente en el array `imports` de cada componente.

### Change detection: OnPush

Todos los componentes usan `ChangeDetectionStrategy.OnPush`. Esto requiere que los datos cambien por referencia (signals, Observables con async pipe).

### Feature-first

Cada feature es un directorio autónomo con sus propios componentes, servicios locales si los necesita, y plantillas. Las dependencias compartidas van a `shared/` o `core/`.

### Lazy loading

Todas las rutas cargan componentes con `import()` dinámico (lazy). Esto reduce el bundle inicial.

```typescript
// Ejemplo en app.routes.ts
{
  path: 'dashboard',
  loadComponent: () => import('./features/dashboard/dashboard').then(m => m.Dashboard)
}
```

---

## Capa HTTP

### HttpService (`core/services/http-service.ts`)

Wrapper sobre `HttpClient` de Angular. **Todos los servicios de datos usan HttpService, nunca HttpClient directamente.**

- **Base URL:** `runtimeConfig.apiBaseUrl`
- **withCredentials:** `true` (autenticación por cookies)
- **Timeout por defecto:** 10 segundos
- **Timeout para archivos:** 30 segundos

**Métodos disponibles:**

```typescript
get<T>(endpoint, options?)       // GET
post<T>(endpoint, data, options?) // POST
put<T>(endpoint, data, options?)  // PUT
patch<T>(endpoint, data, options?) // PATCH
delete<T>(endpoint, options?)     // DELETE
getBlob(endpoint, params?)        // Descarga de archivos
```

**Respuesta estándar (`ApiResponse<T>`):**

```typescript
{
  codeStatus: number      // Código HTTP del negocio
  success: boolean        // true = operación exitosa
  message?: string        // Mensaje legible
  data: T | null          // Payload tipado
  errors: any             // Errores de validación
  timestamp: string       // Fecha de la respuesta
}
```

### Interceptores

| Interceptor | Qué hace |
|---|---|
| `impersonationInterceptor` | Agrega header `X-Impersonate-User-Id` cuando SUPERADMIN impersona otro usuario. Se omite en rutas `/assets/` y `/auth/` |
| `authExpirationInterceptor` | Captura HTTP 401 → logout automático. Captura HTTP 423 o mensaje "IP bloqueada" → bloqueo de IP |

---

## Autenticación y seguridad

### Flujo de autenticación

```
1. Usuario ingresa credenciales → POST /auth/login
2. Backend responde con cookie de sesión (httpOnly)
3. AuthGuard llama checkSession() en cada navegación
   → GET /auth/verify (cacheado 60s)
4. Si mustChangePassword=true → redirect /auth/change-password
5. Logout → POST /auth/logout + limpia estado local
```

### Guardas

- **AuthGuard:** Requiere sesión activa. Si no hay sesión redirige a `/auth/login`. SUPERADMIN redirige siempre a `/app/my-profile`.
- **LoginGuard:** Previene que usuarios logueados accedan a `/auth/login`. Permite pasar a `/auth/change-password`.
- **ActionGuard:** Verifica que el usuario tenga el permiso de acción definido en `route.data['requiredAction']` (slug de permiso).

### Bloqueo de IP

Si el backend responde HTTP 423 o el mensaje contiene "IP bloqueada", el `authExpirationInterceptor` llama `AuthService.handleIpBlockedSession()`, lo que cierra la sesión y muestra un error.

### Impersonación (SUPERADMIN)

El SUPERADMIN puede impersonar a cualquier usuario:
1. `ImpersonationService.start(userId)` → guarda en `sessionStorage`
2. `impersonationInterceptor` agrega `X-Impersonate-User-Id: {userId}` a cada petición
3. La barra de impersonación (`ImpersonationBanner`) se muestra visualmente
4. `ImpersonationService.stop()` (o logout) elimina la impersonación

---

## Servicios core

### AuthService

| Método | Endpoint | Descripción |
|---|---|---|
| `login(credentials)` | POST `/auth/login` | Inicia sesión |
| `checkSession(force?)` | GET `/auth/verify` | Verifica sesión (caché 60s) |
| `logout()` | POST `/auth/logout` | Cierra sesión |
| `changePassword(pwd, confirm)` | POST `/auth/change-password` | Cambia contraseña |
| `mustChangePassword()` | — | Verifica si debe cambiar contraseña |

### RequestService

Maneja el ciclo de vida completo de solicitudes (notas de crédito/débito).

| Método | Endpoint | Descripción |
|---|---|---|
| `saveRequest(form, attachments)` | POST `/requests/newRequest` | Crea solicitud con adjuntos |
| `getRequests(typeId, params)` | GET `/requests/{typeId}` | Lista paginada por tipo |
| `getMyPendingRequests(params)` | GET `/requests/pending/me` | Mis pendientes con filtros |
| `getDrafts(page, perPage)` | GET `/requests/drafts` | Lista de borradores |
| `saveDraft(form)` | POST `/requests/draft` | Guarda borrador |
| `deleteDraft(id)` | DELETE `/requests/drafts/{id}` | Elimina borrador |
| `approveRequest(id, comments?)` | POST `/requests/{id}/approve` | Aprueba solicitud |
| `rejectRequest(id, comments)` | POST `/requests/{id}/reject` | Rechaza solicitud |
| `sendBackRequest(id, stepId, comments)` | POST `/requests/{id}/send-back` | Regresa al paso anterior |
| `cancelRequest(id)` | POST `/requests/{id}/cancel` | Cancela solicitud |
| `approveMass(ids)` | POST `/requests/approve-mass` | Aprobación masiva |
| `rejectMass(ids, comments)` | POST `/requests/reject-mass` | Rechazo masivo |
| `getRequestHistory(id)` | GET `/requests/{id}/history` | Historial del flujo |
| `getRequestPdf(id)` | GET `/requests/{id}/pdf` | Descarga PDF |
| `getRequestAttachments(id)` | GET `/requests/{id}/attachments` | Adjuntos de solicitud |
| `getReasons(typeId)` | GET `/requests/reasons/{typeId}` | Razones (cacheadas) |
| `getExchangeRate()` | Banxico API externa | Tipo de cambio MXN/USD |

> **Nota CORS:** La API de Banxico no permite peticiones desde ciertos orígenes en producción. Si hay error de CORS en producción, el backend debe actuar como proxy para esa llamada.

### CustomerService

Gestiona clientes, facturas y órdenes de devolución.

| Método | Endpoint | Descripción |
|---|---|---|
| `getCustomers(params)` | GET `/customers` | Lista paginada de clientes |
| `getCustomersByName(term)` | GET `/customers/search?search=` | Búsqueda por nombre |
| `createReturnOrder(payload)` | POST `/return-orders` | Crea orden de devolución |
| `searchReturnOrders(query)` | GET `/return-orders/search?q=` | Busca órdenes |
| `getReturnOrderById(id)` | GET `/return-orders/{id}` | Detalle de orden |
| `updateReturnOrderCharge(id, payload)` | PATCH `/return-orders/{id}/charge` | Actualiza tipo de cargo |
| `getInvoices(clientId, chargeType, params)` | GET `/invoices/{clientId}/charge-type/{type}` | Facturas paginadas |
| `getInvoiceProducts(folio, clientId)` | GET `/invoices/{folio}/products/{clientId}` | Productos de factura |
| `getProductHistory(folio, clientId, index)` | GET `/invoices/{folio}/products/{clientId}/{index}/history` | Historial de devoluciones |
| `getChargeTypes()` | GET `/charge-types` | Tipos de cargo disponibles |

**Payload de creación de orden de devolución (`CreateReturnOrderRequest`):**
```typescript
{
  clientId: number
  notes?: string
  chargeTypeId: number
  currency: string     // 'MXN' | 'USD' — moneda seleccionada en el filtro
  items: {
    invoiceFolio: string
    invoiceClientId: number
    conceptoIndex: number
    requestedQuantity: number
  }[]
}
```

### ReturnOrderRequestService

Vincula órdenes de devolución con solicitudes y gestiona el proceso de validación de artículos.

| Método | Endpoint | Descripción |
|---|---|---|
| `getByRequestId(requestId)` | GET `/return-order-requests/by-request/{id}` | Orden ligada a solicitud |
| `updateItems(id, payload)` | PUT `/return-order-requests/{id}/items` | Actualiza cantidades aceptadas/rechazadas |

**Campos de artículo actualizables:**
- `sapId` — ID en SAP
- `replenishmentAccepted` — cantidad aceptada para reabasto
- `replenishmentReasonForRejection` — razón de rechazo de reabasto
- `warehouseReceived` — cantidad recibida en almacén
- `warehouseAccepted` — cantidad aceptada en almacén
- `warehouseReasonForRejection` — razón de rechazo en almacén

### UserService

| Método | Endpoint | Descripción |
|---|---|---|
| `getUsers()` | GET `/users` | Todos los usuarios |
| `getUsersPaginated(params)` | GET `/usersPag` | Paginado con filtros |
| `getMe()` | GET `/users/me` | Perfil del usuario autenticado |
| `saveUser(user)` | POST `/auth/register` | Crea usuario |
| `updateUser(id, data)` | PUT `/users/{id}` | Actualiza usuario |
| `deleteUser(id)` | DELETE `/users/{id}` | Soft delete |
| `changeMyPassword(old, new)` | PATCH `/users/me/password` | Cambia propia contraseña |
| `resetUserPassword(id, pwd)` | PATCH `/users/{id}/password` | Admin resetea contraseña |

### RoleService

| Método | Endpoint | Descripción |
|---|---|---|
| `getRoles()` | GET `/roles` | Lista de roles |
| `saveRole(role)` | POST `/roles` | Crea rol |
| `getSidebarPermissions()` | GET `/rolesPermission/sidebar` | Menú + acciones por módulo |
| `checkPermission(slug)` | POST `/rolesPermission/check` | Verifica permiso |
| `assignPermissions(payload)` | POST `/rolesPermission/assign` | Asignación masiva |
| `getRequestTypePermissions(roleId)` | GET `/requestTypePermissions/role/{id}` | Permisos por tipo |
| `assignRequestTypePermissions(payload)` | POST `/requestTypePermissions/assign` | Asigna permisos por tipo |

### WorkflowService

| Método | Endpoint | Descripción |
|---|---|---|
| `getWorkflows()` | GET `/workflowsteps/workflows` | Lista de workflows |
| `getWorkflowSteps(id)` | GET `/workflowsteps/workflow/{id}` | Pasos del workflow |
| `createWorkflow(data)` | POST `/workflows` | Crea workflow |
| `saveStep(step)` | POST `/workflowsteps` | Agrega paso |
| `getClassificationsGrouped()` | GET `/classifications/grouped` | Clasificaciones por tipo |

### NotificationService

Usa **signals** como fuente de verdad. Se actualiza vía polling y WebSocket.

```typescript
// Señales expuestas
notifications: Signal<AppNotification[]>
unreadNotifications: Signal<AppNotification[]>   // computed
unreadCount: Signal<number>                       // computed
lastError: Signal<string | null>
```

| Método | Endpoint | Descripción |
|---|---|---|
| `refreshUnreadNotifications()` | GET `/notifications/unread` | Actualiza no leídas |
| `refreshAllNotifications()` | GET `/notifications` | Todas las notificaciones |
| `markAsRead(id)` | PATCH `/notifications/{id}/read` | Marca como leída |

### SidebarService

Controla el menú lateral y los permisos de acción del usuario actual.

- `getSidebarData()` → GET `/rolesPermission/sidebar` (cacheado en sesión)
- `hasAction(slug: string)` → `boolean` — consulta la caché local de permisos
- `ensurePermissionsLoaded()` → `Observable<boolean>` — usado por `ActionGuard`

### BatchService

Procesamiento de archivos en lote (asíncrono). Las notificaciones de progreso llegan por socket.

| Método | Endpoint | Descripción |
|---|---|---|
| `createBatch(file, type, requestTypeId)` | POST `/batches` | Sube archivo para procesamiento |
| `createUploadSupportBatch(files[], min, max)` | POST `/batches` | Adjuntos de soporte en lote |
| `createSapReturnOrderBatch(formData)` | POST `/batches` | Órdenes SAP en lote |
| `createUsersBatch(file, options)` | POST `/batches` | Usuarios en lote |
| `getBatches(perPage, page, typeId?)` | GET `/batches` | Lista de batches |
| `getBatchDetail(batchId)` | GET `/batches/{id}/detail` | Errores y resumen |
| `getBatchRequests(batchId)` | GET `/batches/{id}/requests` | Items procesados |

### ExportService

| Método | Endpoint | Descripción |
|---|---|---|
| `exportExcel(module, params?)` | GET `/exports/excel` | Descarga Excel por módulo |

Módulos disponibles: `'users'`, `'clients'`, `'my_approvals'`, `'requests'`

---

## Interfaces de datos

### `ApiResponse<T>`
Envuelve todas las respuestas de la API.
```typescript
{
  codeStatus: number
  success: boolean
  message?: string
  data: T | null
  errors: any
  timestamp: string
}
```

### `Request` — Solicitud (nota crédito/débito)
Campos principales:
- `requestNumber`, `requestTypeId`, `status`, `currency`
- `invoiceNumber`, `invoiceDate`, `sapReturnOrder`, `creditNumber`
- `amount`, `hasIva`, `totalAmount`, `exchangeRate`
- `replenishmentAmount`, `replenishmentTotal`, `hasReplenishmentIva`
- `warehouseAmount`, `warehouseTotal`, `hasWarehouseIva`
- `hasRga`, `warehouseCode`, `comments`
- Relaciones: `requestType`, `user`, `customer`, `reason`, `classification`, `workflowCurrentStep`

### `WorkflowCurrentStep`
```typescript
{
  requestId, workflowId, workflowStepId
  assignedRoleId, assignedUserId, status
  workflow_step: WorkflowStep
  assigned_role: Role
  assigned_user: User
}
```

### `ReturnOrderRequestByRequestData`
Orden de devolución vinculada a una solicitud de tipo material return.
```typescript
{
  id, returnOrderId, requestId
  returnChargePercent, globalSubTotal, returnChargeAmount
  returnOrder: {
    id, clientId, status, notes, currency?
    chargeTypeId, customRate?
    chargeType: { id, name, label, percentage }
  }
  items: ReturnOrderRequestItem[]   // artículos con estado de validación
}
```

### `ReturnOrderRequestItem`
```typescript
{
  id, returnOrderRequestId, returnOrderItemId
  partNumber?, sapId?
  qtyToReturn, unitPrice, subTotal?
  invoiceFolio, descripcion, claveUnidad, unidad
  // Validación reabasto
  replenishmentAccepted?, replenishmentReasonForRejection?
  // Validación almacén
  warehouseReceived?, warehouseAccepted?, warehouseReasonForRejection?
}
```

### `PagePagination<T>`
```typescript
{
  data: T[]
  current_page, last_page, per_page, total
  next_page_url?, prev_page_url?
}
```

---

## Features — descripción detallada

### Auth

- **Login:** Formulario email/contraseña. Cookie-based session.
- **Change Password:** Se activa forzosamente cuando `mustChangePassword=true`. Una vez cambiada, redirige al dashboard.

### Dashboard

- Tarjetas de estadísticas: Creadas, Aprobadas, Rechazadas, Procesadas, Pendientes, Liberadas.
- Gráfica de línea configurable (últimos 30/60 días o rango personalizado).
- Filtro por tipo de solicitud.
- Servicio: `DashboardService` → GET `/dashboard`.

### Requests

**Nueva solicitud (`/app/request/new-request`):**
- Selección de tipo de solicitud (crédito, débito, auditor crédito, auditor débito, refacturación, material return).
- Cada tipo tiene su propio formulario de campos.
- Adjuntos: pantalla SAP (`sapScreen`) y documentos de soporte (`uploadSupport`).
- Clasificación y razón se cargan dinámicamente por tipo.
- Si el tipo es **Material Return** y viene con `orderId` en query params, se vincula automáticamente la orden de devolución al crear la solicitud.
- Tipo de cambio: se consulta automáticamente a la API de Banxico (puede fallar por CORS en producción — ver sección de CORS).
- Al seleccionar un cliente, el campo `area` se rellena automáticamente desde `clienteExt.area` si el formulario lo expone.

**`BaseRequestForm` — restricciones de campos por paso de workflow:**

Al editar una solicitud, `BaseRequestForm` aplica automáticamente restricciones de enable/disable sobre los controles del formulario según el paso actual y el rol asignado. Las reglas están centralizadas en:

```
src/app/features/requests/components/shared/request-form-workflow-constraints.ts
```

Ese archivo exporta `WORKFLOW_FIELD_CONSTRAINTS: WorkflowFieldConstraint[]`. Cada entrada define:

```typescript
{
  disableWhen: (ctx: ConstraintContext) => boolean,  // condición
  fields: string[],        // controles en el FormGroup principal
  arrayFields?: string[]   // controles dentro de cada fila del FormArray materialItems
}
```

`ConstraintContext` contiene `step` (`WorkflowStep`) y `assignedRoleName` (string).

**Restricciones actuales:**

| Condición | Campos bloqueados |
|---|---|
| El paso actual **no** es `isFinalStep` | `creditNumber`, `orderNumber` |
| El rol asignado **no** es `WAREHOUSE` | `warehouseAmount`, `hasWarehouseIva`, `warehouseTotal`, y columnas de almacén en cada fila de la tabla |
| El rol asignado **no** es `REPLENISHMENT` | `replenishmentAmount`, `hasReplenishmentIva`, `replenishmentTotal`, y columnas de reabasto en cada fila |

Para agregar una nueva restricción basta con añadir una entrada al array `WORKFLOW_FIELD_CONSTRAINTS`. `BaseRequestForm` la aplicará automáticamente; si el formulario tiene un `FormArray`, la subclase puede sobreescribir `applyConstraintsToArrayFields()`.

**Material Return — tabla de artículos con FormArray reactivo:**

Los campos editables de cada fila (replenishment, warehouse, razones, SAP ID) están vinculados a un `FormArray<FormGroup>` llamado `materialItems`. Esto permite que las restricciones de workflow se apliquen por control y que el formulario sea la fuente de verdad única para el payload de actualización.

**Borradores (`/app/request/drafts`):**
- Lista paginada de borradores del usuario.
- Permite retomar o eliminar borradores.

**Carga masiva (`/app/request/bulk-upload`):**
- Subida de archivos CSV/Excel para creación en lote.
- Subida de adjuntos de soporte.
- Importación de órdenes SAP en lote.
- El progreso se notifica en tiempo real vía socket (`batch.finished`, `batch_needs_attachments`).
- Logs de error por item fallido disponibles en detalle de batch.

### Pending

Lista de solicitudes pendientes filtradas por tipo. Página principal de trabajo del aprobador.

- Filtros: tipo de solicitud, búsqueda por número/cliente, rol, solicitante, rango de fechas.
- Paginación configurable (10/25/50 por página).
- Acciones por solicitud (según permisos): ver info, PDF, historial, eliminar, cancelar.
- **Modal de información (`RequestInfoModal`):** muestra todos los datos de la solicitud incluyendo, si es Material Return, la orden de devolución vinculada con un botón "Ver materiales" que abre un segundo modal con la tabla completa de artículos y su estado de validación (SAP ID, reabasto aceptado, almacén recibido, etc.).
- La moneda mostrada en el modal usa la moneda efectiva: si tiene orden de devolución con `currency`, esa tiene prioridad sobre `req.currency`.

### Approvals — Return Orders (`/app/approvals/return-orders`)

Dos modos:

**Modo búsqueda:**
- Busca órdenes de devolución por razón social o clientId.
- Muestra detalle expandible por orden (artículos, subtotal, estado).
- Acciones disponibles:
  - **Aprobar → Nueva solicitud:** navega a `/app/request/new-request?requestType=material+return&requestTypeId=6&orderId={id}`.
  - **Asignar a solicitud existente:** modal de búsqueda y vinculación.
  - **Rechazar:** marca como cancelada.

**Modo creación (tab "Crear"):**
- Busca cliente por nombre → muestra `<app-clients [clientIdOverride]="...">` del módulo Clients para crear la orden de devolución desde ahí.

### Clients (`/app/clients`)

Módulo principal para gestión de facturas y creación de órdenes de devolución.

**Vista de facturas:**
- Filtra facturas por tipo de cargo (anual/esporádico) y moneda (MXN/USD).
- Cada factura se puede expandir para ver sus productos.
- Historial de devoluciones por producto.

**Generador de orden de devolución:**
- Se seleccionan productos y cantidades de las facturas.
- Calcula subtotal, cargo (%) y total en tiempo real.
- La **moneda seleccionada en el filtro** es la que se envía en el payload al crear la orden.
- Al crear la orden, los precios en el resumen de artículos usan la moneda seleccionada (no MXN fijo).
- Campos de la orden creada: `clientId`, `chargeTypeId`, `currency`, `notes`, `items[]`.

### History (`/app/history`)

Timeline visual del flujo de aprobación de una solicitud:
- Pasos ordenados con estado (pendiente, actual, completado).
- Quién actuó en cada paso, cuándo, y con qué comentario.
- Porcentaje de progreso.

### Notifications (`/app/notifications`)

- Lista completa de notificaciones del usuario.
- Marca como leída individual o masivamente.
- En tiempo real: `ReverbSocketService` emite `notificationCreated$` y actualiza `NotificationService` automáticamente.
- La campana en la navbar muestra el contador de no leídas.

### Settings

| Sub-módulo | Ruta | Propósito |
|---|---|---|
| Usuarios | `/settings/users` | CRUD de usuarios, asignar roles, reset de contraseña |
| Clientes | `/settings/customers` | CRUD de clientes, datos extra (área, gerentes) |
| Roles | `/settings/roles` | CRUD de roles, mapeo de rol equivalente |
| Permisos | `/settings/roles/manage-permissions` | Asignar permisos por tipo de solicitud a roles |
| Workflows | `/settings/workflows` | Definir pasos de aprobación por tipo/clasificación. Cada paso puede marcarse como `isFinalStep`, lo que habilita los campos `creditNumber` y `orderNumber` en el formulario de la solicitud cuando ese paso está activo |
| Config Sistema | `/settings/system-configuration` | Parámetros globales |
| Seguridad | `/settings/security-management` | Bloqueo/desbloqueo de IPs |
| Asignar usuarios | `/settings/assign-user` | Asignación masiva de usuarios a workflows |

---

## Componentes compartidos

Todos están en `src/app/shared/components/ui/`.

| Componente | Selector | Inputs clave | Outputs |
|---|---|---|---|
| `Modal` | `app-modal` | `open`, `size` (sm/md/lg/xl/2xl/full), `titleM`, `showPrimaryButton`, `closeText` | `openChange`, `primaryAction`, `closed` |
| `Badge` | `app-badge` | `color`, `text` | — |
| `Table` | `app-table` | `columns`, `data`, `loading` | `rowClick`, `sort` |
| `Spinner` | `app-spinner` | — | — |
| `Skeleton` | `app-skeleton` | `lines`, `width` | — |
| `Select` | `app-select` | `options`, `formControl` | `valueChange` |
| `Autocomplete` | `app-autocomplete` | `options`, `formControl`, `displayFn` | `selected` |
| `Switch` | `app-switch` | `formControl`, `label` | — |
| `Tab Container` | `app-tab-container` | `tabs`, `activeTab` | `tabChange` |
| `Popover` | `app-popover` | `content`, `position` | — |
| `Accordion` | `app-accordion` | `items` | — |

**Layouts:**
- `Sidebar` — menú lateral dinámico basado en permisos de rol.
- `Navbar` — barra superior con selector de idioma, notificaciones, menú de usuario.
- `ImpersonationBanner` — barra visible solo cuando SUPERADMIN está impersonando.

---

## Estado reactivo (Signals)

El proyecto usa el sistema de **Signals de Angular** (sin NgRx ni Akita).

```typescript
// Signal básico
readonly requests = signal<Request[]>([]);

// Computed (derivado)
readonly totalPages = computed(() => Math.ceil(this.total() / this.pageSize()));

// Signal de solo lectura expuesto
readonly isLoading = this._isLoading.asReadonly();

// Actualización
this.requests.set(newData);
this.requests.update(curr => [...curr, newItem]);

// Effect (side-effect reactivo)
effect(() => {
  const req = this.request();
  const isOpen = this.open();
  if (!isOpen || !req?.id) { /* reset */ return; }
  this.loadData(req.id);
});
```

**Servicios que usan signals como estado:**
- `NotificationService`: `notifications`, `unreadNotifications`, `unreadCount`, `lastError`
- `ImpersonationService`: `impersonatedUserId`
- `ReverbSocketService`: `connectionState`, `messages`, `lastMessage`, `connectionError`

**Patrón de datos HTTP en componentes:**
```typescript
// Signal de carga
readonly isLoading = signal(false);

// Carga con finalize
this.service.getData().pipe(
  finalize(() => this.isLoading.set(false))
).subscribe({
  next: (data) => this.data.set(data),
  error: () => this.data.set([])
});
```

---

## Tiempo real — WebSockets

Usa **Laravel Reverb** (servidor de WebSockets) con el cliente `laravel-echo` + `pusher-js`.

**Configuración:** `runtimeConfig.socketHost`, `socketPort`, `socketProtocol`

**Canales activos:**
- `notifications.global` — notificaciones para todos los usuarios autenticados

**Eventos escuchados:**

| Evento | Signal/Observable | Descripción |
|---|---|---|
| `socket.message.sent` | `messages$` | Mensajes generales (progreso de batch) |
| `.socket.message.sent` | `messages$` | Alias legado del mismo evento |
| `notification.created` | `notificationCreated$` | Nueva notificación entrante |
| `batch.finished` | `batchFinished$` | Batch de procesamiento completado |
| `batch_needs_attachments` | `batchFinished$` | Batch requiere adjuntos |

**Estados de conexión:** `'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error'`

---

## Internacionalización

- **Idiomas:** Español (`es`) e Inglés (`en`)
- **Archivos:** `public/assets/i18n/es.json` y `public/assets/i18n/en.json`
- **Loader:** `CustomTranslateLoader` configurado en `app.config.ts`
- **Pipe en plantilla:** `{{ 'CLAVE.SUBCLAVE' | translate }}`
- **En TypeScript:** `this.translateService.instant('CLAVE')`

**Estructura de claves (ejemplos):**
```json
{
  "REQUEST_INFO": { "TITLE": "...", "STATUS": "..." },
  "DASHBOARD": { "STATS": { "CREATED": "..." } },
  "PENDING_ATTACHMENTS": { "TITLE": "..." },
  "CLIENT_INVOICES": { "ORDER": { "QUANTITY": "..." } }
}
```

Al agregar texto nuevo, siempre agregar la clave en **ambos archivos** (`es.json` y `en.json`).

---

## Flujo de negocio

### Tipos de solicitud

| ID | Tipo | Descripción |
|---|---|---|
| 1 | Nota de Crédito | Crédito estándar |
| 2 | Nota de Débito | Débito estándar |
| 3 | Crédito Auditor | Crédito con revisión de auditor |
| 4 | Débito Auditor | Débito con revisión de auditor |
| 5 | Refacturación | Re-emisión de factura |
| 6 | Material Return | Devolución de material |

### Ciclo de una solicitud

```
Usuario crea solicitud
    ↓
Estado: PENDING (paso 1 del workflow)
    ↓
Aprobador del rol asignado actúa:
  → APPROVE: avanza al siguiente paso
  → REJECT: termina el flujo (rechazada)
  → SEND-BACK: regresa a paso anterior
  → CANCEL: cancela
    ↓
Si pasa todos los pasos → Estado: APPROVED/RELEASED
```

### Flujo de orden de devolución (Material Return)

```
1. Cliente o ejecutivo selecciona facturas → genera orden de devolución
   POST /return-orders { clientId, chargeTypeId, currency, items[] }

2. La orden queda en estado PENDING

3. Aprobador busca la orden en /approvals/return-orders
   → Opción A: Aprobar como NUEVA solicitud
     navega a /request/new-request?requestType=material+return&orderId={id}
   → Opción B: Asignar a solicitud EXISTENTE
     POST /return-order-requests { returnOrderId, requestId }
   → Rechazar: marca orden como cancelled

4. La solicitud vinculada pasa por su workflow normal

5. En el modal de info de la solicitud se puede ver:
   - Datos de la orden (número, estado, cargo %)
   - Botón "Ver materiales" → tabla con estado de validación:
     * SAP ID asignado
     * Cantidad aceptada para reabasto
     * Cantidad recibida/aceptada en almacén
     * Razones de rechazo
```

### Carga masiva (Batch)

```
1. Usuario sube archivo CSV/Excel
   POST /batches { file, batchType, requestTypeId }

2. Backend procesa de forma asíncrona

3. Socket emite batch.finished o batch_needs_attachments

4. Frontend actualiza UI y muestra log de errores si los hay
```

---

## Permisos y roles

### Niveles de permiso

**1. Permisos de módulo** — controlan qué aparece en el sidebar (menú lateral).

**2. Permisos de tipo de solicitud** — controlan qué acciones puede hacer el rol sobre cada tipo de solicitud.

Acciones disponibles por tipo: `approve`, `decline`, `pdf`, `edit`, `history`, `delete`, `cancel`, `return_order`

### Roles especiales

| Rol | Comportamiento especial |
|---|---|
| **SUPERADMIN** | Acceso total. Puede impersonar otros usuarios. Redirige a `/app/my-profile` por defecto |
| **CUSTOMER** | Solo ve sus propias facturas (`/app/clients/my-invoices`). Filtrado por `clientId` |

### `action-permission-map.ts`

Define qué slugs de permiso corresponden a cada acción de UI:

```typescript
{
  approve: ['approve'],
  decline: ['decline', 'reject'],
  pdf: ['pdf', 'export_pdf'],
  edit: ['edit', 'update'],
  history: ['history', 'view_history'],
  delete: ['delete'],
  cancel: ['cancel'],
  return_order: ['return_order']
}
```

### Verificación en guards y componentes

```typescript
// En guard (ActionGuard)
this.sidebarService.hasAction(route.data['requiredAction'])

// En componente
readonly canDelete = input(false);  // pasado desde padre según permisos
```

---

## Cómo agregar un módulo nuevo

1. **Crear carpeta** en `src/app/features/mi-modulo/`

2. **Crear componente** standalone:
```typescript
@Component({
  selector: 'app-mi-modulo',
  standalone: true,
  imports: [CommonModule, TranslatePipe, ...],
  templateUrl: './mi-modulo.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MiModulo { }
```

3. **Agregar ruta** en `app.routes.ts`:
```typescript
{
  path: 'mi-modulo',
  loadComponent: () => import('./features/mi-modulo/mi-modulo').then(m => m.MiModulo)
}
```

4. **Agregar claves i18n** en ambos archivos (`es.json` y `en.json`).

5. **Agregar entrada al sidebar** desde el backend (módulo + permiso).

6. **Si necesita guard de acción**, definir `route.data['requiredAction']` y agregar el slug en `action-permission-map.ts`.

**Convenciones:**
- Un archivo `.ts` y un `.html` por componente (sin `.scss` — se usa Tailwind).
- Nombres en kebab-case para archivos, PascalCase para clases.
- Signals para estado local, servicios de `core/services/` para datos remotos.
- No usar NgModules ni `declarations`.
- Todo texto visible debe tener clave i18n.

---

## Build y calidad

```bash
# Producción
npm run build
# Output en /dist/notasCreditos-front/browser/

# Pruebas unitarias (Vitest)
npm run test

# Build en modo watch (desarrollo)
npm run watch
```

**Presupuestos de bundle** configurados en `angular.json` (advertencia si supera el umbral).

**Prettier:** Configuración incluida en `package.json`. Ejecutar antes de commits:
```bash
npx prettier --write "src/**/*.{ts,html}"
```

---

## Recursos

- [Angular Docs](https://angular.dev)
- [Angular CLI](https://angular.dev/tools/cli)
- [ngx-translate](https://github.com/ngx-translate/core)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [Laravel Echo](https://laravel.com/docs/broadcasting)
- [Lucide Icons](https://lucide.dev)
