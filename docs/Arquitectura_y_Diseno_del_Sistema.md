# Documento de Arquitectura y Diseño del Sistema

## Sistema de Gestión de Distribuidora - Pw3c

---

## 1. Descripción General

Sistema web para la gestión integral de una distribuidora farmacéutica. Permite administrar pedidos, despachos, rutas de entrega, repartidores, vehículos, farmacias clientes, y realizar seguimiento GPS en tiempo real. El frontend es una aplicación web estática de página múltiple (MPA) que consume una API REST desarrollada en Laravel PHP.

---

## 2. Stack Tecnológico

| Tecnología | Versión | Propósito |
|---|---|---|
| HTML5 | - | Estructura de páginas |
| CSS3 (Variables CSS) | - | Estilos y temas |
| JavaScript (ES6+) | - | Lógica de aplicación |
| jQuery | 3.7.1 | Manipulación del DOM |
| DataTables | 1.13.6 | Tablas interactivas |
| Chart.js | 4.4.1 | Gráficos estadísticos |
| SweetAlert2 | - | Modales y notificaciones |
| Font Awesome | 6.5.1 | Iconos |
| SortableJS | 1.15.0 | Drag & drop |
| Leaflet | 1.9.4 | Mapas de farmacias |
| Mapbox GL JS | v3.2.0 | Tracking GPS |
| Firebase RTDB | - | Datos en tiempo real (GPS) |
| PHP Laravel | - | Backend API REST |
| VS Code Live Server | - | Servidor de desarrollo |

---

## 3. Arquitectura del Sistema

### 3.1. Estructura General

```
index.html (Login/Register)
    │
    └── dashboard.html (Panel principal autenticado)
            │
            ├── pages/farmacias.html
            ├── pages/productos.html
            ├── pages/pedidos.html
            ├── pages/repartidores.html
            ├── pages/vehiculos.html
            ├── pages/rutas.html
            ├── pages/controles-ruta.html
            ├── pages/despachos.html
            ├── pages/logistica.html
            ├── pages/caja.html
            ├── pages/usuarios.html
            ├── pages/roles.html
            ├── pages/catalogos.html
            ├── pages/reportes.html
            ├── pages/gps.html
            └── pages/documentos.html
```

### 3.2. Capas del Frontend

```
┌─────────────────────────────────────────┐
│          Páginas HTML (Vistas)           │
│   Cada módulo tiene su propia página     │
├─────────────────────────────────────────┤
│     Módulos JS (Lógica de negocio)       │
│   js/modules/{modulo}.js                 │
├─────────────────────────────────────────┤
│   Capa Compartida (Core Libraries)       │
│   config.js  |  auth.js  |  layout.js   │
├─────────────────────────────────────────┤
│     API REST (Laravel PHP Backend)       │
│   http://127.0.0.1:8000/api             │
└─────────────────────────────────────────┘
```

### 3.3. Flujo de una Petición Típica

```
Usuario → (click en página) → Carga HTML
    → DOMContentLoaded → checkAuth()
    → hasPermission(module, 'acceder')
    → renderPage() → apiFetch(endpoint)
    → Backend Laravel → JSON Response
    → DataTable/UI update
```

### 3.4. Patrón por Módulo

Cada módulo sigue una estructura consistente:

1. **Variables de estado**: Referencia a DataTable, ID en edición, listas cacheadas
2. **DOMContentLoaded**: `checkAuth()`, verificar permiso, cargar catálogos, `renderPage()`
3. **renderPage()**: Inyectar HTML template con modales, llamar `loadTable()`
4. **loadTable()**: Fetch via `apiFetch()`, inicializar DataTable con columnas y botones de acción
5. **CRUD**: `openCreateModal()`, `edit(id)`, `save()`, `del(id)` usando apiFetch()
6. **Manejo de eliminación**: En caso de error 409 (registro con historial), ofrece alternativa (bloquear usuario, desactivar, etc.)

---

## 4. Capa Compartida (Core)

### 4.1. `js/config.js` - Configuración Central

