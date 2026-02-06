# Sistema de Resolución Automática de Tickets

Este directorio contiene el sistema de resolución automática de tickets usando GitHub Copilot CLI.

## 🏗️ Arquitectura

El sistema utiliza **TicketResolverCLI** que orquesta la resolución de tickets mediante Git worktrees y GitHub Copilot CLI.

### TicketResolverCLI

- **Responsabilidad**: Resolver tickets de forma automática usando worktrees
- **Tecnología**: Git worktrees, GitHub Copilot CLI
- **Salida**: Ticket resuelto con cambios committeados en branch de test

**Qué hace:**
- Crea git worktree aislado para el ticket
- Usa GitHub Copilot CLI para resolver el ticket interactivamente
- Genera commit message automático con GitHub Copilot SDK
- Genera resumen HTML detallado de los cambios
- Crea branch de test para revisión
- Maneja cleanup automático de worktrees

## 🎯 Flujo de Resolución

```
Ticket → Worktree → Copilot CLI → Git Diff → Commit → Test Branch → ✓
```

### Proceso Paso a Paso

1. **Crear Worktree**: Se crea un worktree aislado desde la branch base
2. **Resolver con Copilot CLI**: Se ejecuta `gh copilot` en el worktree
3. **Generar Commit Message**: GitHub Copilot SDK analiza el diff y genera el mensaje
4. **Commitear Cambios**: Se aplican los cambios con el mensaje generado
5. **Generar Resumen**: Se crea un resumen HTML detallado de los cambios
6. **Crear Test Branch**: Se crea branch `test/{ticket-id}` para revisión
7. **Volver a Base**: Se retorna a la branch base

## 📝 Tipos e Interfaces

El archivo `types.ts` contiene las interfaces básicas:

- `AgentContext` - Contexto compartido durante resolución
- `FileChange` - Representa un cambio en un archivo

## 🚀 Uso

### Básico (Modo CLI)

```typescript
import { TicketResolverCLI } from './agents/TicketResolverCLI.js';

const resolver = new TicketResolverCLI(ticket, {
  cleanupOnError: true
});

const result = await resolver.resolve();

if (result.success) {
  console.log('Ticket resuelto exitosamente!');
  console.log(`Test branch: ${result.testBranch}`);
  console.log(`Summary generated: ${result.summary ? 'Yes' : 'No'}`);
}
```

### Resultado

```typescript
interface ResolutionResult {
  success: boolean;
  ticket: Ticket;
  worktreePath?: string;
  hasChanges: boolean;
  testBranch?: string;
  commitMessage?: string;
  summary?: string;  // HTML summary of changes
  error?: string;
  duration: number;
}
```

## 🔧 Configuración

### Opciones del Resolver

```typescript
interface ResolverOptions {
  cleanupOnError?: boolean;  // Auto-cleanup worktree on error (default: true)
}
```

### Variables de Entorno

- `DEFAULT_BRANCH` - Branch base (default: `develop`)
- `DEBUG` - Activar modo debug

## 📊 Flujo Completo de Ejemplo

```
Usuario: autopilot start TICKET-001

1. 🌲 Creando worktree...
   → Worktree: /tmp/copilot-TICKET-001
   → Branch base: develop
   
2. 🤖 Ejecutando GitHub Copilot CLI...
   → gh copilot "Resolve TICKET-001: Fix authentication bug"
   → [Sesión interactiva con Copilot CLI]
   
3. 📝 Analizando cambios...
   → git diff encontró 3 archivos modificados
   
4. 💬 Generando mensaje de commit...
   → Usando GitHub Copilot SDK
   → Mensaje: "[feat]: Fix auth token validation(TICKET-001)"
   
5. 📊 Generando resumen HTML...
   → Análisis de cambios con Copilot SDK
   → Resumen en español generado
   
6. 🔀 Creando test branch...
   → Branch: test/TICKET-001
   
7. 🔄 Retornando a develop...

✓ Ticket TICKET-001 resuelto exitosamente
  Duración: 245.8s
  Worktree: /tmp/copilot-TICKET-001
  Test branch: test/TICKET-001
  Summary: Generated ✓
```

## 🎓 Mejores Prácticas

1. **Siempre revisar el test branch**: Verificar cambios antes de mergear
2. **Cleanup manual si falla**: Usar `autopilot worktree remove` si hay error
3. **Verificar resumen HTML**: Contiene análisis detallado de cambios
4. **Modo debug para troubleshooting**: Activar con `autopilot config debug on`

## 🔮 Características

✅ Git worktrees para aislamiento completo
✅ Integración con GitHub Copilot CLI
✅ Generación automática de commit messages
✅ Resumen HTML detallado de cambios en español
✅ Test branches automáticos para revisión
✅ Cleanup automático en caso de error
✅ Soporte para múltiples tickets concurrentes
