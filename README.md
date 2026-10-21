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
├── packages/
│   ├── backend/           # API REST (Hono + Prisma)
│   ├── frontend/          # React App (Vite + Tailwind)
│   └── shared/            # Tipos TypeScript compartidos
├── data/
│   └── dev.db             # Base de datos SQLite
└── scripts/
    └── migrate-to-cloud.ps1  # Para migrar a Vercel/Neon
```

---

## ☁️ Migración a la Nube (Cuando esté listo)

Cuando quieras publicar a producción:

```powershell
.\scripts\migrate-to-cloud.ps1
```

Esto configurará:
- Base de datos PostgreSQL en Neon
- Deploy en Vercel
- Variables de entorno de producción

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
| Auditoría de cambios | ✅ |
| Drag & drop reordenar asignaciones | 🔜 próximamente |
| Exportar a Excel/PDF | 🔜 próximamente |
| Vista disponibilidad (heatmap) | 🔜 próximamente |

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