| Función/Variable | Descripción |
|---|---|
| `API_URL` | `http://127.0.0.1:8000/api` |
| `apiFetch(endpoint, options)` | Cliente HTTP centralizado con token Bearer, manejo de errores 401, errores de red |
| `getStatusBadge(status)` | Genera HTML de badge con color según estado |
| `formatDate(dateStr)` | Formatea fechas con locale `es-BO` |
| `reloadDataTable(table, endpoint)` | Recarga una DataTable desde API |
| `showLoading(container)` | Muestra spinner de carga |
| `openModal(id)` / `closeModal(id)` | Gestión de modales |
| `hasPermission(modulo, accion)` | Verifica permiso del usuario |

### 4.2. `js/auth.js` - Autenticación

| Función | Descripción |
|---|---|
| `login(email, password)` | Login vía POST /api/auth/login |
| `register(data)` | Registro vía POST /api/auth/register |
| `logout()` | Logout + limpieza de localStorage |
| `checkAuth()` | Guard: redirige a login si no hay token |
| `getUser()` | Retorna objeto usuario desde localStorage |
| `loadUserPermissions()` | Refresca permisos desde API |

### 4.3. `js/layout.js` - Layout y Sidebar

- `loadSidebar()`: Renderiza el sidebar con menú de navegación filtrado por permisos del usuario
- `setupSidebarToggle()`: Menú hamburguesa para dispositivos móviles

---

## 5. Autenticación y Autorización (RBAC)

### 5.1. Flujo de Autenticación

```
Login → POST /api/auth/login
    → Respuesta: { token, user, permisos }
    → localStorage: token, user, permisos
    → Redirección a dashboard.html

checkAuth() en cada página:
    → Verifica localStorage.token existe y es válido
    → Si no: redirige a index.html
```

### 5.2. Sistema de Roles y Permisos

- **RBAC (Role-Based Access Control)**
- Cada usuario tiene uno o más roles
- Cada rol tiene permisos por módulo y acción (acceder, crear, editar, eliminar, cambiar-estado)
- El sidebar oculta módulos sin permiso `acceder`
- Los botones de acción se renderizan condicionalmente según permisos

### 5.3. Manejo de Tokens

- Token JWT almacenado en `localStorage`
- Enviado como `Authorization: Bearer <token>` en cada petición
- En 401: auto-logout y redirección a login

---

## 6. Descripción de Módulos

### 6.1. Dashboard (`dashboard.html`, `dashboard.js`)

**Propósito**: Panel principal con resumen del sistema.

**Funcionalidad**:
- Tarjetas de resumen (Pedidos, Despachos, Farmacias, Repartidores, Vehículos, Incidencias)
- Gráfico de donut: Pedidos por Estado (Chart.js)
- Gráfico de barras: Despachos por Estado (Chart.js)
- Banner de bienvenida con enlaces a manuales PDF

**Endpoints**: `/reportes/resumen`, `/reportes/pedidos-por-estado`, `/reportes/despachos-por-estado`

---

### 6.2. Usuarios (`pages/usuarios.html`, `usuarios.js`)

**Propósito**: Gestión de usuarios del sistema.

**Funcionalidad**:
- CRUD completo de usuarios
- Campos: nombre, apellido, email (autogenerado), teléfono, contraseña, estado
- Asignación de roles (modal con checkboxes multiselección)
- Soft-delete: si el usuario tiene historial, ofrece "Bloquear" en lugar de eliminar

**Endpoints**: `/usuarios`, `/usuarios/{id}/roles`, `/usuarios/{id}/bloquear`

---

### 6.3. Roles (`pages/roles.html`, `roles.js`)

**Propósito**: Gestión de roles y permisos del sistema.

**Funcionalidad**:
- CRUD de roles (nombre)
- Asignación de permisos: modal agrupado por módulo con checkboxes por acción
- Protección contra eliminación de roles asignados

**Endpoints**: `/roles`, `/roles/{id}/permisos`

---

### 6.4. Catálogos (`pages/catalogos.html`, `catalogos.js`)

**Propósito**: Mantenimiento de tablas catálogo del sistema.

