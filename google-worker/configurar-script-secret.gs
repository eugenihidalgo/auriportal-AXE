/**
 * SCRIPT TEMPORAL PARA CONFIGURAR SCRIPT_SECRET
 * 
 * INSTRUCCIONES:
 * 1. Copia este código en Google Apps Script (créalo como nuevo archivo temporal)
 * 2. Reemplaza 'TU_SECRET_AQUI' con tu secret (genera uno con: openssl rand -hex 32)
 * 3. Ejecuta la función configurarScriptSecret (menú "Ejecutar" → "configurarScriptSecret")
 * 4. Verifica que aparezca "SCRIPT_SECRET configurado correctamente" en los logs
 * 5. ELIMINA este archivo después de configurarlo
 */

function configurarScriptSecret() {
  const scriptProperties = PropertiesService.getScriptProperties();
  
  // REEMPLAZA 'TU_SECRET_AQUI' con tu secret real
  // Genera uno seguro con: openssl rand -hex 32
  const SECRET = 'TU_SECRET_AQUI';
  
  scriptProperties.setProperty('SCRIPT_SECRET', SECRET);
  
  Logger.log('✅ SCRIPT_SECRET configurado correctamente');
  Logger.log('Secret configurado (primeros 10 caracteres): ' + SECRET.substring(0, 10) + '...');
  
  // Verificar que se guardó correctamente
  const verificar = scriptProperties.getProperty('SCRIPT_SECRET');
  if (verificar) {
    Logger.log('✅ Verificación: SCRIPT_SECRET guardado correctamente');
  } else {
    Logger.log('❌ Error: No se pudo guardar SCRIPT_SECRET');
  }
}

/**
 * Función para verificar que el secret está configurado
 * (No modifica nada, solo lee)
 */
function verificarScriptSecret() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const secret = scriptProperties.getProperty('SCRIPT_SECRET');
  
  if (secret) {
    Logger.log('✅ SCRIPT_SECRET está configurado');
    Logger.log('Primeros 10 caracteres: ' + secret.substring(0, 10) + '...');
  } else {
    Logger.log('❌ SCRIPT_SECRET NO está configurado');
    Logger.log('Ejecuta configurarScriptSecret() primero');
  }
}


















