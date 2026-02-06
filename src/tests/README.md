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

### 1. **storage.test.ts** - Manejo de Tickets
- ✅ Crear estructura válida de tickets
- ✅ Persistir tickets a archivo JSON
- ✅ Cargar y auto-incrementar IDs
- ✅ Actualizar status de tickets
- ✅ Manejar múltiples tickets

### 2. **config.test.ts** - Configuración de Proyecto
- ✅ Leer/escribir project path
- ✅ Manejar modo debug
- ✅ Almacenar modelo de Copilot
- ✅ Crear estructura de config por defecto

### 3. **copilot-cli.test.ts** - Sistema de Prompts
- ✅ Crear directorio de prompts
- ✅ Guardar prompts con ticket ID en filename
- ✅ Preservar caracteres especiales en prompts
- ✅ Crear filename sin ticket ID cuando no se provee
- ✅ Usar ubicación estándar en home directory

### 4. **types.test.ts** - Validación de Tipos
- ✅ Crear objetos Ticket válidos
- ✅ Validar transiciones de status
- ✅ Incluir campo branch opcional
- ✅ Validar formato de ticket ID

### 5. **workflows.test.ts** - Flujos de Trabajo
- ✅ Generar nombres de branches correctos
- ✅ Manejar diferentes prefijos de tickets
- ✅ Validar nombre de branch por defecto
- ✅ Seguir ciclo de vida de status correcto

## Cobertura

Los tests cubren las funcionalidades más críticas:
- ✅ Persistencia de datos (tickets y configuración)
- ✅ Sistema de prompts mejorado con archivos
- ✅ Validación de tipos y estructuras
- ✅ Flujos de trabajo y convenciones

## Tecnología

- **Framework**: [Vitest](https://vitest.dev/) - Rápido, compatible con ES modules
- **Configuración**: `vitest.config.ts`
- **Ejecución**: Usa directorios temporales para aislar tests
