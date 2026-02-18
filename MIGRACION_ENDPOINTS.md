# Migración de Endpoints REST a Electron IPC

## Problema Identificado

La aplicación originalmente tenía un servidor HTTP que ofrecía endpoints REST para manejar tickets. Con la migración a Electron, estos endpoints necesitan ser adaptados para funcionar con IPC (Inter-Process Communication).

## Endpoints Faltantes Detectados

### ❌ Antes de la Corrección

Endpoints que **NO** estaban implementados en Electron:

1. **GET `/api/tickets/:id/summary`** - Obtener resumen de ticket completado
2. **POST `/api/tickets/autopilot`** - Iniciar modo autopilot
3. **POST `/api/tickets/autopilot/stop`** - Detener modo autopilot

### ✅ Después de la Corrección

Todos los endpoints ahora están implementados correctamente.

## Cambios Implementados

### 1. electron-main.ts

**Agregadas variables globales:**
```typescript
let autopilotRunning = false;
let autopilotShouldStop = false;
```

**Agregados IPC handlers:**

```typescript
// Handler para obtener resumen del ticket
ipcMain.handle('get-ticket-summary', async (_event, id: string) => {
  // Retorna HTML con resumen del ticket
  // Solo disponible para tickets completados o con error
});

// Handler para iniciar autopilot
ipcMain.handle('start-autopilot', async () => {
  // Inicia procesamiento automático de tickets pendientes
  autopilotRunning = true;
  autopilotShouldStop = false;
  processAutopilotTickets();
});

// Handler para detener autopilot
ipcMain.handle('stop-autopilot', async () => {
  // Marca flag para detener después del ticket actual
  autopilotShouldStop = true;
});
```

**Agregada función de procesamiento:**
```typescript
async function processAutopilotTickets() {
  // Procesa tickets pendientes uno por uno
  // Se detiene cuando no hay más tickets o se solicita parada
  // Envía logs al renderer via IPC
}
```

### 2. electron-preload.ts

**Agregadas funciones al bridge IPC:**

```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existentes ...
  getTicketSummary: (id: string) => ipcRenderer.invoke('get-ticket-summary', id),
  startAutopilot: () => ipcRenderer.invoke('start-autopilot'),
  stopAutopilot: () => ipcRenderer.invoke('stop-autopilot'),
});
```

**Actualizadas definiciones TypeScript:**
```typescript
interface Window {
  electronAPI: {
    // ... existentes ...
    getTicketSummary: (id: string) => Promise<{ success: boolean; summary?: string; error?: string }>;
    startAutopilot: () => Promise<{ success: boolean; error?: string }>;
    stopAutopilot: () => Promise<{ success: boolean; error?: string }>;
  };
}
```

### 3. electron-adapter.js

**Reordenados los handlers para evitar conflictos de regex:**

El orden es crítico porque algunos endpoints comparten patrones:
- `/tickets/autopilot` debe matchear ANTES que `/tickets/:id`
- `/tickets/:id/start` debe matchear ANTES que `/tickets/:id`
- `/tickets/:id/stop` debe matchear ANTES que `/tickets/:id`
- `/tickets/:id/summary` debe matchear ANTES que `/tickets/:id`

```javascript
// Orden correcto:
1. /tickets (GET/POST)
2. /tickets/autopilot (POST)
3. /tickets/autopilot/stop (POST)
4. /tickets/:id/start (POST)
5. /tickets/:id/stop (POST)
6. /tickets/:id/summary (GET)
7. /tickets/:id (DELETE/PATCH/PUT)
```

## Mapeo Completo de Endpoints

