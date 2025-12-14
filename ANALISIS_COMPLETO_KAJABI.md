# 📊 Análisis Completo: TODA la Información Disponible de Kajabi

## 🔍 Resumen Ejecutivo

**Webhooks disponibles:** Solo **6 eventos** (ya implementados)
**Información adicional disponible:** **MÁS DE 50 endpoints** con datos completos
**Estrategia:** Webhooks (tiempo real) + Polling inteligente (datos completos) + Base de datos expandida

---

## 📡 Webhooks Disponibles (Solo 6)

Kajabi **solo ofrece 6 tipos de webhooks**:

1. ✅ `purchase` - Cuando alguien compra
2. ✅ `payment_succeeded` - Cuando se completa un pago
3. ✅ `order_created` - Cuando se crea un pedido
4. ✅ `form_submission` - Cuando se envía un formulario
5. ✅ `tag_added` - Cuando se añade un tag
6. ✅ `tag_removed` - Cuando se elimina un tag

**❌ NO hay webhooks para:**
- Suscripciones canceladas/pausadas/reactivadas
- Cambios en compras (deactivate/reactivate)
- Cambios en contactos
- Cambios en ofertas
- Cambios en productos
- Y muchos otros eventos

---

## 🎯 Información Adicional Disponible (Más de 50 Endpoints)

Aunque solo hay 6 webhooks, la API de Kajabi ofrece **MÁS DE 50 endpoints** con información completa:

### **1. Purchases (Compras) - Información Completa**
**Endpoints:**
- `GET /v1/purchases` - Listar todas las compras
- `GET /v1/purchases/:id` - Detalles de compra
- `POST /v1/purchases/:id/reactivate` - Reactivar compra
- `POST /v1/purchases/:id/deactivate` - Desactivar compra
- `POST /v1/purchases/:id/cancel_subscription` - Cancelar suscripción

**Información disponible:**
- ✅ `deactivated_at` - **Fecha de desactivación** (cuando alguien deja suscripción)
- ✅ `deactivation_reason` - **Razón de desactivación**
- ✅ `effective_start_at` - Fecha inicio
- ✅ `amount_in_cents` - Precio
- ✅ `currency` - Moneda
- ✅ `payment_type` - Tipo de pago
- ✅ `multipay_payments_made` - Pagos realizados
- ✅ `coupon_code` - Código de cupón usado
- ✅ `source` - Origen de la compra
- ✅ `referrer` - Referente
- ✅ `quantity` - Cantidad
- ✅ Estado completo de suscripción

**Filtros disponibles:**
- Por customer: `filter[customer_id]=123`
- Por site: `filter[site_id]=123`
- Por fecha desactivación: `filter[deactivated_at_null]=false` (solo desactivadas)
- Por razón: `filter[deactivation_reason_cont]=cancel`

### **2. Transactions (Transacciones) - Información Financiera Completa**
**Endpoints:**
- `GET /v1/transactions` - Listar transacciones
- `GET /v1/transactions/:id` - Detalles de transacción

**Información disponible:**
- ✅ `action` - Tipo: `charge`, `refund`, `subscribe`, `subscription_charge`, `free_purchase`, `test`, `dispute`, `subscription_update`
- ✅ `state` - Estado: `initialized`, `succeeded`, `failed`
- ✅ `amount_in_cents` - Monto
- ✅ `sales_tax_in_cents` - Impuestos
- ✅ `currency` - Moneda
- ✅ `formatted_amount` - Monto formateado
- ✅ Relación con customer y offer

**Filtros disponibles:**
- Por customer: `filter[customer_id]=123`
- Por nombre/email: `filter[name_or_email]=john`
- Por rango de fechas: `filter[start_date]=2024-01-01&filter[end_date]=2024-01-31`
- Por site: `filter[site_id]=123`

### **3. Orders (Pedidos) - Información de Pedidos**
**Endpoints:**
- `GET /v1/orders` - Listar pedidos
- `GET /v1/orders/:id` - Detalles de pedido
- `GET /v1/order_items` - Listar items de pedido
- `GET /v1/order_items/:id` - Detalles de item

