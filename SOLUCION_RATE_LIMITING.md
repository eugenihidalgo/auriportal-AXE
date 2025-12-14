# 🔧 Solución a Rate Limiting (429) de Kajabi

## 🐛 Problema Detectado

Los logs muestran:
- **Error 429 (Too Many Requests)**: La API de Kajabi está bloqueando peticiones por exceso de velocidad
- **"Curso 'Mundo de Luz' no encontrado"**: Aparece múltiples veces

## ✅ Soluciones Implementadas

### 1. **Retry con Backoff Exponencial para Access Token**
- Si recibe 429, espera 1s, 2s, 4s antes de reintentar
- Hasta 3 intentos automáticos

### 2. **Delay Aumentado entre Sincronizaciones**
- **Antes:** 150ms entre cada contacto
- **Ahora:** 500ms entre cada contacto
- Reduce significativamente el riesgo de rate limiting

### 3. **Manejo Inteligente de Rate Limits**
- Si detecta error 429 durante sincronización, aumenta el delay automáticamente
- Omite búsqueda de curso si hay rate limit (no es crítico)

### 4. **Mejora en Búsqueda de Curso**
- Mejor logging para ver qué cursos están disponibles
- Manejo de errores más robusto
- No falla si no encuentra el curso (solo muestra warning)

## 📊 Estado Actual

- ✅ **198 contactos encontrados** en Kajabi
- ✅ **Sincronización funcionando** (muchos contactos sincronizados exitosamente)
- ⚠️ **Rate limiting** ocurre cuando se hacen muchas peticiones seguidas
- ⚠️ **Búsqueda de curso** puede fallar pero no es crítico

## 🔄 Próximos Pasos

1. **Probar sincronización nuevamente** - El delay aumentado debería reducir los errores 429
2. **Monitorear logs** para ver si los errores 429 disminuyen
3. **Si persisten los errores**, considerar:
   - Aumentar delay a 1000ms (1 segundo)
   - Procesar en lotes más pequeños
   - Añadir pausas más largas cada N contactos

## 📝 Configuración Actual

```javascript
delay: 500ms  // Entre cada sincronización de contacto
retries: 3    // Reintentos para access token
backoff: exponencial (1s, 2s, 4s)
```

## 🧪 Verificar Mejoras

```bash
# Ver logs en tiempo real
pm2 logs aurelinportal --lines 50

# Buscar errores 429
pm2 logs aurelinportal | grep "429"

# Ver sincronizaciones exitosas
pm2 logs aurelinportal | grep "✅ Contacto sincronizado"
```

---

*Solución implementada: $(date)*









