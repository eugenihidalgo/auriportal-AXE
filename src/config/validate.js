// src/config/validate.js
// Módulo de validación de configuración de tokens y APIs

/**
 * Valida que todas las variables de entorno requeridas estén configuradas
 */
export function validateEnvironmentVariables(env) {
  const errors = [];
  const warnings = [];
  const config = {
    clickup: { configured: false, token: null },
    kajabi: { configured: false, clientId: null, clientSecret: null },
    typeform: { configured: false, token: null },
    cloudflare: { configured: false },
    zoom: { configured: false },
    google: { configured: false, method: null },
    cookie: { configured: false }
  };

  // ClickUp
  if (!env.CLICKUP_API_TOKEN || env.CLICKUP_API_TOKEN.trim() === '') {
    errors.push('CLICKUP_API_TOKEN no está configurado');
  } else if (!env.CLICKUP_API_TOKEN.startsWith('pk_')) {
    warnings.push('CLICKUP_API_TOKEN no parece tener el formato correcto (debería empezar con pk_)');
    config.clickup.configured = true;
    config.clickup.token = '***' + env.CLICKUP_API_TOKEN.slice(-4);
  } else {
    config.clickup.configured = true;
    config.clickup.token = 'pk_***' + env.CLICKUP_API_TOKEN.slice(-4);
  }

  // Kajabi - Desactivado (mantener variables de entorno por compatibilidad)
  // Las variables KAJABI_CLIENT_ID y KAJABI_CLIENT_SECRET se mantienen en .env pero no se usan
  if (env.KAJABI_CLIENT_ID) {
    config.kajabi.clientId = env.KAJABI_CLIENT_ID.substring(0, 8) + '*** (desactivado)';
  }
  if (env.KAJABI_CLIENT_SECRET) {
    config.kajabi.clientSecret = '*** (desactivado)';
  }
  // No marcar como configurado ya que no se usa

  // Typeform (opcional pero recomendado)
  if (!env.TYPEFORM_API_TOKEN || env.TYPEFORM_API_TOKEN.trim() === '') {
    warnings.push('TYPEFORM_API_TOKEN no está configurado (opcional pero recomendado para webhooks)');
  } else {
    config.typeform.configured = true;
    config.typeform.token = '***' + env.TYPEFORM_API_TOKEN.slice(-4);
  }

  // Cloudflare (opcional - para DNS/CDN)
  if (env.CLOUDFLARE_API_TOKEN || env.CLOUDFLARE_EMAIL || env.CLOUDFLARE_API_KEY) {
    config.cloudflare.configured = true;
    if (env.CLOUDFLARE_API_TOKEN) {
      config.cloudflare.hasToken = true;
    }
    if (env.CLOUDFLARE_EMAIL && env.CLOUDFLARE_API_KEY) {
      config.cloudflare.hasEmailKey = true;
    }
  } else {
    warnings.push('Cloudflare no está configurado (opcional para DNS/CDN)');
  }

  // Zoom Workplace (opcional)
  if (env.ZOOM_ACCOUNT_ID && env.ZOOM_CLIENT_ID && env.ZOOM_CLIENT_SECRET) {
    config.zoom.configured = true;
    config.zoom.accountId = env.ZOOM_ACCOUNT_ID.substring(0, 8) + '***';
    config.zoom.clientId = env.ZOOM_CLIENT_ID.substring(0, 8) + '***';
  } else {
    if (env.ZOOM_ACCOUNT_ID || env.ZOOM_CLIENT_ID || env.ZOOM_CLIENT_SECRET) {
      warnings.push('Zoom no está completamente configurado (requiere ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID y ZOOM_CLIENT_SECRET)');
    } else {
      warnings.push('Zoom no está configurado (opcional para gestión de reuniones/webinars)');
    }
  }

  // Google Workspace (opcional pero recomendado)
  if (env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      const key = typeof env.GOOGLE_SERVICE_ACCOUNT_KEY === 'string' 
        ? JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY)
        : env.GOOGLE_SERVICE_ACCOUNT_KEY;
      if (key.client_email && key.private_key) {
        config.google.configured = true;
        config.google.method = 'service_account';
        config.google.email = key.client_email.substring(0, 20) + '***';
      }
    } catch (err) {
      warnings.push('GOOGLE_SERVICE_ACCOUNT_KEY no es un JSON válido');
    }
  } else if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    config.google.configured = true;
    config.google.method = 'oauth2';
    config.google.clientId = env.GOOGLE_CLIENT_ID.substring(0, 8) + '***';
    if (env.GOOGLE_REFRESH_TOKEN) {
      config.google.hasRefreshToken = true;
    } else {
      warnings.push('GOOGLE_REFRESH_TOKEN no está configurado (necesario para OAuth2)');
    }
  } else {
    warnings.push('Google Workspace no está configurado (opcional pero recomendado)');
  }

  // Cookie Secret
  if (!env.COOKIE_SECRET || env.COOKIE_SECRET.trim() === '' || env.COOKIE_SECRET === 'default-secret-change-in-production') {
    warnings.push('COOKIE_SECRET no está configurado o usa el valor por defecto (debería cambiarse en producción)');
  } else {
    config.cookie.configured = true;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    config
  };
}

