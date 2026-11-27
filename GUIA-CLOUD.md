# Guía rápida para publicar la maqueta (paso a paso)

Esta guía es para hacerlo **sin saber de servidores**. Solo copiar y pegar.

Ya creaste el proyecto en Neon llamado `Plan_Proyectos`. Faltan tres cosas:

1. Copiar un enlace desde Neon.
2. Ejecutar un script en tu PC (crea las tablas y mete datos de ejemplo).
3. Importar el repositorio en Vercel y pegar unas variables.

---

## PASO 1 — Copiar el enlace de Neon

1. Entra a **https://console.neon.tech** y abre tu proyecto **Plan_Proyectos**.
2. En el menú de la izquierda haz clic en **Connect** (a veces dice *Connection Details* o *Connect to your database*).
3. En la ventana que aparece deja:
   - **Database:** `neondb` (la que viene por defecto).
   - **Role:** `neon_owner` (la que viene por defecto).
   - Marca la casilla **Pooled connection**.
4. Copia el texto completo que empieza con `postgresql://...`.
   - **Importante:** en la parte del medio debe aparecer la palabra `pooler`. Si no aparece, vuelve a marcar *Pooled connection* y copia de nuevo.
5. No lo pegues en el chat. Guárdalo en el portapapeles para el paso siguiente.

Ejemplo de cómo se ve (inventado):

```
postgresql://neon_owner:abc123@ep-cool-name-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
```

---

## PASO 2 — Preparar la base de datos desde tu PC

1. Abre PowerShell: presiona **Windows + R**, escribe `powershell` y da Enter.
2. Pega estas dos líneas, una debajo de la otra:

```powershell
cd C:\Opencode_Prueba\Plan_Proyectos\operaciones-planner
powershell -ExecutionPolicy Bypass -File .\scripts\setup-cloud.ps1
```

3. El script hará dos preguntas:

| Pregunta | Qué responder |
|---|---|
| `Connection string de Neon (postgresql://...)` | Pega aquí lo que copiaste en el Paso 1 y da Enter |
| `Contraseña del usuario demo admin` | Da Enter directamente (usa `admin123`) |

4. Espera hasta que aparezca **✅ Base de datos cloud lista.**
5. **Copia en un bloc de notas** el bloque de variables que imprime el script. Sobre todo la línea `BETTER_AUTH_SECRET` (una cadena larga de 64 caracteres), porque Vercel la necesita.

> Este script **no borra nada de tu PC**: solo crea tablas en tu base de Neon y carga datos ficticios de demostración.

### Si sale un error en el paso 2

- **`pnpm no se reconoce`**: ejecuta `npm install -g pnpm@12` y vuelve a intentar.
- **`La connection string debe empezar con postgresql://`**: copiaste otra cosa; vuelve al Paso 1.
- **Error de conexión / SSL**: asegúrate de usar la conexión **pooled** (con `pooler` en el host).

---

## PASO 3 — Publicar en Vercel

1. Entra a **https://vercel.com/new** e inicia sesión con tu cuenta de GitHub.
2. Si es la primera vez, autoriza a Vercel para ver tu cuenta `estebancaneteb-9760`.
3. Haz clic en **Add New... → Project**.
4. Busca `operaciones-planner` y haz clic en **Import**.
5. **No cambies el Root Directory** (debe quedar `./`). El Framework puede quedar en *Other*.
6. En el mismo formulario verás el campo **Project Name** y, justo debajo, una URL sugerida tipo `https://operaciones-planner-demo.vercel.app`. **Copia esa URL**.
7. Antes de dar Deploy, abre **Environment Variables** y agrega estas 7 variables (clic en *Add* para cada una):

| Name | Value |
|---|---|
| `DATABASE_URL` | La connection string del Paso 1 |
| `BETTER_AUTH_SECRET` | La cadena de 64 caracteres que imprimió el script |
| `BETTER_AUTH_URL` | La URL de tu proyecto en Vercel |
| `CORS_ORIGIN` | La misma URL de Vercel |
| `TRUSTED_ORIGINS` | La misma URL de Vercel |
| `FRONTEND_URL` | La misma URL de Vercel |
| `NODE_ENV` | `production` |

8. Haz clic en **Deploy** y espera 1 a 3 minutos.
9. Abre la URL de Vercel. Debería aparecer la pantalla de login.

---

## PASO 4 — Entrar a la maqueta

- **Email:** `admin@operaciones.local`
- **Contraseña:** `admin123` (o la que escribiste en el Paso 2)

Verás proyectos, personas y asignaciones **de ejemplo** (todos inventados, con la palabra “Demo”).

---

## Si algo no funciona

| Síntoma | Solución |
|---|---|
| Página en blanco o error 404 | Revisa que las 7 variables estén en Vercel y haz **Deployments → ... → Redeploy** |
| No entra con el usuario | Revisa `BETTER_AUTH_URL` (debe ser exactamente tu URL de Vercel) y `BETTER_AUTH_SECRET` |
| Error 500 al cargar datos | Revisa `DATABASE_URL` (debe ser la pooled) y que el Paso 2 terminó con ✅ |
| No aparece el repo en Vercel | En Vercel → *Account Settings → GitHub*, autoriza la cuenta `estebancaneteb-9760` |
| Quieres cambiar la contraseña demo | Vuelve a ejecutar el script del Paso 2 con otra contraseña |

---

**Nota:** esta es una maqueta pública. No subas datos reales de clientes ni contraseñas corporativas. La integración con SharePoint/Outlook y Zoho queda desactivada aquí y sigue funcionando solo en el servidor interno.
