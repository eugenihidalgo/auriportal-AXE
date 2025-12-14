# Guía Completa de Verificación - Sistema de Analytics AuriPortal

## 📋 Índice

1. [Verificación Inicial](#verificación-inicial)
2. [Verificación de Base de Datos](#verificación-de-base-de-datos)
3. [Verificación del Servicio](#verificación-del-servicio)
4. [Verificación del Panel Admin](#verificación-del-panel-admin)
5. [Verificación de Integración con Typeform](#verificación-de-integración-con-typeform)
6. [Pruebas End-to-End](#pruebas-end-to-end)
7. [Solución de Problemas](#solución-de-problemas)

---

## 1. Verificación Inicial

### 1.1. Verificar que el servidor está corriendo

```bash
cd /var/www/aurelinportal
pm2 status
```

**Resultado esperado:**
- `aurelinportal` debe estar en estado `online`
- Sin errores en los logs

### 1.2. Verificar logs del servidor

```bash
pm2 logs aurelinportal --lines 50
```

**Buscar:**
- ✅ `Tablas PostgreSQL creadas/verificadas correctamente`
- ✅ `Tarea programada configurada: Cálculo de resumen diario de analytics a las 2:00 AM`
- ❌ No debe haber errores relacionados con `analytics_eventos` o `analytics_resumen_diario`

### 1.3. Ejecutar script de verificación

```bash
cd /var/www/aurelinportal
node scripts/verificar-analytics.js
```

**Resultado esperado:**
- ✅ Todas las tablas existen
- ✅ Todos los índices existen
- ✅ El servicio de analytics funciona correctamente

---

## 2. Verificación de Base de Datos

### 2.1. Conectar a PostgreSQL

```bash
psql -U postgres -d aurelinportal
# O según tu configuración:
psql $DATABASE_URL
```

### 2.2. Verificar tablas

```sql
-- Verificar que las tablas existen
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('analytics_eventos', 'analytics_resumen_diario')
ORDER BY table_name;
```

**Resultado esperado:**
```
    table_name
--------------------
 analytics_eventos
 analytics_resumen_diario
(2 rows)
```

### 2.3. Verificar estructura de `analytics_eventos`

```sql
\d analytics_eventos
```

**Resultado esperado:**
```
                                      Table "public.analytics_eventos"
    Column    |            Type             | Collation | Nullable |                    Default
--------------+-----------------------------+-----------+----------+--------------------------------------------
 id           | integer                     |           | not null | nextval('analytics_eventos_id_seq'::regclass)
 alumno_id    | integer                     |           |          |
 tipo_evento  | text                        |           | not null |
 fecha        | timestamp without time zone |           |          | CURRENT_TIMESTAMP
 metadata     | jsonb                       |           |          | '{}'::jsonb
 created_at   | timestamp without time zone |           |          | CURRENT_TIMESTAMP
Indexes:
    "analytics_eventos_pkey" PRIMARY KEY, btree (id)
    "idx_analytics_eventos_alumno" btree (alumno_id)
    "idx_analytics_eventos_tipo" btree (tipo_evento)
    "idx_analytics_eventos_fecha" btree (fecha)
Foreign-key constraints:
    "analytics_eventos_alumno_id_fkey" FOREIGN KEY (alumno_id) REFERENCES alumnos(id) ON DELETE CASCADE
```

### 2.4. Verificar estructura de `analytics_resumen_diario`

```sql
\d analytics_resumen_diario
```

**Resultado esperado:**
```
                                    Table "public.analytics_resumen_diario"
      Column       |            Type             | Collation | Nullable |                    Default
-------------------+-----------------------------+-----------+----------+--------------------------------------------
 id                | integer                     |           | not null | nextval('analytics_resumen_diario_id_seq'::regclass)
 fecha             | date                        |           | not null |
 alumnos_activos   | integer                     |           |          | 0
 practicas_totales | integer                     |           |          | 0
 energia_media     | numeric(4,2)                |           |          | 0
 nivel_promedio    | numeric(4,2)                |           |          | 0
 fase_predominante | text                        |           |          |
 metadata          | jsonb                       |           |          | '{}'::jsonb
 created_at        | timestamp without time zone |           |          | CURRENT_TIMESTAMP
 updated_at        | timestamp without time zone |           |          | CURRENT_TIMESTAMP
Indexes:
    "analytics_resumen_diario_pkey" PRIMARY KEY, btree (id)
    "analytics_resumen_diario_fecha_key" UNIQUE CONSTRAINT, btree (fecha)
    "idx_analytics_resumen_fecha" btree (fecha)
```

### 2.5. Verificar índices

```sql
SELECT indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('analytics_eventos', 'analytics_resumen_diario')
ORDER BY indexname;
```

**Resultado esperado:**
```
              indexname
-----------------------------------
 analytics_eventos_pkey
 analytics_resumen_diario_pkey
 idx_analytics_eventos_alumno
 idx_analytics_eventos_fecha
 idx_analytics_eventos_tipo
 idx_analytics_resumen_fecha
(6 rows)
```

---

## 3. Verificación del Servicio

### 3.1. Probar registro de evento manualmente

Conecta a PostgreSQL y ejecuta:

```sql
-- Insertar un evento de prueba
INSERT INTO analytics_eventos (tipo_evento, metadata)
VALUES ('test_manual', '{"test": true, "timestamp": "2024-12-01T12:00:00Z"}'::jsonb);

-- Verificar que se insertó
SELECT * FROM analytics_eventos WHERE tipo_evento = 'test_manual';

-- Limpiar
DELETE FROM analytics_eventos WHERE tipo_evento = 'test_manual';
```

**Resultado esperado:**
- El evento se inserta correctamente
- Se puede consultar sin problemas
- Se elimina correctamente

### 3.2. Verificar que el servicio funciona desde Node.js

Crea un archivo temporal de prueba:

```bash
cat > /tmp/test-analytics.js << 'EOF'
import { analytics } from './src/services/analytics.js';

async function test() {
  try {
    // Probar registro de evento
    await analytics.registrarEvento({
      tipo_evento: 'test_servicio',
      metadata: { test: true }
    });
    console.log('✅ Evento registrado correctamente');
    
    // Probar obtener estadísticas
    const stats = await analytics.getEstadisticasGenerales();
    console.log('✅ Estadísticas obtenidas:', stats);
    
    // Limpiar
    const { query } = await import('./database/pg.js');
    await query('DELETE FROM analytics_eventos WHERE tipo_evento = $1', ['test_servicio']);
    console.log('✅ Test completado');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

test();
EOF

cd /var/www/aurelinportal
node /tmp/test-analytics.js
```

**Resultado esperado:**
- ✅ Evento registrado correctamente
- ✅ Estadísticas obtenidas
- ✅ Test completado

---

## 4. Verificación del Panel Admin

### 4.1. Acceder al panel de Analytics

1. Abre tu navegador
2. Ve a: `https://admin.pdeeugenihidalgo.org/admin/analytics`
3. Inicia sesión con tus credenciales

**Resultado esperado:**
- ✅ La página carga sin errores
- ✅ Se muestra el menú "Analytics" en la barra de navegación
- ✅ Se muestran las estadísticas generales (pueden estar en 0 si no hay eventos aún)

### 4.2. Verificar secciones del panel

**Secciones que deben aparecer:**
1. ✅ **Estadísticas Generales** (4 tarjetas con números)
2. ✅ **Eventos por Tipo** (tabla con tipos de eventos)
3. ✅ **Filtros** (fecha desde, fecha hasta, tipo evento, alumno)
4. ✅ **Resumen Diario** (tabla con resúmenes)
5. ✅ **Eventos Recientes** (si hay eventos y filtros aplicados)

### 4.3. Probar botón "Calcular Resumen Diario"

1. Haz clic en el botón "🔄 Calcular Resumen Diario"
2. Confirma la acción
3. Espera a que se complete

**Resultado esperado:**
- ✅ Aparece un mensaje de confirmación
- ✅ La página se recarga
- ✅ Aparece un nuevo resumen en la tabla "Resumen Diario"

### 4.4. Verificar filtros

1. Selecciona un rango de fechas (últimos 7 días)
2. Haz clic en "Filtrar"

**Resultado esperado:**
- ✅ La URL cambia con los parámetros de filtro
- ✅ Los datos se filtran correctamente
- ✅ El resumen diario muestra solo los días del rango

### 4.5. Verificar enlace a alumno

Si hay eventos con `alumno_id`:
1. Haz clic en "Ver Alumno" en la columna "Alumno"
2. Debe redirigir a `/admin/alumno/{id}`

**Resultado esperado:**
- ✅ Redirige correctamente
- ✅ Muestra los datos del alumno

---

## 5. Verificación de Integración con Typeform

### 5.1. Verificar que el webhook está registrando eventos

**Opción A: Verificar en la base de datos**

```sql
-- Ver eventos de webhook
SELECT 
  tipo_evento,
  COUNT(*) as total,
  MIN(fecha) as primer_evento,
  MAX(fecha) as ultimo_evento
FROM analytics_eventos
WHERE tipo_evento IN ('webhook_typeform', 'confirmacion_practica', 'cambio_streak')
GROUP BY tipo_evento
ORDER BY total DESC;
```

**Resultado esperado:**
- Debe mostrar eventos si se han enviado Typeforms
- Los tipos deben ser: `webhook_typeform`, `confirmacion_practica`, `cambio_streak`

**Opción B: Verificar en los logs del servidor**

```bash
pm2 logs aurelinportal --lines 100 | grep -i "evento registrado\|analytics"
```

**Resultado esperado:**
- Debe aparecer: `📊 Evento registrado: webhook_typeform (alumno X)`
- Debe aparecer: `📊 Evento registrado: confirmacion_practica (alumno X)`

### 5.2. Enviar un Typeform de prueba

1. Ve a tu Typeform de prueba
2. Completa el formulario
3. Envía el formulario

**Verificar en tiempo real:**

```bash
# En otra terminal, monitorea los logs
pm2 logs aurelinportal --lines 0
```

**Resultado esperado:**
- ✅ Aparece: `📝 Webhook Typeform recibido para: {email}`
- ✅ Aparece: `📊 Evento registrado: webhook_typeform (alumno {id})`
- ✅ Si es una práctica: `📊 Evento registrado: confirmacion_practica (alumno {id})`

### 5.3. Verificar eventos en el panel Admin

1. Ve a `/admin/analytics`
2. Filtra por fecha de hoy
3. Busca eventos de tipo `webhook_typeform` o `confirmacion_practica`

**Resultado esperado:**
- ✅ Aparecen los eventos recientes
- ✅ El metadata muestra información relevante (form_id, aspecto_id, etc.)

---

## 6. Pruebas End-to-End

### 6.1. Flujo completo: Typeform → Analytics → Panel Admin

**Pasos:**

1. **Enviar Typeform:**
   - Completa un Typeform de práctica
   - Envía el formulario

2. **Verificar en base de datos:**
   ```sql
   SELECT * FROM analytics_eventos 
   WHERE tipo_evento = 'webhook_typeform' 
   ORDER BY fecha DESC 
   LIMIT 1;
   ```

3. **Verificar en panel Admin:**
   - Ve a `/admin/analytics`
   - Filtra por fecha de hoy
   - Debe aparecer el evento

4. **Verificar resumen diario:**
   - Haz clic en "Calcular Resumen Diario"
   - Verifica que el resumen se actualiza

**Resultado esperado:**
- ✅ Todo el flujo funciona correctamente
- ✅ Los datos son consistentes en todas las etapas

### 6.2. Prueba de múltiples eventos

1. Envía 3 Typeforms diferentes
2. Verifica que se registran 3 eventos
3. Verifica que el contador de "Últimos 7 días" aumenta

**Resultado esperado:**
- ✅ Se registran todos los eventos
- ✅ Los contadores se actualizan correctamente

### 6.3. Prueba de filtros avanzados

1. Filtra por un alumno específico
2. Filtra por tipo de evento
3. Filtra por rango de fechas
4. Combina múltiples filtros

**Resultado esperado:**
- ✅ Los filtros funcionan correctamente
- ✅ Los resultados son precisos
- ✅ La URL refleja los filtros aplicados

---

## 7. Solución de Problemas

### 7.1. Error: "relation analytics_eventos does not exist"

**Causa:** Las tablas no se crearon correctamente.

**Solución:**
```bash
cd /var/www/aurelinportal
pm2 restart aurelinportal
# Verificar logs
pm2 logs aurelinportal --lines 50
```

Si persiste, crear las tablas manualmente:

```sql
-- Ejecutar en PostgreSQL
\i /var/www/aurelinportal/database/schema-analytics.sql
```

### 7.2. No aparecen eventos en el panel

**Verificaciones:**

1. **¿Se están registrando eventos?**
   ```sql
   SELECT COUNT(*) FROM analytics_eventos;
   ```

2. **¿Los filtros son correctos?**
   - Verifica que las fechas no sean futuras
   - Verifica que el tipo de evento existe

3. **¿Hay errores en la consola del navegador?**
   - Abre DevTools (F12)
   - Ve a la pestaña Console
   - Busca errores JavaScript

### 7.3. El botón "Calcular Resumen Diario" no funciona

**Verificaciones:**

1. **¿Hay errores en la consola del navegador?**
   - Abre DevTools (F12)
   - Ve a la pestaña Network
   - Intenta calcular el resumen
   - Verifica la respuesta del servidor

2. **¿El endpoint está correctamente configurado?**
   ```bash
   # Verificar que la ruta existe
   curl -X POST https://admin.pdeeugenihidalgo.org/admin/analytics?action=calcular_resumen \
     -H "Cookie: admin_session=..." \
     -v
   ```

3. **¿Hay errores en los logs del servidor?**
   ```bash
   pm2 logs aurelinportal --lines 50 | grep -i "resumen\|analytics"
   ```

### 7.4. Los eventos no se registran desde Typeform

**Verificaciones:**

1. **¿El webhook está recibiendo datos?**
   ```bash
   pm2 logs aurelinportal --lines 100 | grep -i "webhook typeform"
   ```

2. **¿Hay errores al registrar eventos?**
   ```bash
   pm2 logs aurelinportal --lines 100 | grep -i "error.*analytics\|error.*evento"
   ```

3. **¿El servicio de analytics está importado correctamente?**
   ```bash
   # Verificar que el archivo existe
   ls -la /var/www/aurelinportal/src/services/analytics.js
   ```

### 7.5. El resumen diario está vacío

**Solución:**

1. **Calcular manualmente:**
   - Usa el botón "Calcular Resumen Diario" en el panel
   - O ejecuta desde Node.js:
   ```javascript
   import { analytics } from './src/services/analytics.js';
   await analytics.calcularResumenDiario();
   ```

2. **Verificar que hay datos para calcular:**
   ```sql
   -- Verificar prácticas del día
   SELECT COUNT(*) FROM practicas WHERE DATE(fecha) = CURRENT_DATE;
   
   -- Verificar alumnos activos
   SELECT COUNT(DISTINCT alumno_id) 
   FROM practicas 
   WHERE DATE(fecha) = CURRENT_DATE;
   ```

---

## 8. Checklist Final de Verificación

Antes de considerar el sistema completamente funcional, verifica:

- [ ] ✅ Las tablas existen en PostgreSQL
- [ ] ✅ Los índices están creados
- [ ] ✅ El servicio de analytics funciona
- [ ] ✅ El panel Admin carga correctamente
- [ ] ✅ Se puede calcular resumen diario
- [ ] ✅ Los filtros funcionan
- [ ] ✅ Los eventos de Typeform se registran
- [ ] ✅ Los eventos aparecen en el panel
- [ ] ✅ El cron job está configurado (se ejecuta a las 2:00 AM)
- [ ] ✅ No hay errores en los logs

---

## 9. Comandos Útiles

### Ver eventos recientes
```sql
SELECT * FROM analytics_eventos 
ORDER BY fecha DESC 
LIMIT 10;
```

### Ver resumen diario
```sql
SELECT * FROM analytics_resumen_diario 
ORDER BY fecha DESC 
LIMIT 7;
```

### Estadísticas rápidas
```sql
SELECT 
  tipo_evento,
  COUNT(*) as total,
  COUNT(DISTINCT alumno_id) as alumnos_unicos
FROM analytics_eventos
GROUP BY tipo_evento
ORDER BY total DESC;
```

### Limpiar eventos de prueba
```sql
DELETE FROM analytics_eventos WHERE tipo_evento LIKE 'test_%';
```

### Verificar integridad
```sql
-- Eventos sin alumno (pueden ser válidos)
SELECT COUNT(*) FROM analytics_eventos WHERE alumno_id IS NULL;

-- Eventos con metadata inválido
SELECT id, tipo_evento, metadata 
FROM analytics_eventos 
WHERE metadata::text = '{}' OR metadata IS NULL;
```

---

## 10. Próximos Pasos

Una vez verificado que todo funciona:

1. **Monitorear durante 24 horas:**
   - Verificar que los eventos se registran correctamente
   - Verificar que el resumen diario se calcula automáticamente

2. **Configurar alertas (opcional):**
   - Si no hay eventos durante X horas, enviar alerta
   - Si el resumen diario falla, enviar alerta

3. **Documentar casos de uso:**
   - Cómo usar los filtros
   - Cómo interpretar las métricas
   - Cómo exportar datos

---

**Última actualización:** Diciembre 2024

**Versión del sistema:** AuriPortal v4.0.0 con Analytics