/**
 * Verifica la conectividad con las APIs
 */
export async function testAPIConnections(env) {
  const results = {
    clickup: { status: 'unknown', message: '', error: null },
    kajabi: { status: 'unknown', message: '', error: null },
    typeform: { status: 'unknown', message: '', error: null },
    cloudflare: { status: 'unknown', message: '', error: null },
    zoom: { status: 'unknown', message: '', error: null },
    google: { status: 'unknown', message: '', error: null }
  };

  // Test ClickUp
  if (env.CLICKUP_API_TOKEN) {
    try {
      const res = await fetch('https://api.clickup.com/api/v2/user', {
        headers: { Authorization: env.CLICKUP_API_TOKEN }
      });
      
      if (res.ok) {
        const data = await res.json();
        results.clickup.status = 'ok';
        results.clickup.message = `Conectado como: ${data.user?.username || 'Usuario'}`;
      } else {
        results.clickup.status = 'error';
        results.clickup.message = `Error ${res.status}: ${res.statusText}`;
        const errorText = await res.text();
        results.clickup.error = errorText.substring(0, 200);
      }
    } catch (err) {
      results.clickup.status = 'error';
      results.clickup.message = 'Error de conexión';
      results.clickup.error = err.message;
    }
  } else {
    results.clickup.status = 'not_configured';
    results.clickup.message = 'Token no configurado';
  }

  // Test Kajabi
  if (env.KAJABI_CLIENT_ID && env.KAJABI_CLIENT_SECRET) {
    try {
      const formData = new URLSearchParams();
      formData.append("grant_type", "client_credentials");
      formData.append("client_id", env.KAJABI_CLIENT_ID);
      formData.append("client_secret", env.KAJABI_CLIENT_SECRET);

      const res = await fetch("https://api.kajabi.com/v1/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        results.kajabi.status = 'ok';
        results.kajabi.message = 'Autenticación OAuth exitosa';
      } else {
        results.kajabi.status = 'error';
        results.kajabi.message = `Error ${res.status}: ${res.statusText}`;
        const errorText = await res.text();
        results.kajabi.error = errorText.substring(0, 200);
      }
    } catch (err) {
      results.kajabi.status = 'error';
      results.kajabi.message = 'Error de conexión';
      results.kajabi.error = err.message;
    }
  } else {
    results.kajabi.status = 'not_configured';
    results.kajabi.message = 'Credenciales no configuradas';
  }

  // Test Typeform (verificar token si está configurado)
  if (env.TYPEFORM_API_TOKEN) {
    try {
      const res = await fetch('https://api.typeform.com/me', {
        headers: { 
          'Authorization': `Bearer ${env.TYPEFORM_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        results.typeform.status = 'ok';
        results.typeform.message = `Conectado como: ${data.alias || 'Usuario'}`;
      } else {
        results.typeform.status = 'error';
        results.typeform.message = `Error ${res.status}: ${res.statusText}`;
        const errorText = await res.text();
        results.typeform.error = errorText.substring(0, 200);
      }
    } catch (err) {
      results.typeform.status = 'error';
      results.typeform.message = 'Error de conexión';
      results.typeform.error = err.message;
    }
  } else {
    results.typeform.status = 'not_configured';
    results.typeform.message = 'Token no configurado (opcional)';
  }

  // Test Cloudflare (si está configurado)
  if (env.CLOUDFLARE_API_TOKEN || (env.CLOUDFLARE_EMAIL && env.CLOUDFLARE_API_KEY)) {
    try {
      const headers = {};
      if (env.CLOUDFLARE_API_TOKEN) {
        headers['Authorization'] = `Bearer ${env.CLOUDFLARE_API_TOKEN}`;
      } else {
        headers['X-Auth-Email'] = env.CLOUDFLARE_EMAIL;
        headers['X-Auth-Key'] = env.CLOUDFLARE_API_KEY;
      }

      const res = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
        headers
      });
      
      if (res.ok) {
        const data = await res.json();
        results.cloudflare.status = 'ok';
        results.cloudflare.message = `Conectado. Status: ${data.result?.status || 'OK'}`;
      } else {
        results.cloudflare.status = 'error';
        results.cloudflare.message = `Error ${res.status}: ${res.statusText}`;
        const errorText = await res.text();
        results.cloudflare.error = errorText.substring(0, 200);
      }
    } catch (err) {
      results.cloudflare.status = 'error';
      results.cloudflare.message = 'Error de conexión';
      results.cloudflare.error = err.message;
    }
  } else {
    results.cloudflare.status = 'not_configured';
    results.cloudflare.message = 'No configurado (opcional para DNS/CDN)';
  }

  // Test Zoom (si está configurado)
  if (env.ZOOM_ACCOUNT_ID && env.ZOOM_CLIENT_ID && env.ZOOM_CLIENT_SECRET) {
    try {
      const { verificarConexion } = await import('../services/zoom-api.js');
      const resultado = await verificarConexion();
      
      if (resultado.success) {
        results.zoom.status = 'ok';
        results.zoom.message = resultado.message || 'Conexión exitosa con Zoom API';
      } else {
        results.zoom.status = 'error';
        results.zoom.message = resultado.message || 'Error de conexión';
        results.zoom.error = resultado.error;
      }
    } catch (err) {
      results.zoom.status = 'error';
      results.zoom.message = 'Error de conexión';
      results.zoom.error = err.message;
    }
  } else {
    results.zoom.status = 'not_configured';
    results.zoom.message = 'No configurado (opcional para gestión de reuniones/webinars)';
  }

  // Test Google Workspace
  if (env.GOOGLE_SERVICE_ACCOUNT_KEY || (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)) {
    try {
      const { verificarConexionGoogle } = await import('../services/google-workspace.js');
      const resultado = await verificarConexionGoogle(env);
      
      if (resultado.success) {
        results.google.status = 'ok';
        results.google.message = `Conectado como: ${resultado.email || 'Usuario'}`;
      } else {
        results.google.status = 'error';
        results.google.message = resultado.error || 'Error de conexión';
        results.google.error = resultado.error;
      }
    } catch (err) {
      results.google.status = 'error';
      results.google.message = 'Error de conexión';
      results.google.error = err.message;
    }
  } else {
    results.google.status = 'not_configured';
    results.google.message = 'No configurado (opcional pero recomendado)';
  }

  return results;
}







