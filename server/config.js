// Configuración del servidor. Los valores secretos se leen del archivo .env (nunca del frontend).
const path = require('node:path');
const fs = require('node:fs');

const RAIZ = path.resolve(__dirname, '..');
const archivoEnv = path.join(RAIZ, '.env');

// Node.js 20.12+ puede leer archivos .env sin instalar paquetes extra.
if (fs.existsSync(archivoEnv)) {
    process.loadEnvFile(archivoEnv);
}

module.exports = {
    puerto: Number(process.env.PORT) || 3000,
    geminiApiKey: process.env.GEMINI_API_KEY?.trim() || '',
    geminiModelo: process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite',
    carpetaFrontend: path.join(RAIZ, 'Suplemex', 'frontend'),
    archivoCatalogo: path.join(RAIZ, 'Suplemex', 'frontend', 'script.js'),
};