**Funcionalidad**:
- 18 tipos de catálogos dinámicos organizados en categorías:
  - **Sistema**: estados-usuario, roles, módulos, acciones, tablas-sistema
  - **Pedidos**: estados-pedido
  - **Logística**: estados-repartidor, estados-vehículo, estados-despacho
  - **Vehículos**: marcas, modelos, capacidades
  - **Incidencias**: tipos-incidencia, tipos-evidencia
  - **Personal**: extensiones-ci, licencias, cargos
- Generación inteligente de formularios según el tipo de catálogo
- Tabla unificada `catalogos` en backend con clave compuesta

**Endpoints**: `/catalogos/{key}`

---

### 6.5. Farmacias (`pages/farmacias.html`, `farmacias.js`)

**Propósito**: Gestión de farmacias clientes.

**Funcionalidad**:
- CRUD de farmacias con nombre, dirección, coordenadas (lat/lng), estado
- Split layout: tabla de farmacias (izquierda) + mapa Leaflet (derecha)
- Marcadores en mapa para cada farmacia
- Interacción mapa-tabla: click en fila → resalta marcador; click en marcador → centra mapa
- Geocodificación inversa (Nominatim) al hacer clic en el mapa
- Gestión de contactos anidados por farmacia (nombre, cargo, teléfono, email)

**Endpoints**: `/farmacias`, `/farmacias/{id}/contactos`

---

### 6.6. Productos (`pages/productos.html`, `productos.js`)

**Propósito**: Catálogo de productos.

**Funcionalidad**:
- CRUD de productos
- Campos: nombre, precio unitario, unidad de medida (dropdown), estado
- Validación de campos obligatorios

**Endpoints**: `/productos`

---

### 6.7. Pedidos (`pages/pedidos.html`, `pedidos.js`)

**Propósito**: Gestión de pedidos de farmacias.

**Funcionalidad**:
- CRUD de pedidos
- Detalle de pedido multínea: selección de productos con cantidad y precio
- Edición en línea de cantidades y precios en tabla de detalle
- Auto-cálculo de subtotales
- Modal de visualización de detalle
- Cambio de estado del pedido

**Endpoints**: `/pedidos`, `/pedidos/{id}/detalles`, `/pedidos/{id}/cambiar-estado`

---

### 6.8. Repartidores (`pages/repartidores.html`, `repartidores.js`)

**Propósito**: Gestión de repartidores.

**Funcionalidad**:
- CRUD de repartidores
- Vinculación con usuarios del sistema (dropdown)
- Campos: CI + extensión, licencia, estado
- Sincronización Firebase: muestra estado de conexión en tiempo real (verde/rojo)
- Cambio de estado

**Endpoints**: `/repartidores`, `/repartidores/{id}/cambiar-estado`

---

### 6.9. Vehículos (`pages/vehiculos.html`, `vehiculos.js`)

**Propósito**: Gestión de vehículos de reparto.

**Funcionalidad**:
- CRUD de vehículos
- Vinculación con catálogos: marcas, modelos, capacidades
- Campos: placa, modelo (con marca), capacidad (kg), estado
- Cambio de estado

**Endpoints**: `/vehiculos`, `/vehiculos/{id}/cambiar-estado`

---

### 6.10. Rutas (`pages/rutas.html`, `rutas.js`)

**Propósito**: Definición de rutas de entrega.

**Funcionalidad**:
- CRUD de rutas (nombre)
- Gestión de paradas anidadas: cada parada tiene farmacia, número de pedido, hora estimada
- Paradas reordenables mediante columna numérica en DataTable

**Endpoints**: `/rutas`, `/rutas/{id}/paradas`

---

### 6.11. Control de Rutas (`pages/controles-ruta.html`, `controles-ruta.js`)

**Propósito**: Registro y control de ejecución de rutas.

**Funcionalidad**:
- CRUD de controles de ruta
- Vincula ruta, repartidor, vehículo, fecha, hora de salida
- Acción "Registrar Llegada" con selector de hora

**Endpoints**: `/controles-ruta`, `/controles-ruta/{id}/registrar-llegada`

---

### 6.12. Despachos (`pages/despachos.html`, `despachos.js`)

**Propósito**: Gestión de despachos a farmacias.

**Funcionalidad**:
- CRUD de despachos
- Vincula pedido, parada (de ruta), control de ruta
- Gestión de incidencias anidadas (tipo + descripción)
- Gestión de evidencias anidadas (tipo + archivo, subida multipart/form-data)
- Cambio de estado del despacho

