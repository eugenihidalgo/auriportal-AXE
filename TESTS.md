# 🧪 Guía de Testing - AuriPortal

## 📋 Resumen

Este documento explica cómo ejecutar y mantener los tests automatizados de AuriPortal, incluyendo tests de simuladores, feature flags, transacciones y endpoints de administración.

---

## 🚀 Inicio Rápido

### Instalación

```bash
# Instalar dependencias (incluye Jest)
npm install

# Ejecutar todos los tests
npm test

# Ejecutar tests en modo watch (desarrollo)
npm run test:watch

# Ejecutar tests con cobertura
npm run test:coverage
```

### Ejecución en CI

Los tests se ejecutan automáticamente en GitHub Actions cuando:
- Se hace push a `main`
- Se crea un pull request hacia `main`

---

## 📁 Estructura de Tests

```
tests/
├── setup.js                    # Configuración global de Jest
├── fixtures/                    # Datos de prueba reutilizables
│   ├── student.js              # Fixtures de estudiantes
│   ├── pausas.js               # Fixtures de pausas
│   └── practicas.js            # Fixtures de prácticas
├── helpers/                     # Utilidades para tests
│   ├── mocks.js                # Mocks comunes (DB, repos, etc.)
│   └── test-utils.js           # Utilidades generales
├── simuladores/                 # Tests de simuladores
│   ├── nivel.test.js
│   ├── streak.test.js
│   └── dias-activos.test.js
├── feature-flags/               # Tests de feature flags
│   └── feature-flags.test.js
├── transacciones/               # Tests de transacciones DB
│   └── transacciones.test.js
├── endpoints/                   # Tests de endpoints
│   └── admin.test.js
└── smoke/                       # Smoke tests
    └── smoke.test.js
```

---

## 🧪 Tipos de Tests

### 1. Tests de Simuladores

Verifican que los simuladores calculan correctamente los valores esperados.

**Ejemplo:**
```javascript
// tests/simuladores/nivel.test.js
it('debe calcular nivel correcto para 100 días activos', async () => {
  const result = await simulateNivelCambio(student, {
    diasActivosSimulados: 100
  });
  
  expect(result.simulated).toBeGreaterThanOrEqual(2);
});
```

**Cobertura esperada:** 80%+

### 2. Tests de Feature Flags

Verifican que el sistema de feature flags funciona correctamente:
- Flags "off" no se activan
- Flags "on" se activan en todos los entornos
- Flags "beta" se activan solo en dev/beta
- Wrappers retornan fallback cuando flag está activo

**Ejemplo:**
```javascript
it('debe retornar false para flag "off"', () => {
  expect(isFeatureEnabled('progress_v4')).toBe(false);
});
```

### 3. Tests de Transacciones

Verifican atomicidad y rollback:
- Transacciones completan con éxito
- Rollback funciona cuando hay errores
- No hay efectos parciales en DB

**Ejemplo:**
```javascript
it('debe revertir cambios cuando se hace rollback', async () => {
  // ... simular error y rollback
  expect(nivelActual).toBe(nivelOriginal);
});
```

### 4. Tests de Endpoints Admin

Verifican endpoints de simulación:
- `GET /admin/simulations/nivel?email=...`
- `GET /admin/simulations/streak?email=...`
- `GET /admin/simulations/dias-activos?email=...`

### 5. Smoke Tests

Verifican que los módulos principales se pueden importar sin errores.

---

## 🔧 Fixtures y Helpers

### Fixtures

**Estudiantes:**
```javascript
import { createTestStudent, createStudentWithStreak } from '../fixtures/student.js';

const student = createTestStudent({ nivel: 5 });
const studentWithStreak = createStudentWithStreak(10);
```

**Pausas:**
```javascript
import { createTestPausa, createActivePausa } from '../fixtures/pausas.js';
```

**Prácticas:**
```javascript
import { createConsecutivePractices } from '../fixtures/practicas.js';
```

### Helpers

**Mocks:**
```javascript
import { createMockEnv, mockFeatureFlags } from '../helpers/mocks.js';

const env = createMockEnv({ APP_ENV: 'dev' });
```

**Utilidades:**
```javascript
import { dateFromToday, formatDate } from '../helpers/test-utils.js';
```

---

## 📊 Cobertura de Código

### Umbrales Mínimos

- **Global:** 60% (branches, functions, lines, statements)
- **Módulos críticos (`src/modules/`):** 70%
- **Simuladores:** 80%

### Ver Cobertura

```bash
# Generar reporte HTML
npm run test:coverage

# Abrir reporte
open coverage/index.html
```

---

## 🐛 Debugging Tests

### Ejecutar un test específico

```bash
# Por nombre de archivo
npm test -- nivel.test.js

# Por patrón
npm test -- --testNamePattern="debe calcular nivel"
```

### Modo verbose

```bash
npm test -- --verbose
```

### Ejecutar tests en modo watch

```bash
npm run test:watch
```

---

## 🔄 CI/CD

### GitHub Actions

El pipeline se ejecuta automáticamente en:
- Push a `main`
- Pull requests a `main`

**Steps del pipeline:**
1. Checkout código
2. Setup Node.js (versiones 18.x y 20.x)
3. Instalar dependencias (`npm ci`)
4. Ejecutar linter (si existe)
5. Ejecutar tests
6. Generar reporte de cobertura
7. Comentar fallos en PR (si hay errores)

### Variables de Entorno en CI

```yaml
NODE_ENV: test
APP_ENV: dev
DATABASE_URL: postgresql://test:test@localhost:5432/test_auriportal
```

---

## ✅ Criterios de Éxito

Para que el pipeline CI pase:

1. ✅ Todos los tests deben pasar
2. ✅ Cobertura mínima alcanzada (60% global, 70% módulos críticos)
3. ✅ Tests de simuladores comparan correctamente con cálculos manuales
4. ✅ Tests de feature flags verifican comportamiento correcto
5. ✅ Tests de transacciones aseguran atomicidad
6. ✅ Smoke tests verifican que no hay errores de importación

---

## 📝 Escribir Nuevos Tests

### Estructura de un test

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('Mi Módulo', () => {
  let variable;
  
  beforeEach(() => {
    variable = createTestData();
  });
  
  it('debe hacer algo específico', () => {
    const result = miFuncion(variable);
    expect(result).toBe(expected);
  });
});
```

### Buenas Prácticas

1. **Usar fixtures** en lugar de crear datos manualmente
2. **Limpiar mocks** después de cada test (`afterEach`)
3. **Tests independientes** - no depender de orden de ejecución
4. **Nombres descriptivos** - "debe calcular X cuando Y"
5. **Un test, una verificación** - evitar múltiples expects no relacionados

---

## 🚨 Troubleshooting

### Error: "Cannot find module"

```bash
# Verificar que las dependencias están instaladas
npm install

# Limpiar cache de Jest
npm test -- --clearCache
```

### Error: "Timeout"

Aumentar timeout en el test:
```javascript
jest.setTimeout(60000); // 60 segundos
```

### Tests fallan en CI pero pasan localmente

- Verificar variables de entorno
- Verificar versión de Node.js
- Revisar logs de CI para más detalles

---

## 📚 Referencias

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

---

## 🤝 Contribuir

Al añadir nueva funcionalidad:

1. ✅ Escribir tests primero (TDD)
2. ✅ Asegurar cobertura mínima
3. ✅ Verificar que tests pasan localmente
4. ✅ Hacer push y verificar CI

---

**Última actualización:** 2024-12-19




















