// scripts/enviar-email-prova.js
// Script per enviar email de prova via Gmail API

import dotenv from 'dotenv';
import { enviarEmailGmail } from '../src/services/google-workspace.js';

dotenv.config();

async function enviarEmailProva() {
  try {
    // Verificar configuració
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY ha d\'estar configurat');
    }
    
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_IMPERSONATE) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_IMPERSONATE ha d\'estar configurat');
    }

    const env = {
      GOOGLE_SERVICE_ACCOUNT_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      GOOGLE_SERVICE_ACCOUNT_IMPERSONATE: process.env.GOOGLE_SERVICE_ACCOUNT_IMPERSONATE
    };

    const destinatario = 'eugeni@eugenihidalgo.work';
    const asunto = 'Missatge Important';
    const texto = 'Ets gay';
    const html = '<p style="font-size: 24px; color: #ff0000; font-weight: bold;">Ets gay</p>';

    console.log(`📧 Enviant email de prova a ${destinatario}...`);
    console.log(`   Des de: ${process.env.GOOGLE_SERVICE_ACCOUNT_IMPERSONATE}`);
    
    const resultado = await enviarEmailGmail(
      env,
      destinatario,
      asunto,
      texto,
      html,
      process.env.GOOGLE_SERVICE_ACCOUNT_IMPERSONATE
    );

    console.log(`✅ Email enviat exitosament!`);
    console.log(`📬 Message ID: ${resultado.messageId}`);
    
    return resultado;

  } catch (error) {
    console.error('❌ Error enviant email:', error.message);
    if (error.response) {
      console.error('Detalls:', error.response.data);
    }
    process.exit(1);
  }
}

enviarEmailProva();



