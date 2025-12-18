// src/core/cookies.js
// Utilidades de cookies para AuriPortal v3.1

// Parsea la cabecera Cookie en un objeto { clave: valor }
export function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;

  const parts = cookieHeader.split(";");

  for (const part of parts) {
    const [key, ...rest] = part.split("=");
    const keyTrimmed = key.trim();
    const valueRaw = rest.join("=").trim();
    
    if (keyTrimmed && valueRaw) {
      try {
        // Intentar decodificar, pero si falla usar el valor original
        out[keyTrimmed] = decodeURIComponent(valueRaw);
      } catch (err) {
        // Si falla la decodificación, usar el valor tal cual
        out[keyTrimmed] = valueRaw;
      }
    }
  }

  return out;
}

// Obtiene la cookie "auri_user" como objeto { email }
export function getCookieData(request) {
  // Protección: validar que request y headers existan
  if (!request || !request.headers) {
    console.warn('⚠️  getCookieData - request o request.headers no disponible');
    return null;
  }

  const cookieHeader = request.headers.get("Cookie");
  console.log(`🔍 getCookieData - Cookie header: ${cookieHeader ? cookieHeader.substring(0, 200) : 'NO HAY COOKIE'}`);
  
  const cookies = parseCookies(cookieHeader);
  console.log(`🔍 getCookieData - Cookies parseadas:`, Object.keys(cookies));

  if (!cookies.auri_user) {
    console.log(`⚠️  getCookieData - No se encontró cookie auri_user`);
    return null;
  }

  try {
    const decoded = JSON.parse(cookies.auri_user);
    console.log(`✅ getCookieData - Cookie decodificada correctamente:`, decoded);
    return decoded;
  } catch (err) {
    console.error(`❌ getCookieData - Error parseando cookie:`, err.message);
    return null;
  }
}

// Crea cookie segura "auri_user" con JSON interno
// @param {Object} data - Datos a guardar en la cookie (ej: { email: "..." })
// @param {Request} request - Request object para detectar HTTPS
// @param {boolean} rememberMe - Si es true, la cookie dura 1 año, si no, dura solo la sesión del navegador (hasta que se cierre)
export function createCookie(data, request = null, rememberMe = true) {
  try {
    // Validar que data existe y tiene email
    if (!data || !data.email) {
      console.warn('⚠️  createCookie - data o data.email no disponible');
      // Retornar cookie vacía pero válida para no romper el flujo
      return 'auri_user=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax';
    }
    
    const json = JSON.stringify(data);
    const encoded = encodeURIComponent(json);

    // Si rememberMe es true: 1 año (31536000 segundos)
    // Si rememberMe es false: cookie de sesión (se elimina al cerrar navegador)
    // Usamos un Max-Age largo para rememberMe=true, y uno corto para rememberMe=false
    const maxAge = rememberMe ? 60 * 60 * 24 * 365 : 60 * 60 * 24; // 1 año o 1 día

    // Detectar si es HTTPS (para usar flag Secure solo en HTTPS)
    let isSecure = false;
    if (request && request.url && request.headers) {
      try {
        const url = new URL(request.url);
        isSecure = url.protocol === 'https:' || 
                   request.headers.get('x-forwarded-proto') === 'https' ||
                   request.headers.get('x-forwarded-ssl') === 'on';
      } catch (error) {
        // Si falla al parsear URL, asumir HTTP por seguridad
        console.warn('⚠️  createCookie - Error parseando URL, asumiendo HTTP:', error.message);
        isSecure = false;
      }
    }

    // Solo usar Secure si es HTTPS, de lo contrario la cookie no se guardará en HTTP
    const secureFlag = isSecure ? 'Secure' : '';
    
    // Construir partes de la cookie
    // IMPORTANTE: Siempre establecer Max-Age para compatibilidad con todos los navegadores
    // Formato: name=value; Path=/; Max-Age=seconds; HttpOnly; Secure; SameSite=Lax
    const parts = [];
    
    // Nombre y valor (siempre primero)
    parts.push(`auri_user=${encoded}`);
    parts.push('Path=/');
    parts.push(`Max-Age=${maxAge}`);
    parts.push('HttpOnly');
    
    // Secure solo si es HTTPS
    if (secureFlag) {
      parts.push(secureFlag);
    }
    
    // SameSite=Lax para compatibilidad
    parts.push('SameSite=Lax');
    
    const cookieString = parts.join('; ');
    console.log(`🍪 Cookie generada (rememberMe: ${rememberMe}, maxAge: ${maxAge}s = ${Math.round(maxAge / 86400)} días):`);
    console.log(`   ${cookieString.substring(0, 150)}${cookieString.length > 150 ? '...' : ''}`);
    return cookieString;
  } catch (error) {
    // CRÍTICO: createCookie NUNCA debe lanzar excepción
    console.error('❌ createCookie - Error creando cookie:', error.message);
    console.error('❌ createCookie - Stack:', error.stack);
    // Retornar cookie vacía pero válida para no romper el flujo
    return 'auri_user=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax';
  }
}

// Borra cookie
export function clearCookie(request = null) {
  // Detectar si es HTTPS
  let isSecure = false;
  if (request && request.url && request.headers) {
    try {
      const url = new URL(request.url);
      isSecure = url.protocol === 'https:' || 
                 request.headers.get('x-forwarded-proto') === 'https' ||
                 request.headers.get('x-forwarded-ssl') === 'on';
    } catch (error) {
      // Si falla al parsear URL, asumir HTTP por seguridad
      console.warn('⚠️  clearCookie - Error parseando URL, asumiendo HTTP:', error.message);
      isSecure = false;
    }
  }
  
  const secureFlag = isSecure ? 'Secure' : '';
  return `auri_user=; Path=/; Max-Age=0; HttpOnly; ${secureFlag}; SameSite=Lax`.replace(/\s+/g, ' ').trim();
}