**Información disponible:**
- ✅ `order_number` - Número de pedido
- ✅ `total_price_in_cents` - Precio total
- ✅ `subtotal_in_cents` - Subtotal
- ✅ `sales_tax_amount_in_cents` - Impuestos
- ✅ `discount_amount_in_cents` - Descuentos
- ✅ `fulfilled_at` - Fecha de cumplimiento
- ✅ Items del pedido con detalles

### **4. Products (Productos) - Catálogo Completo**
**Endpoints:**
- `GET /v1/products` - Listar productos
- `GET /v1/products/:id` - Detalles de producto

**Información disponible:**
- ✅ `title` - Título
- ✅ `description` - Descripción
- ✅ `status` - Estado (ready, etc.)
- ✅ `publish_status` - Estado de publicación
- ✅ `product_type_name` - Tipo (Course, etc.)
- ✅ `members_aggregate_count` - Número de miembros
- ✅ `image_url` - URL de imagen
- ✅ `thumbnail_url` - URL de miniatura

### **5. Courses (Cursos) - Información de Cursos**
**Endpoints:**
- `GET /v1/courses` - Listar cursos
- `GET /v1/courses/:id` - Detalles de curso

**Información disponible:**
- ✅ Toda la información de productos
- ✅ Información específica de cursos
- ✅ Relación con lecciones y módulos

### **6. Offers (Ofertas) - Información de Ofertas**
**Endpoints:**
- `GET /v1/offers` - Listar ofertas
- `GET /v1/offers/:id` - Detalles de oferta
- `GET /v1/offers/:id/products` - Productos de oferta

**Información disponible:**
- ✅ `title` - Título
- ✅ `description` - Descripción
- ✅ `internal_title` - Título interno
- ✅ `price_in_cents` - Precio
- ✅ `currency` - Moneda
- ✅ `token` - Token único
- ✅ `checkout_url` - URL de checkout
- ✅ `recurring_offer` - Si es recurrente
- ✅ `subscription` - Si es suscripción
- ✅ `one_time` - Si es pago único
- ✅ `free` - Si es gratis
- ✅ `image_url` - URL de imagen
- ✅ Productos asociados

### **7. Contact Notes (Notas de Contacto)**
**Endpoints:**
- `GET /v1/contact_notes` - Listar notas
- `GET /v1/contact_notes/:id` - Detalles de nota
- `POST /v1/contact_notes` - Crear nota
- `PATCH /v1/contact_notes/:id` - Actualizar nota
- `DELETE /v1/contact_notes/:id` - Eliminar nota

**Información disponible:**
- ✅ `body` - Contenido de la nota
- ✅ `created_at` - Fecha creación
- ✅ `updated_at` - Fecha actualización
- ✅ Relación con contacto

### **8. Form Submissions (Envíos de Formulario)**
**Endpoints:**
- `GET /v1/form_submissions` - Listar envíos
- `GET /v1/form_submissions/:id` - Detalles de envío

**Información disponible:**
- ✅ Todos los campos del formulario
- ✅ Email, nombre, dirección, teléfono
- ✅ Campos personalizados
- ✅ Relación con formulario y sitio

### **9. Custom Fields (Campos Personalizados)**
**Endpoints:**
- `GET /v1/custom_fields` - Listar campos
- `GET /v1/custom_fields/:id` - Detalles de campo

**Información disponible:**
- ✅ Todos los campos personalizados
- ✅ Valores de campos por contacto

### **10. Sites (Sitios) - Información del Sitio**
**Endpoints:**
- `GET /v1/sites` - Listar sitios
- `GET /v1/sites/:id` - Detalles de sitio
- `GET /v1/sites/:id/landing_pages` - Páginas de aterrizaje
- `GET /v1/sites/:id/website_pages` - Páginas web
- `GET /v1/sites/:id/blog_posts` - Posts de blog

