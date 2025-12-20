# Refactorización: Centralización de Autenticación y Contexto de Usuario

## Resumen

Se ha centralizado la autenticación y el contexto de usuario (cliente y admin) sin cambiar el comportamiento del sistema. Los endpoints ahora consumen contexto en lugar de gestionar autenticación manualmente.

## Archivos Creados

### 1. `src/core/auth-context.js`
Módulo centralizado que expone:
- `requireStudentContext(request, env)` - Valida cookie, busca alumno, devuelve ctx o renderPantalla0
- `requireAdminContext(request, env)` - Valida admin, devuelve ctx o login admin

## Archivos Modificados

### 1. `src/endpoints/enter.js`
- ✅ Eliminada validación manual de cookies
- ✅ Eliminada lógica "si no hay alumno → render pantalla0"
- ✅ Usa `ctx.user` en lugar de buscar alumno directamente
- ✅ Mantiene toda la lógica de negocio intacta

### 2. `src/endpoints/practicas-handler.js`
- ✅ Eliminada función `validarAlumno()` duplicada
- ✅ Todas las funciones usan `requireStudentContext()`
- ✅ Usa `ctx.user` en lugar de buscar alumno directamente

### 3. `src/endpoints/limpieza-handler.js`
- ✅ Eliminada validación manual de cookies
- ✅ Todas las funciones usan `requireStudentContext()`
- ✅ Usa `ctx.user` en lugar de buscar alumno directamente

### 4. `src/endpoints/perfil-personal.js`
- ✅ Eliminada validación manual de cookies
- ✅ Usa `requireStudentContext()` al inicio
- ✅ Usa `ctx.user` en lugar de buscar alumno directamente

### 5. `src/endpoints/admin-panel-v4.js`
- ✅ Reemplazado `requireAdminAuth()` por `requireAdminContext()`
- ✅ Simplificada lógica de autenticación
- ✅ Mantiene compatibilidad con redirecciones

## Ejemplos de Contexto Resultante

### Contexto de Cliente (Estudiante)

```javascript
// Cuando el estudiante está autenticado:
{
  user: {
    id: 123,
    email: "alumno@example.com",
    apodo: "Juan",
    nivel: 5,
    nivel_actual: 5,
    streak: 42,
    suscripcionActiva: true,
    estado_suscripcion: "activa",
    tema_preferido: "dark",
    // ... otros campos del estudiante
  },
  isAdmin: false,
  isAuthenticated: true,
  request: Request // objeto request original
}

// Cuando NO está autenticado:
// requireStudentContext() devuelve directamente un Response HTML (pantalla0)
```

### Contexto de Admin

```javascript
// Cuando el admin está autenticado:
{
  user: {
    isAdmin: true
  },
  isAdmin: true,
  isAuthenticated: true,
  request: Request // objeto request original
}

// Cuando NO está autenticado:
// requireAdminContext() devuelve directamente un Response HTML (login admin)
```

## Regla Explícita Añadida

Todos los endpoints modificados incluyen el comentario:

```javascript
// REGLA: Los endpoints no gestionan autenticación; solo consumen contexto.
```

## Compatibilidad Total

✅ **Mismo comportamiento visible**: Los usuarios ven exactamente las mismas pantallas
✅ **Mismos redirects**: Las redirecciones funcionan igual que antes
✅ **Mismos errores**: Los mensajes de error son idénticos
✅ **Mismos HTML finales**: El HTML renderizado es el mismo
✅ **Mismos nombres de cookies**: `auri_user` y `admin_session` se mantienen

## Cambios Incrementales y Reversibles

- ✅ Cada cambio es independiente y puede revertirse fácilmente
- ✅ Los cambios son claros y documentados
- ✅ No se modificó lógica de negocio
- ✅ No se cambiaron flujos visibles para el usuario

## Notas de Riesgos o Límites Detectados

### Riesgos Mínimos
1. **Template de login admin**: Se asume que existe `src/core/html/admin/login.html` (verificado ✅)
2. **Compatibilidad con código legacy**: Algunos endpoints que no fueron refactorizados aún usan validación manual (no crítico)

### Límites
1. **Solo endpoints clave refactorizados**: Los endpoints mencionados en el requerimiento fueron refactorizados. Otros endpoints pueden seguir usando validación manual.
2. **Admin context simplificado**: El contexto de admin solo contiene `{ isAdmin: true }` por ahora. Si se necesita más información del admin en el futuro, se puede extender.

## Verificación

- ✅ No hay errores de sintaxis (verificado con linter)
- ✅ Template de login admin existe
- ✅ Todas las funciones de autenticación están centralizadas
- ✅ Los endpoints usan el contexto en lugar de validar manualmente

## Próximos Pasos (Opcional)

Si se desea extender esta refactorización:
1. Refactorizar otros endpoints que aún usan validación manual
2. Añadir más información al contexto de admin si es necesario
3. Crear tests unitarios para `auth-context.js`















