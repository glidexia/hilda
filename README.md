# La Hilda — Backend

API en Express + PostgreSQL (vía Prisma) para el sistema de pedidos y logística de La Hilda.

## Estructura

```
la-hilda-backend/
├── prisma/
│   ├── schema.prisma      # Esquema de la base de datos
│   └── seed.js            # Carga inicial: camiones, zonas, catálogo, admin, choferes
├── src/
│   ├── server.js           # Punto de entrada
│   ├── app.js               # Configuración de Express y rutas
│   ├── db.js                 # Cliente de Prisma compartido
│   ├── middleware/
│   │   ├── auth.js               # Verifica el token y el rol (admin/chofer)
│   │   └── errorHandler.js  # Manejo centralizado de errores
│   ├── utils/
│   │   ├── password.js    # Hasheo y verificación de contraseñas
│   │   ├── jwt.js               # Firma y verificación de tokens
│   │   ├── zona.js             # Asignación automática de camión por barrio
│   │   └── diaHabil.js      # Cálculo del próximo día hábil
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   └── public.controller.js
│   └── routes/
│       ├── auth.routes.js
│       ├── public.routes.js
│       ├── admin.routes.js      # Protegidas — lógica completa: paso 5
│       └── chofer.routes.js      # Protegidas — lógica completa: paso 6
├── package.json
├── .env.example
└── .gitignore
```

## Uso local

```bash
npm install
cp .env.example .env        # completá los valores reales, este archivo NO se sube a GitHub
npm run prisma:generate
npm run prisma:migrate:dev  # crea las tablas en tu base
npm run seed                 # carga camiones, zonas, catálogo, admin y choferes
npm run dev                   # levanta el servidor en http://localhost:4000
```

Probá que esté vivo: `GET http://localhost:4000/health`

## Subir a GitHub

```bash
git init
git add .
git commit -m "Backend inicial: esquema, auth, pedidos públicos"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/la-hilda-backend.git
git push -u origin main
```

El `.gitignore` ya excluye `node_modules/` y `.env`, así que tus credenciales reales nunca llegan al repo.

## Conectar con Railway

1. En Railway → tu proyecto → **New → Deploy from GitHub repo** → elegís este repositorio.
2. Si todavía no tenés el servicio de Postgres en ese proyecto: **New → Database → PostgreSQL**.
3. En el servicio de la API, pestaña **Variables** → **Add Reference Variable** → `DATABASE_URL` (apunta al servicio de Postgres).
4. Agregá manualmente el resto de las variables de `.env.example` (`JWT_SECRET`, `ADMIN_USUARIO`, etc.) con sus valores reales.
5. En **Settings → Deploy**, configurá el comando de build como `npm run prisma:generate && npm run prisma:migrate:deploy` y el de arranque como `npm start`.
6. Una vez arriba, corré el seed una sola vez desde la terminal de Railway (o localmente apuntando el `DATABASE_URL` de producción).

## Rutas disponibles

| Método | Ruta | Quién | Qué hace |
|---|---|---|---|
| POST | `/auth/admin/login` | público | Login del administrador |
| POST | `/auth/chofer/login` | público | Login de cada camión |
| GET | `/public/productos` | público | Catálogo activo (para la vidriera) |
| GET | `/public/zonas` | público | Barrios disponibles y a qué camión corresponden |
| POST | `/public/pedidos` | público | Crea el cliente + el pedido, asigna camión y fecha automáticamente |
| GET | `/admin/dashboard` | admin | KPIs, ingresos del mes, pedidos de hoy por camión |
| GET | `/admin/pedidos?dia=&camionId=&estado=&q=` | admin | Pedidos agrupados por camión, ordenados como hoja de ruta |
| PATCH | `/admin/pedidos/:id/camion` | admin | Reasigna manualmente un pedido a otro camión |
| GET | `/admin/clientes?q=&desde=&hasta=&orden=` | admin | Base de clientes con filtros y consumo total |
| GET/POST/PATCH | `/admin/productos` | admin | Catálogo: listar, crear, editar precio/nombre/activo |
| GET/POST/PATCH | `/admin/camiones` | admin | Listar, crear (con chofer), editar nombre/color |
| GET | `/admin/zonas` | admin | Todas las zonas operativas, con o sin camión asignado |
| POST | `/admin/zonas` | admin | Crea una zona nueva (nace sin camión asignado) |
| PATCH | `/admin/zonas/:id` | admin | Renombra una zona (actualiza también los pedidos existentes con ese barrio) |
| DELETE | `/admin/zonas/:id` | admin | Elimina la zona por completo |
| PATCH | `/admin/zonas/:id/camion` | admin | Asigna la zona a un camión, o la suelta (`camionId: null`) sin borrarla |
| GET/POST/DELETE | `/admin/calendario[/:id]` | admin | Días no hábiles (domingos, feriados, lo que definas) |
| GET | `/chofer/pedidos?dia=ayer\|hoy\|manana` | chofer | Su ruta del día, numerada por parada |
| PATCH | `/chofer/pedidos/:id/estado` | chofer | Marca entregado / no atendido / pendiente |

## Tiempo real (Socket.io)

El servidor emite eventos por WebSocket además de responder por REST, así que los paneles no necesitan refrescar para ver cambios. El frontend se conecta pasando el mismo token JWT del login:

```js
import { io } from "socket.io-client";

const socket = io(API_URL, { auth: { token } }); // el token que devolvió /auth/admin/login o /auth/chofer/login

socket.on("pedido:nuevo", (pedido) => { /* actualizar la lista */ });
socket.on("pedido:actualizado", (pedido) => { /* actualizar ese pedido en pantalla */ });
socket.on("pedido:removido", ({ id }) => { /* sacarlo de la lista (se reasignó a otro camión) */ });
socket.on("camion:actualizado", (camion) => { /* refrescar tarjeta de ese camión */ });
socket.on("producto:actualizado", (producto) => { /* refrescar catálogo */ });
```

- El **admin** recibe los cuatro eventos siempre.
- Cada **chofer** solo recibe `pedido:nuevo` / `pedido:actualizado` de pedidos de su propio camión, y `pedido:removido` si le sacaron un pedido de encima.

## Calendario de días hábiles

Al arrancar, la tabla `dias_no_habiles` está vacía — es decir, el sistema calcula "mañana" como el próximo día hábil siempre, sin excluir domingos por defecto. Cargá los domingos y feriados que correspondan desde `POST /admin/calendario` (o vamos a armarle una pantalla en el frontend) antes de poner esto en producción real, o vas a ofrecer entrega en domingo sin querer.