**Endpoints**: `/despachos`, `/despachos/{id}/cambiar-estado`, `/despachos/{id}/incidencias`, `/despachos/{id}/evidencias`

---

### 6.13. Logística (`pages/logistica.html`, `logistica.js`)

**Propósito**: Centro de operaciones logísticas con 3 pestañas.

#### Pestaña 1: Planificador
- Layout de 4 columnas: Pedidos Pendientes | Bandeja | Mapa | Repartidores
- Drag & drop (SortableJS): pedidos → bandeja → repartidor
- Mapa en tiempo real: línea de ruta y marcadores numerados
- Botón "Iniciar Ruta": confirma planificación vía API

#### Pestaña 2: Rutas Activas (Tracking)
- Lista de rutas activas con barras de progreso
- Mapa Mapbox GL con marcadores de paradas codificados por color
- Seguimiento GPS en tiempo real: icono de camión se mueve en el mapa
- Datos en tiempo real vía Firebase Realtime Database

#### Pestaña 3: Administración
- Tarjetas de acceso rápido a: Repartidores, Vehículos, Rutas, Despachos, Control de Rutas, Reportes

**Endpoints**: `/logistica/pedidos-pendientes`, `/logistica/repartidores-disponibles`, `/logistica/rutas-activas`, `/logistica/planificacion/confirmar`

**Dependencias externas**: Firebase RTDB, Mapbox GL JS, SortableJS

---

### 6.14. GPS (`pages/gps.html`, `gps.js`)

**Propósito**: Monitoreo GPS en tiempo real de todos los repartidores.

**Funcionalidad**:
- Mapa Mapbox GL a pantalla completa
- Panel superpuesto con lista de usuarios conectados
- Firebase real-time: posiciones de todos los dispositivos conectados
- Búsqueda y filtro de usuarios, click para enfocar en mapa
- **Geocercas**: dibujar polígonos en mapa (Mapbox Draw), guardar en Firebase, cargar/editar/eliminar
- Marcadores con estilo personalizado (online/offline)
- Sistema de notificaciones toast

**Dependencias externas**: Firebase RTDB, Mapbox GL JS, Mapbox Draw

---

### 6.15. Caja Diaria (`pages/caja.html`, `caja.js`)

**Propósito**: Gestión de caja diaria por repartidor.

**Funcionalidad**:
- Tarjetas de resumen: Ingresos Totales, Gastos Totales, Saldo Final, Total Repartidores
- Vista detallada por repartidor: monto inicial, ingresos, gastos, saldo final
- Registro de gastos por caja
- Acción "Cerrar Caja"

**Endpoints**: `/caja/resumen`, `/caja/dia`, `/caja/gasto`, `/caja/cerrar/{id}`

---

### 6.16. Reportes (`pages/reportes.html`, `reportes.js`)

**Propósito**: Reportes estadísticos del sistema.

**Funcionalidad**:
- 6 tipos de reporte: Pedidos/Despachos/Repartidores/Vehículos por Estado, Pedidos por Día, Incidencias por Tipo
- Renderizado dinámico de tabla con datos de API

**Endpoints**: `/reportes/{tipo}`

---

### 6.17. Documentos (`pages/documentos.html`, `documentos.js`)

**Propósito**: Visualización y descarga de documentación.

**Funcionalidad**:
- Cuadrícula estática con Manual de Usuario y Manual Técnico en PDF
- Botones "Ver" (abre en nueva pestaña) y "Descargar"

---

## 7. Integración con Firebase Realtime Database

### 7.1. Estructura en Firebase

```
/
├── repartidores/
│   └── {uid_repartidor}/
│       ├── lat: number
│       ├── lng: number
│       ├── nombre: string
│       ├── estado: string
│       ├── placa: string
│       └── lastUpdated: timestamp
├── geocercas/
│   └── {id_geocerca}/
│       ├── nombre: string
│       ├── uid_repartidor: string
│       ├── polygon: GeoJSON
│       └── created_at: timestamp
└── usuarios/
    └── {uid}/
        └── connected: boolean
```

### 7.2. Flujo de Datos GPS

