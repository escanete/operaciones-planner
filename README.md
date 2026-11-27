# 🚀 Planificador de Recursos - Operaciones

Aplicación web para planificación y gestión de recursos del departamento de Operaciones.

---

## ⚡ Inicio Rápido (Doble Clic)

### Opción 1: Script automático (Recomendado)

**Doble clic en:** `start.bat`

El script automáticamente:
1. ✅ Verifica/instala dependencias
2. ✅ Crea la base de datos si no existe
3. ✅ Ingresa datos de ejemplo
4. ✅ Inicia backend (puerto 3001)
5. ✅ Inicia frontend (puerto 5173)
6. ✅ Abre el navegador automáticamente

**Para detener:** Presiona `Ctrl+C` en este terminal y luego escribe `s` o `y`

---

### Opción 2: Manual (2 terminales)

```powershell
# Terminal 1 - Backend
cd C:\Opencode_Prueba\Plan_Proyectos\operaciones-planner
pnpm --filter backend dev

# Terminal 2 - Frontend
cd C:\Opencode_Prueba\Plan_Proyectos\operaciones-planner
pnpm --filter frontend dev
```

---

## 🔐 Credenciales de Prueba

| Campo | Valor |
|-------|-------|
| **Email** | `admin@operaciones.local` |
| **Contraseña** | `admin123` |

---

## 📊 Datos de Ejemplo Precargados

- **Departamento:** Operaciones
- **Equipos:** SCADA, Ingeniería, Mantenimiento
- **Recursos:** 12 personas + 2 camionetas
- **Proyectos:** Proyecto A (activo), Proyecto B (planificación)

---

## 🛠️ Comandos Útiles

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Iniciar todo (si están en terminales separadas) |
| `pnpm db:studio` | Abrir editor visual de base de datos |
| `pnpm db:seed` | Recargar datos de ejemplo |
| `pnpm db:migrate` | Aplicar cambios de schema |
| `pnpm build` | Compilar para producción |

---

## 📁 Estructura del Proyecto

```
operaciones-planner/
├── start.bat              ← Doble clic para iniciar
├── api/                   ← Función serverless (Vercel) que expone la API Hono
├── vercel.json            ← Configuración de build + routing en Vercel
├── packages/
│   ├── backend/           # API REST (Hono + Prisma)
│   ├── frontend/          # React App (Vite + Tailwind)
│   └── shared/            # Tipos TypeScript compartidos
├── data/
│   └── dev.db             # Base de datos SQLite (local)
└── scripts/
    ├── setup-cloud.ps1    ← Migrar/llenar Neon y preparar variables de Vercel
    └── migrate-to-cloud.ps1 (script histórico, NO usar)
```

---

## ☁️ Maqueta en la nube gratis (Vercel + Neon)

La misma aplicación se publica sin servidor propio: Vercel sirve el frontend y la API (Hono), y Neon aporta PostgreSQL en plan gratuito.

### 1. Base de datos Neon

1. Crea un proyecto en <https://neon.tech> (plan Free).
2. Copia la **connection string pooled** (`postgresql://...`) de la sección *Connection Details*.

### 2. Preparar la BD desde tu PC

```powershell
.\scripts\setup-cloud.ps1
```

El script pregunta por la connection string, la URL de Vercel y la contraseña del admin; aplica las migraciones de `prisma/postgres`, carga datos **ficticios** de demostración y restaura el cliente Prisma SQLite local. Imprime el `BETTER_AUTH_SECRET` generado: cópialo.

> Los datos del seed son inventados (cliente, personas y proyectos “Demo”). No se suben datos reales de la empresa.

### 3. Importar el repo en Vercel

1. <https://vercel.com/new> → importa `https://github.com/Kohwal/operaciones-planner`.
2. Vercel detecta `vercel.json`: compila el frontend y genera el cliente Prisma para Postgres automáticamente. No cambies el *Root Directory*.
3. En *Settings → Environment Variables* carga (para Production, Preview y Development):

