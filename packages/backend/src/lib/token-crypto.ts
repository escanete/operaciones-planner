import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from './env.js';

/* ============================================================
   Cifrado de tokens sensibles en reposo

   El refresh token de Microsoft permite actuar en nombre del
   usuario, así que no se guarda en texto plano en la base de
   datos. Se cifra con AES-256-GCM usando una clave derivada de
   BETTER_AUTH_SECRET (que ya es un secreto del servidor).
   ============================================================ */

const VERSION = 'v1';
const ALGORITMO = 'aes-256-gcm';

function clave(): Buffer {
  return createHash('sha256').update(env.BETTER_AUTH_SECRET).digest();
}

export function cifrarToken(texto: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITMO, clave(), iv);
  const cifrado = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), cifrado.toString('base64url')].join('.');
}

export function descifrarToken(valor: string): string {
  const [version, ivB64, tagB64, datosB64] = valor.split('.');
  if (version !== VERSION || !ivB64 || !tagB64 || !datosB64) {
    throw new Error('Token cifrado con formato desconocido');
  }

  const decipher = createDecipheriv(ALGORITMO, clave(), Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  const plano = Buffer.concat([
    decipher.update(Buffer.from(datosB64, 'base64url')),
    decipher.final(),
  ]);
  return plano.toString('utf8');
}
