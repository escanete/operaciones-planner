// Verificar por qué el login falla
import { prisma } from './src/lib/db.js';
import { hashPassword, verifyPassword } from 'better-auth/crypto';

const account = await prisma.account.findFirst({
  where: { accountId: 'admin-local' },
});

console.log('Hash en DB:', account?.password);

const isValid = await verifyPassword('admin123', account?.password ?? '');
console.log('Verificación directa:', isValid);

// Probar regenerar y verificar
const newHash = await hashPassword('admin123');
console.log('\nNuevo hash generado:', newHash);
const isValidNew = await verifyPassword('admin123', newHash);
console.log('Verificación nuevo hash:', isValidNew);

await prisma.$disconnect();
