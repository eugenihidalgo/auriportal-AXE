#!/usr/bin/env node
// Script para probar la conexión SSH con el servidor dani

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function testSSHConnection() {
  console.log('🔍 Probando conexión SSH con servidor dani...\n');
  
  const config = {
    host: 'DESKTOP-ON51NHF',
    port: '22',
    user: 'usuari',
    keyPath: '/root/.ssh/id_rsa_eugeni'
  };
  
  // Test 1: Verificar que la clave existe
  console.log('1️⃣ Verificando clave SSH...');
  try {
    const { stdout } = await execAsync(`ls -la ${config.keyPath}`);
    console.log('   ✅ Clave encontrada');
    console.log(`   ${stdout.trim()}`);
  } catch (error) {
    console.log('   ❌ Clave NO encontrada:', error.message);
    return;
  }
  
  // Test 2: Extraer clave pública
  console.log('\n2️⃣ Extrayendo clave pública...');
  try {
    const { stdout } = await execAsync(`ssh-keygen -y -f ${config.keyPath}`);
    console.log('   ✅ Clave pública extraída:');
    console.log(`   ${stdout.trim().substring(0, 100)}...`);
  } catch (error) {
    console.log('   ❌ Error extrayendo clave pública:', error.message);
    return;
  }
  
  // Test 3: Probar conexión básica
  console.log('\n3️⃣ Probando conexión SSH básica...');
  const sshCmd = `ssh -i ${config.keyPath} -o StrictHostKeyChecking=no -o ConnectTimeout=10 -o IdentitiesOnly=yes -o PreferredAuthentications=publickey ${config.user}@${config.host} "echo 'OK'"`;
  
  try {
    const { stdout, stderr } = await execAsync(sshCmd, { timeout: 15000 });
    console.log('   ✅ Conexión exitosa!');
    console.log(`   Salida: ${stdout.trim()}`);
    if (stderr) {
      console.log(`   Warnings: ${stderr.trim()}`);
    }
  } catch (error) {
    console.log('   ❌ Conexión falló');
    console.log(`   Error: ${error.message}`);
    if (error.stderr) {
      console.log(`   stderr: ${error.stderr.substring(0, 500)}`);
    }
  }
  
  // Test 4: Probar comando más complejo
  console.log('\n4️⃣ Probando comando remoto (hostname)...');
  const sshCmd2 = `ssh -i ${config.keyPath} -o StrictHostKeyChecking=no -o ConnectTimeout=10 -o IdentitiesOnly=yes -o PreferredAuthentications=publickey ${config.user}@${config.host} "hostname && whoami"`;
  
  try {
    const { stdout, stderr } = await execAsync(sshCmd2, { timeout: 15000 });
    console.log('   ✅ Comando ejecutado exitosamente!');
    console.log(`   Salida: ${stdout.trim()}`);
    if (stderr) {
      console.log(`   Warnings: ${stderr.trim()}`);
    }
  } catch (error) {
    console.log('   ❌ Comando falló');
    console.log(`   Error: ${error.message}`);
    if (error.stderr) {
      console.log(`   stderr: ${error.stderr.substring(0, 500)}`);
    }
  }
  
  console.log('\n✅ Pruebas completadas');
}

testSSHConnection().catch(console.error);