---

## 💡 Estrategia para Obtener TODA la Información

### **Nivel 1: Webhooks (Tiempo Real) - ✅ Ya Implementado**
- 6 webhooks configurados
- Sincronización automática cuando hay eventos
- **Cubre:** Compras, pagos, pedidos, formularios, tags

### **Nivel 2: Polling Inteligente (Datos Completos)**
**Sincronización periódica de:**
1. **Purchases con `deactivated_at`** - Para detectar suscripciones canceladas/pausadas
2. **Transactions** - Para historial financiero completo
3. **Orders** - Para historial de pedidos
4. **Products/Courses/Offers** - Para catálogo completo
5. **Contact Notes** - Para notas de contacto
6. **Form Submissions** - Para todos los envíos de formularios

### **Nivel 3: Base de Datos Expandida**
**Tablas adicionales a crear:**
1. `kajabi_purchases` - Todas las compras con estado completo
2. `kajabi_transactions` - Todas las transacciones
3. `kajabi_orders` - Todos los pedidos
4. `kajabi_order_items` - Items de pedidos
5. `kajabi_products` - Catálogo de productos
6. `kajabi_courses` - Catálogo de cursos
7. `kajabi_offers` - Catálogo de ofertas (expandir existente)
8. `kajabi_contact_notes` - Notas de contacto
9. `kajabi_form_submissions` - Envíos de formularios
10. `kajabi_custom_fields` - Campos personalizados
11. `kajabi_tags` - Tags disponibles
12. `kajabi_sites` - Información de sitios

---

## 📋 Información Específica que Necesitas

### **Suscripciones Canceladas/Pausadas:**
**Cómo obtenerla:**
- ✅ **Webhook `purchase`** - Detecta nuevas compras
- ✅ **Polling de Purchases** - Filtrar por `deactivated_at NOT NULL`
- ✅ **Campo `deactivation_reason`** - Razón de cancelación/pausa

**Query ejemplo:**
```sql
SELECT * FROM purchases 
WHERE deactivated_at IS NOT NULL 
AND deactivation_reason LIKE '%cancel%'
```

### **Cantidad de Ofertas:**
**Cómo obtenerla:**
- ✅ **Endpoint:** `GET /v1/offers?filter[site_id]=123`
- ✅ **Guardar en BD:** Tabla `kajabi_offers` con contador
- ✅ **Sincronizar periódicamente:** Cada X horas

### **Cantidad de Cursos:**
**Cómo obtenerla:**
- ✅ **Endpoint:** `GET /v1/courses?filter[site_id]=123`
- ✅ **Guardar en BD:** Tabla `kajabi_courses`
- ✅ **Sincronizar periódicamente:** Cada X horas

### **Historial Completo de Transacciones:**
**Cómo obtenerla:**
- ✅ **Endpoint:** `GET /v1/transactions?filter[site_id]=123`
- ✅ **Guardar en BD:** Tabla `kajabi_transactions`
- ✅ **Incluir:** Todos los tipos de transacciones (charges, refunds, subscriptions, etc.)

### **Todas las Compras con Estado:**
**Cómo obtenerla:**
- ✅ **Endpoint:** `GET /v1/purchases?filter[site_id]=123&include=customer,offer`
- ✅ **Guardar en BD:** Tabla `kajabi_purchases` expandida
- ✅ **Incluir:** `deactivated_at`, `deactivation_reason`, estado completo

---

## 🎯 Plan de Implementación Completo

### **Fase 1: Expandir Base de Datos** ⏳
Crear todas las tablas necesarias para almacenar:
- Purchases completos
- Transactions
- Orders y Order Items
- Products, Courses, Offers (catálogo)
- Contact Notes
- Form Submissions
- Custom Fields
- Tags

### **Fase 2: Servicios de Sincronización** ⏳
Crear servicios para sincronizar:
- `sync-purchases-complete.js` - Todas las compras con estado
- `sync-transactions.js` - Todas las transacciones
- `sync-orders.js` - Todos los pedidos
- `sync-catalog.js` - Productos, cursos, ofertas
- `sync-contact-notes.js` - Notas de contacto
- `sync-form-submissions.js` - Envíos de formularios

