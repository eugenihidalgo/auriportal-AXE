// src/modules/logs-v4.js
// Registro básico de accesos del alumno AuriPortal v4
// PostgreSQL como fuente de verdad

/**
 * Registra acceso del alumno (versión simplificada para v4)
 * En v4, los accesos se pueden registrar en una tabla de logs si es necesario
 * Por ahora, solo registramos en consola
 */
export async function recordAccessLog(student, env) {
  if (!student || !student.email) return;

  const now = new Date().toISOString();
  const email = student.email;

  try {
    // En v4, podemos registrar en una tabla de logs si es necesario
    // Por ahora, solo log en consola
    console.log(`📅 Acceso al portal: ${email} - ${now}`);
    
    // TODO: Si se necesita persistir, crear tabla `accesos` en PostgreSQL
    // await query('INSERT INTO accesos (alumno_id, fecha_acceso) VALUES ($1, $2)', [student.id, now]);
  } catch (err) {
    console.error("Error al registrar acceso:", err);
  }
}