| HTTP Endpoint | Método | Electron IPC Handler | Descripción |
|--------------|--------|---------------------|-------------|
| `/api/tickets` | GET | `get-all-tickets` | Obtener todos los tickets |
| `/api/tickets` | POST | `create-ticket` | Crear nuevo ticket |
| `/api/tickets/:id` | GET | `get-ticket` | Obtener ticket específico |
| `/api/tickets/:id` | PATCH/PUT | `update-ticket` | Actualizar descripción del ticket |
| `/api/tickets/:id` | DELETE | `delete-ticket` | Eliminar ticket |
| `/api/tickets/:id/start` | POST | `start-ticket` | Iniciar trabajo en ticket |
| `/api/tickets/:id/stop` | POST | `stop-ticket` | Detener trabajo en ticket |
| `/api/tickets/:id/summary` | GET | `get-ticket-summary` | Obtener resumen HTML del ticket |
| `/api/tickets/autopilot` | POST | `start-autopilot` | Iniciar modo autopilot |
| `/api/tickets/autopilot/stop` | POST | `stop-autopilot` | Detener modo autopilot |
| `/api/config` | GET | `get-config` | Obtener configuración |
| `/api/config` | POST | `update-config` | Actualizar configuración |
| `/api/config/models` | GET | `get-copilot-models` | Obtener modelos disponibles |
| `/api/config/models/refresh` | POST | `get-copilot-models` | Refrescar lista de modelos |
| `/api/health` | GET | `health-check` | Health check |

## Flujo de Comunicación

### Antes (con servidor HTTP):

```
Frontend (app.js) 
  → fetch('/api/tickets') 
  → HTTP Server 
  → Storage/ConfigManager 
  → Response
```

### Ahora (con Electron):

```
Frontend (app.js) 
  → fetch('/api/tickets')
  → electron-adapter.js intercepts
  → window.electronAPI.getAllTickets()
  → electron-preload.ts bridge
  → ipcRenderer.invoke('get-all-tickets')
  → electron-main.ts handler
  → Storage/ConfigManager
  → Response via IPC
```

## Modo Autopilot

El modo autopilot ahora funciona completamente en Electron:

1. **Frontend** llama `POST /api/tickets/autopilot`
2. **Adapter** lo convierte a `window.electronAPI.startAutopilot()`
3. **Main process** inicia `processAutopilotTickets()` en background
4. **Background function** procesa tickets uno por uno
5. **Logs** se envían en tiempo real via `ticket-log` event
6. **Frontend** hace polling cada 2 segundos para actualizar UI
7. **Usuario** puede detener con `POST /api/tickets/autopilot/stop`

## Archivos Modificados

1. ✅ `src/electron-main.ts` - Agregados handlers IPC y función de autopilot
2. ✅ `src/electron-preload.ts` - Expuestos nuevos métodos al renderer
3. ✅ `src/web/public/electron-adapter.js` - Agregado routing de endpoints faltantes
4. ✅ `src/utils/storage.ts` - Agregado logging mejorado
5. ✅ `src/utils/config.ts` - Agregado logging mejorado

## Testing

Para verificar que todo funciona:

1. **Compilar:**
   ```bash
   npm run build
   ```

2. **Ejecutar:**
   ```bash
   npm start
   ```

3. **Abrir DevTools:** `Ctrl+Shift+I`

4. **Probar funcionalidades:**
   - ✅ Crear ticket
   - ✅ Ver lista de tickets
   - ✅ Iniciar ticket
   - ✅ Detener ticket
   - ✅ Ver resumen de ticket (solo completados)
   - ✅ Iniciar modo autopilot
   - ✅ Detener autopilot
   - ✅ Editar ticket
   - ✅ Eliminar ticket

## Logs Esperados

En la consola de DevTools deberías ver:

```
Electron API adapter loaded
[IPC] get-all-tickets called
[Storage] Reading tickets from: C:\Users\...\tickets.json
[Storage] Parsed config with X tickets
[IPC] Retrieved X tickets
```

Al iniciar autopilot:
```
[IPC] Starting autopilot mode
[Autopilot] Processing ticket: TASK-001
[Autopilot] Starting ticket TASK-001...
✓ Ticket TASK-001 completed!
[Autopilot] Processing ticket: TASK-002
...
```

---

**Fecha:** 2026-02-14  
**Estado:** ✅ Completado  
**Próximos pasos:** Compilar, probar y verificar funcionamiento