### **Fase 3: Endpoints de Sincronización** ⏳
Crear endpoints para:
- `/sync-all-kajabi-data` - Sincronizar TODO
- `/sync-purchases` - Solo compras
- `/sync-transactions` - Solo transacciones
- `/sync-catalog` - Solo catálogo
- `/sync-subscriptions-status` - Estado de suscripciones

### **Fase 4: Polling Automático** ⏳
Configurar cron jobs para:
- Sincronizar purchases cada hora (detectar cancelaciones)
- Sincronizar transactions diariamente
- Sincronizar catálogo semanalmente
- Sincronizar form submissions diariamente

### **Fase 5: Mejorar Webhooks** ⏳
Expandir handlers de webhooks para:
- Guardar información completa en todas las tablas
- Detectar cambios de estado
- Actualizar múltiples tablas relacionadas

---

## 📊 Resumen de Información Disponible

### **Webhooks (6 eventos):**
- ✅ purchase
- ✅ payment_succeeded
- ✅ order_created
- ✅ form_submission
- ✅ tag_added
- ✅ tag_removed

### **Endpoints de API (50+ endpoints):**
- ✅ **Purchases:** 5 endpoints (list, details, reactivate, deactivate, cancel_subscription)
- ✅ **Transactions:** 2 endpoints (list, details)
- ✅ **Orders:** 3 endpoints (list, details, items)
- ✅ **Products:** 2 endpoints (list, details)
- ✅ **Courses:** 2 endpoints (list, details)
- ✅ **Offers:** 3 endpoints (list, details, products)
- ✅ **Contacts:** 10+ endpoints (CRUD completo + relaciones)
- ✅ **Customers:** 5+ endpoints
- ✅ **Contact Notes:** 5 endpoints (CRUD completo)
- ✅ **Form Submissions:** 2 endpoints
- ✅ **Custom Fields:** 2 endpoints
- ✅ **Contact Tags:** 2 endpoints
- ✅ **Sites:** 5+ endpoints
- ✅ **Webhooks:** 4 endpoints (list, create, details, delete)
- ✅ Y más...

---

## 🎯 Respuesta a tus Preguntas Específicas

### **¿Solo hay 6 webhooks?**
**Sí**, Kajabi solo ofrece 6 tipos de webhooks. **PERO** puedes obtener toda la información adicional usando la API directamente.

### **¿Cómo saber si alguien deja una suscripción?**
**Solución:**
1. **Webhook `purchase`** - Detecta nuevas compras
2. **Polling de Purchases** - Filtrar por `deactivated_at NOT NULL`
3. **Campo `deactivation_reason`** - Indica si fue cancelada, pausada, etc.

### **¿Cómo obtener cantidad de ofertas y cursos?**
**Solución:**
- **Endpoint:** `GET /v1/offers?filter[site_id]=123` → Contar resultados
- **Endpoint:** `GET /v1/courses?filter[site_id]=123` → Contar resultados
- **Guardar en BD:** Sincronizar periódicamente y contar

### **¿Cómo tener TODA la información?**
**Solución:**
1. ✅ **Webhooks** (ya implementado) - Para eventos en tiempo real
2. ⏳ **Base de datos expandida** - Para almacenar todo
3. ⏳ **Servicios de sincronización** - Para obtener datos periódicamente
4. ⏳ **Polling inteligente** - Para detectar cambios

---

## 🚀 Próximos Pasos

1. **Expandir base de datos** con todas las tablas necesarias
2. **Crear servicios** para sincronizar cada tipo de dato
3. **Crear endpoints** para sincronización manual/automática
4. **Configurar polling** para sincronización periódica
5. **Mejorar webhooks** para guardar en todas las tablas

---

**¿Quieres que implemente todo esto ahora?** 🚀