| Variable | Valor |
|---|---|
| `DATABASE_URL` | Connection string pooled de Neon |
| `BETTER_AUTH_SECRET` | El que imprimió `setup-cloud.ps1` (64 caracteres) |
| `BETTER_AUTH_URL` | `https://<tu-proyecto>.vercel.app` |
| `CORS_ORIGIN` | `https://<tu-proyecto>.vercel.app` |
| `TRUSTED_ORIGINS` | `https://<tu-proyecto>.vercel.app` |
| `FRONTEND_URL` | `https://<tu-proyecto>.vercel.app` |
| `NODE_ENV` | `production` |

4. Deploy. La URL pública será `https://<tu-proyecto>.vercel.app`.

### 4. Probar la maqueta

- Usuario: `admin@operaciones.local`
- Contraseña: la elegida en el script (por defecto `admin123`)

Si cambias las variables después del primer deploy, haz **Redeploy**. Para volver a cargar datos demo ejecuta otra vez `setup-cloud.ps1` (es idempotente).

> La integración con SharePoint/Outlook y Zoho no se configura en la maqueta: esas funciones requieren credenciales corporativas y solo se usan en el servidor interno. El resto (login, grid, Gantt, WBS, CRUD y reportes) funciona igual que en local.

---

### Funcionalidades actuales

| Vista / acción | Estado |
|---|---|
| Login con roles | ✅ |
| Grid Gantt semanal/quincenal/mensual/trimestral/anual | ✅ |
| Navegación pasado/futuro + botón "Hoy" | ✅ |
| Filtros: departamento, equipo, proyecto, tipo, búsqueda | ✅ |
| Clic en celda vacía → crear asignación rápida | ✅ |
| Clic en asignación → panel lateral con detalle | ✅ |
| Crear/editar/eliminar asignaciones con validación de conflictos | ✅ |
| Admin: recursos, proyectos, clientes, catálogos, usuarios | ✅ |
| Asistente Claude Desktop (MCP local, lectura y escritura) | ✅ |
| Auditoría de cambios | ✅ |
| Drag & drop reordenar asignaciones | 🔜 próximamente |
| Exportar a Excel/PDF | 🔜 próximamente |
| Vista disponibilidad (heatmap) | 🔜 próximamente |

---

## 🤖 Claude Desktop (MCP local)

Cada persona puede usar **su propia cuenta de Claude Desktop** para consultar y
cargar datos en la plataforma (proyectos, actividades, tareas, subtareas,
asignaciones, materiales y Excel) sin compartir contraseñas: el asistente corre
en su PC y usa su propia sesión de Operaciones Planner.

1. Instala **Node.js 20 o superior** y abre Claude Desktop una vez.
2. Descarga el instalador desde el servidor de la empresa y ejecútalo:

   ```powershell
   Invoke-WebRequest http://192.168.25.7:3001/api/mcp/install.ps1 -OutFile install.ps1
   powershell -ExecutionPolicy Bypass -File install.ps1
   ```

3. Escribe tu email y contraseña de la plataforma cuando se pidan.
4. Reinicia Claude Desktop y pide, por ejemplo: «lista mis proyectos activos».

El instalador descarga el servidor desde el propio backend
(`http://192.168.25.7:3001/api/mcp/operaciones-planner-mcp.js`), así que **no
necesita GitHub**; solo acceso de red al servidor de la empresa.

Documentación completa (herramientas, seguridad y problemas frecuentes):
[`packages/mcp-server/README.md`](packages/mcp-server/README.md).

Al desplegar una versión nueva del MCP, se publica sola al reconstruir el backend
en el servidor (`docker compose up -d --build`).

### "Backend no responde"
```powershell
cd packages\backend
pnpm db:generate
pnpm db:migrate
```

### "Base de datos corrupta"
```powershell
cd packages\backend
Remove-Item prisma\data\dev.db
pnpm db:migrate
pnpm db:seed
```

### "Puerto ya en uso"
Edita `.env.local` y cambia `PORT=3001` a otro puerto libre

---

**Desarrollado para el Departamento de Operaciones**
