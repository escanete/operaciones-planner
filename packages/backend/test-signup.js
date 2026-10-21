// Crear usuario admin via endpoint de Better-Auth (el correcto)
const res = await fetch('http://localhost:3001/api/auth/sign-up/email', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Origin': 'http://localhost:5173',
  },
  body: JSON.stringify({
    email: 'admin@operaciones.local',
    password: 'admin123',
    name: 'Administrador',
    apellido: 'Sistema',
  }),
});

console.log('Status:', res.status);
const text = await res.text();
console.log('Body:', text);

// Si ya existe, probar login
if (res.status === 422 || text.includes('exists')) {
  console.log('\nUsuario ya existe, probando login...');
  const loginRes = await fetch('http://localhost:3001/api/auth/sign-in/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:5173',
    },
    body: JSON.stringify({
      email: 'admin@operaciones.local',
      password: 'admin123',
    }),
  });
  console.log('Login Status:', loginRes.status);
  console.log('Login Body:', await loginRes.text());
}
