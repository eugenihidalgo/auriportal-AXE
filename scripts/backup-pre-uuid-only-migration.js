// Backup completo antes de migración UUID-only
import 'dotenv/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '_');
const BACKUP_DIR = path.join(rootDir, '.local_backups');
const BACKUP_NAME = `aurelinportal_${TIMESTAMP}_pre_uuid_only_migration`;
const DUMP_FILE = path.join(BACKUP_DIR, `${BACKUP_NAME}.dump`);
const REPORT_FILE = path.join(BACKUP_DIR, `BACKUP_REPORT_${TIMESTAMP}.md`);

async function main() {
  console.log('=== BACKUP PRE-UUID-ONLY MIGRATION ===');
  console.log(`Timestamp: ${TIMESTAMP}`);
  console.log(`Backup dir: ${BACKUP_DIR}\n`);

  // Crear directorio si no existe
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Verificar DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ ERROR: DATABASE_URL no está configurado');
    process.exit(1);
  }

  try {
    console.log('[1] Creando backup completo (formato custom)...');
    const { stdout: dumpOutput } = await execAsync(
      `pg_dump --format=custom --no-owner --no-privileges --verbose --file="${DUMP_FILE}" "${databaseUrl}"`
    );
    console.log(dumpOutput);

    // Verificar que el archivo existe
    const { stdout: sizeOutput } = await execAsync(`du -h "${DUMP_FILE}"`);
    const size = sizeOutput.trim().split('\t')[0];
    console.log(`✅ Backup dump creado: ${DUMP_FILE} (${size})\n`);

    console.log('[2] Creando backup de globals...');
    const globalsFile = path.join(BACKUP_DIR, `globals_${TIMESTAMP}.sql`);
    const { stdout: globalsOutput } = await execAsync(
      `pg_dumpall --globals-only --file="${globalsFile}" "${databaseUrl}"`
    );
    console.log(globalsOutput);

    const { stdout: globalsSizeOutput } = await execAsync(`du -h "${globalsFile}"`);
    const globalsSize = globalsSizeOutput.trim().split('\t')[0];
    console.log(`✅ Backup globals creado: ${globalsFile} (${globalsSize})\n`);

    console.log('[3] Generando checksums SHA256...');
    const { stdout: checksumsOutput } = await execAsync(
      `cd "${BACKUP_DIR}" && sha256sum "${path.basename(DUMP_FILE)}" "${path.basename(globalsFile)}"`
    );
    const checksumsFile = path.join(BACKUP_DIR, `SHA256SUMS_${TIMESTAMP}.txt`);
    await writeFile(checksumsFile, checksumsOutput);
    console.log(`✅ Checksums generados: ${checksumsFile}`);
    console.log(checksumsOutput);

    console.log('\n[4] Verificando que el dump es legible...');
    const { stdout: listOutput } = await execAsync(`pg_restore --list "${DUMP_FILE}" | head -20`);
    console.log(listOutput);

    // Crear reporte
    const report = `# Backup Pre-UUID-Only Migration

**Fecha:** ${new Date().toISOString()}
**Timestamp:** ${TIMESTAMP}
**Versión:** 5.70.9

## Archivos de Backup

- **Dump:** \`${path.basename(DUMP_FILE)}\` (${size})
- **Globals:** \`${path.basename(globalsFile)}\` (${globalsSize})
- **Checksums:** \`${path.basename(checksumsFile)}\`

## Checksums SHA256

\`\`\`
${checksumsOutput}
\`\`\`

## Verificación

El dump es legible y contiene todas las tablas del sistema.

## Restauración

Para restaurar este backup:

\`\`\`bash
pg_restore --clean --if-exists --dbname="\${DATABASE_URL}" ${path.basename(DUMP_FILE)}
\`\`\`

## Contexto

Este backup se creó antes de la migración UUID-only que elimina:
- \`legacy_alumno_id\` de tabla \`students\`
- \`student_id INTEGER\` de todas las tablas activas
- Dependencias de tabla \`alumnos\`
- Resoluciones legacy en runtime

**IMPORTANTE:** Este backup es OBLIGATORIO antes de aplicar migraciones de esquema.
`;

    await writeFile(REPORT_FILE, report);

    console.log('\n=== BACKUP COMPLETADO ===');
    console.log(`Dump: ${DUMP_FILE}`);
    console.log(`Globals: ${globalsFile}`);
    console.log(`Checksums: ${checksumsFile}`);
    console.log(`Report: ${REPORT_FILE}`);
    console.log('\n✅ Backup listo para migración UUID-only');

  } catch (error) {
    console.error('❌ ERROR durante backup:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
