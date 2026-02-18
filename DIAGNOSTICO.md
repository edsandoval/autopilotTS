# Diagnóstico de Lectura de Archivos - AutopilotTS

## Estado Actual ✅

La lectura de archivos desde `~/.autopilot` está funcionando **correctamente**:

- ✅ `config.json` se lee sin problemas
- ✅ `tickets.json` se lee sin problemas  
- ✅ Las clases `Storage` y `ConfigManager` funcionan correctamente
- ✅ Los IPC handlers de Electron están configurados correctamente

## Mejoras Implementadas

### 1. Logging Mejorado

Se agregó logging detallado en:

**`src/utils/storage.ts`:**
- Registra la ruta del archivo que se está leyendo
- Muestra el tamaño en bytes del archivo
- Indica cuántos tickets se parsearon
- Captura y registra cualquier error

**`src/utils/config.ts`:**
- Registra la ruta del archivo de configuración
- Muestra el tamaño del archivo
- Confirma cuando la configuración se carga exitosamente
- Captura y registra cualquier error

**`src/electron-main.ts`:**
- Logging en IPC handlers `get-all-tickets` y `get-config`
- Muestra cuántos tickets se recuperaron
- Registra errores de IPC

### 2. Validación de Archivos

Se agregó validación para verificar:
- Existencia de archivos antes de leerlos
- Errores de lectura de archivos
- Errores de parseo JSON
- Mensajes de error más descriptivos

### 3. Script de Diagnóstico

Nuevo archivo: `diagnose.mjs`

Ejecutar con:
```bash
npm run diagnose
```

Este script verifica:
1. Información del sistema (OS, Node version, home directory)
2. Existencia del directorio `~/.autopilot`
3. Validación de `config.json` (existe, es JSON válido, contenido)
4. Validación de `tickets.json` (existe, es JSON válido, cantidad de tickets)
5. Test de clases `Storage` y `ConfigManager`

## Cómo Verificar el Funcionamiento

### Opción 1: Script de Diagnóstico
```bash
npm run diagnose
```

### Opción 2: Ver Logs en Electron
1. Compilar el proyecto:
   ```bash
   npm run build
   ```

2. Ejecutar la aplicación:
   ```bash
   npm start
   ```

3. Abrir DevTools:
   - Presionar `Ctrl+Shift+I` (Windows/Linux)
   - O `Cmd+Option+I` (Mac)

4. Ver la consola - deberías ver logs como:
   ```
   [Storage] Reading tickets from: C:\Users\...\tickets.json
   [Storage] Read 33788 bytes from config file
   [Storage] Parsed config with 7 tickets
   [IPC] get-all-tickets called
   [IPC] Retrieved 7 tickets
   ```

## Resultado del Diagnóstico

Ejecuté `npm run diagnose` y todos los tests pasaron:

```
✓ Sistema operativo: Windows 10
✓ Node version: v22.21.1
✓ Directorio ~/.autopilot existe
✓ config.json existe y es JSON válido
✓ tickets.json existe y es JSON válido (7 tickets)
✓ Storage.getAllTickets() funciona correctamente
✓ ConfigManager.getConfig() funciona correctamente
```

## Posibles Problemas (si los hubiera)

Si la aplicación Electron no muestra los tickets correctamente, podría ser:

1. **Problema de Frontend**: El adaptador de Electron no está interceptando correctamente las llamadas fetch
   - Solución: Verificar que `electron-adapter.js` se carga antes que `app.js` en `index.html`

2. **Problema de IPC**: La comunicación entre el proceso principal y el renderer no funciona
   - Solución: Ver logs en DevTools (Ctrl+Shift+I)

3. **Problema de Permisos**: El sistema operativo no permite leer los archivos
   - Solución: Verificar permisos del directorio `~/.autopilot`

4. **Archivos Corruptos**: Los archivos JSON están malformados
   - Solución: Ejecutar `npm run diagnose` para verificar

## Archivos Modificados

1. `src/utils/storage.ts` - Agregado logging y validación
2. `src/utils/config.ts` - Agregado logging y validación
3. `src/electron-main.ts` - Agregado logging en IPC handlers
4. `package.json` - Agregado script `diagnose`
5. `diagnose.mjs` - Nuevo script de diagnóstico
6. `DIAGNOSTICO.md` - Este archivo

## Próximos Pasos

Si el problema persiste después de estas mejoras:

1. Ejecutar `npm run diagnose` y compartir el output completo
2. Ejecutar `npm start`, abrir DevTools, y compartir los logs de la consola
3. Verificar si hay errores en la pestaña "Console" de DevTools
4. Verificar si hay errores de red en la pestaña "Network" de DevTools

---

**Fecha de actualización**: 2026-02-14
**Versión**: 0.1.5