```
Dispositivo Móvil (Repartidor)
    ↓ (escribe lat/lng en Firebase RTDB)
Firebase Realtime Database
    ↓ (on() listener en tiempo real)
Frontend Web (tracking.js, gps.js)
    ↓ (actualiza marcador en mapa)
Mapbox GL Map
```

---

## 8. Manejo de Errores

### 8.1. `error-handler.js`

- Instala handlers globales `window.onerror` y `window.onunhandledrejection`
- Captura errores no controlados
- Muestra mensajes amigables al usuario
- Loggea errores a consola

### 8.2. Manejo en apiFetch()

| Código | Acción |
|---|---|
| 200-299 | Éxito: retorna JSON |
| 401 | Auto-logout + redirección a login |
| 409 | Conflicto (restricción de integridad): muestra mensaje y ofrece alternativa |
| 422 | Validación: muestra errores de formulario |
| 500 | Error interno: muestra mensaje genérico |
| Red | Error de red: muestra mensaje "Error de conexión" |

---

## 9. Seguridad

- **Autenticación**: JWT Bearer Token
- **Autorización**: RBAC por módulo y acción
- **Almacenamiento seguro**: Solo token y datos no sensibles en localStorage
- **Protección de rutas**: checkAuth() en cada página
- **Manejo de sesión**: Timeout de token, auto-logout en 401
- **Subida de archivos**: Evidencias en despachos vía FormData multipart

---

## 10. Convenciones de Código

- **Nomenclatura**: camelCase para variables y funciones, PascalCase para constructores
- **Módulos**: Un archivo por módulo, mismo nombre que la página HTML
- **API**: Nombres de endpoints en plural, RESTful
- **Permisos**: Clave compuesta `{modulo}_{accion}` (ej: `usuarios_crear`)
- **Estados**: Constantes en español (activo, inactivo, pendiente, en_ruta, completado, cancelado)
- **Comentarios**: No se utilizan comentarios en el código

---

## 11. Estructura de Archivos

```
frontenda_distribuidora/
├── index.html                    # Login/Register
├── dashboard.html                # Panel principal
├── css/
│   ├── login.css                 # Estilos de login
│   ├── style.css                 # Estilos globales
│   └── logistica.css             # Estilos del módulo logística
├── js/
│   ├── auth.js                   # Autenticación
│   ├── config.js                 # Configuración y utilidades
│   ├── error-handler.js          # Manejo global de errores
│   ├── layout.js                 # Sidebar y layout
│   └── modules/                  # Módulos del sistema
│       ├── dashboard.js          # Panel principal
│       ├── usuarios.js           # Gestión de usuarios
│       ├── roles.js              # Roles y permisos
│       ├── catalogos.js          # Catálogos dinámicos
│       ├── farmacias.js          # Farmacias
│       ├── productos.js          # Productos
│       ├── pedidos.js            # Pedidos
│       ├── repartidores.js       # Repartidores
│       ├── vehiculos.js          # Vehículos
│       ├── rutas.js              # Rutas
│       ├── controles-ruta.js     # Control de rutas
│       ├── despachos.js          # Despachos
│       ├── logistica.js          # Logística
│       ├── planificador.js       # Planificador de rutas
│       ├── tracking.js           # Tracking GPS
│       ├── caja.js               # Caja diaria
│       ├── reportes.js           # Reportes
│       ├── gps.js                # Monitoreo GPS
│       └── documentos.js         # Documentos
├── pages/                        # Páginas HTML
│   ├── farmacias.html
│   ├── productos.html
│   ├── pedidos.html
│   ├── repartidores.html
│   ├── vehiculos.html
│   ├── rutas.html
│   ├── controles-ruta.html
│   ├── despachos.html
│   ├── logistica.html
│   ├── caja.html
│   ├── usuarios.html
│   ├── roles.html
│   ├── catalogos.html
│   ├── reportes.html
│   ├── gps.html
│   └── documentos.html
├── docs/
│   ├── Manual_de_Usuario_Pw3c.pdf
│   ├── Manual_Tecnico_Pw3c.pdf
│   └── Arquitectura_y_Diseno_del_Sistema.md
└── .vscode/
    └── settings.json
```
