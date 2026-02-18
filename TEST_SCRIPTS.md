# Scripts .bat para Testing - AutopilotTS

## 📝 Archivos Creados

Se han creado 3 scripts batch para facilitar la ejecución de tests en Windows:

### 1. `test.bat` - Ejecución Simple
Ejecuta todos los tests una vez y muestra el resultado.

**Uso:**
```bash
test.bat
```

**Características:**
- ✅ Ejecuta `npm test`
- ✅ Muestra mensaje de éxito/fallo con colores
- ✅ Pausa al final para ver resultados
- ✅ Retorna código de error apropiado

---

### 2. `test-watch.bat` - Modo Watch
Ejecuta tests en modo watch (se re-ejecutan automáticamente al cambiar archivos).

**Uso:**
```bash
test-watch.bat
```

**Características:**
- ✅ Ejecuta `npm run test:watch`
- ✅ Re-ejecuta tests al guardar cambios
- ✅ Ideal para desarrollo
- ✅ Presiona Ctrl+C para detener

---

### 3. `test-coverage.bat` - Cobertura de Código
Ejecuta tests y genera reporte de cobertura.

**Uso:**
```bash
test-coverage.bat
```

**Características:**
- ✅ Ejecuta `npm run test -- --coverage`
- ✅ Genera reporte en carpeta `coverage/`
- ✅ Muestra porcentaje de cobertura
- ✅ Útil para análisis de calidad

---

## 🚀 Forma de Uso

### Desarrollo día a día:
```bash
# Durante desarrollo, usa watch mode
test-watch.bat
```

### Antes de commit:
```bash
# Verifica que todos pasen
test.bat
```

### Análisis de cobertura:
```bash
# Genera reporte detallado
test-coverage.bat
```

---

## 📊 Tests Disponibles

El proyecto tiene **18 tests funcionales** distribuidos en 5 archivos:

- **config.test.ts** (5 tests) - Configuración
- **storage.test.ts** (3 tests) - Estructura de tickets
- **types.test.ts** (3 tests) - Validación de tipos
- **git.test.ts** (3 tests) - Git y branching
- **log-interceptor.test.ts** (4 tests) - Logging

---

## 🎯 Estado Actual

✅ Todos los tests pasan correctamente
✅ TypeScript compila sin errores
✅ Código limpio (eliminado código muerto)
✅ Tests relevantes para funcionalidad actual

---

## 📚 Documentación Relacionada

- `src/tests/README.md` - Documentación detallada de tests
- `README.md` - Sección de tests actualizada
- `vitest.config.ts` - Configuración de Vitest

---

## 💡 Tips

1. **Desarrollo activo:** Usa `test-watch.bat` para feedback inmediato
2. **CI/CD:** `test.bat` es perfecto para scripts de integración continua
3. **Code Review:** `test-coverage.bat` ayuda a identificar código sin tests
4. **NPM también funciona:** Los scripts .bat son conveniencia, pero `npm test` funciona igual
