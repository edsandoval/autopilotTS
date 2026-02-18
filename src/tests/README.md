# Tests

Este directorio contiene los tests unitarios para AutopilotTS.

## Ejecutar Tests

```bash
# Ejecutar todos los tests una vez
npm test

# Ejecutar tests en modo watch (re-ejecuta al cambiar archivos)
npm run test:watch
```

## Estructura de Tests

### 1. **config.test.ts** - Configuración de Proyecto (5 tests)
- ✅ Leer/escribir project path
- ✅ Manejar modo debug
- ✅ Almacenar modelo de Copilot
- ✅ Crear estructura de config por defecto

### 2. **storage.test.ts** - Validación de Estructura de Tickets (3 tests)
- ✅ Validar formato de ticket IDs
- ✅ Validar campos requeridos en Ticket
- ✅ Soportar campos opcionales (branch, summary, timestamps)

### 3. **types.test.ts** - Tipos TypeScript (3 tests)
- ✅ Crear Tickets con estructura completa
- ✅ Soportar todos los TicketStatus
- ✅ Validar estructura de AutopilotResult

### 4. **git.test.ts** - Git y Branches (3 tests)
- ✅ Validar configuración de branch base
- ✅ Generar nombres de branches correctos
- ✅ Validar formato de ticket IDs en branches

### 5. **log-interceptor.test.ts** - Interceptor de Logs (4 tests)
- ✅ Inicializar con ventana Electron
- ✅ Configurar ticket ID
- ✅ Iniciar/detener intercepción
- ✅ Múltiples ciclos de start/stop

## Estadísticas

- **Total de archivos:** 5
- **Total de tests:** 18
- **Estado:** ✅ Todos pasando

## Cobertura

Los tests cubren las funcionalidades core:
- ✅ Sistema de configuración
- ✅ Validación de estructuras de datos
- ✅ Sistema de Git/branches
- ✅ Intercepción de logs para UI

## Tecnología

- **Framework**: [Vitest](https://vitest.dev/)
- **Configuración**: `vitest.config.ts`
- **Aislamiento**: Tests independientes, sin side-effects

## Cambios Recientes

**Tests eliminados (obsoletos):**
- ❌ `copilot-cli.test.ts` - Tests básicos sin valor funcional
- ❌ `prompt-config.test.ts` - Wrapper CLI legacy no usado
- ❌ `workflows.test.ts` - Tests genéricos sin contexto actual

**Tests actualizados:**
- ✨ `storage.test.ts` - Enfocado en validación de estructura
- ✨ `types.test.ts` - Recreado para arquitectura actual
- ✨ `git.test.ts` - Nuevo, tests de branching
- ✨ `log-interceptor.test.ts` - Nuevo, tests de logging

