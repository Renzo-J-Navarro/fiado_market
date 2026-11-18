# Fiado – créditos barriales

## Puesta en marcha
1. **MySQL:** para una instalación nueva, crea la base y carga el esquema:
   ```powershell
   mysql -u root -p -e "CREATE DATABASE fiado CHARACTER SET utf8mb4"
   cmd /c "mysql -u root -p fiado < backend\schema.sql"
   ```
   Para una base existente, aplica una sola vez y en orden las migraciones que aún no hayas ejecutado: `20261103_store_dni_or_ruc.sql`, `20261103_platform_admins.sql`, `20261103_centralized_accounts.sql`, `20261104_business_accounts.sql` y `20261105_sales_quantity.sql`, todas dentro de `backend/migrations`.
2. **Backend:** configura `backend/.env` con la conexión MySQL, un `JWT_SECRET` de al menos 16 caracteres y los datos `SUPERADMIN_DOCUMENT_TYPE`, `SUPERADMIN_DOCUMENT`, `SUPERADMIN_EMAIL` y `SUPERADMIN_PASSWORD` (mínimo 12 caracteres). Desde `backend`, ejecuta `npm i`, `npm run seed:admin` y `npm start`.
3. **Frontend:** desde `frontend`, ejecuta `npm i` y `npm run dev`. Abre http://localhost:3000/login.

## Seguridad antes de subir a GitHub
- `backend/.env.example`, `backend/.env.test.example` y `frontend/.env.local.example` son plantillas; revisa que contengan solo valores ficticios y usa tus credenciales únicamente en los archivos locales `.env`.
- El `.gitignore` del proyecto excluye `.env`, `.env_test` y otros archivos de entorno locales. Antes de hacer push, verifica los archivos preparados con `git status` y no fuerces la inclusión de archivos ignorados.
- Si alguna contraseña o clave real ya se compartió o subió a GitHub, cámbiala y reemplaza el `JWT_SECRET`; agregarla al `.gitignore` no la elimina del historial.

## Crear una cuenta
- Pulsa **Registrarme** y elige **Tengo RUC** para crear una cuenta comercial o **Tengo DNI** para registrar un negocio de persona natural.
- Con RUC se solicitan RUC, DNI personal del titular, nombre del comercio, giro, correo y contraseña. Con DNI se solicita el DNI, nombre del negocio, giro, correo y contraseña.
- La cuenta queda activa inmediatamente y se inicia sesión al completar el registro. El correo y la contraseña son las credenciales de acceso en ambos tipos de cuenta.
- Los comercios y los negocios personales tienen paneles de inicio distintos y pueden administrar clientes, productos, ventas y cobros.
- Los clientes que consultan un crédito existente conservan su acceso separado desde **Acceso para clientes con crédito**.
- Al crear un cliente desde **Personas fiadas**, la tienda registra su DNI y condiciones de crédito y obtiene un enlace de un solo uso (48 h) para compartir. El cliente crea su propia contraseña y luego entra con el nombre del negocio, su DNI personal y esa contraseña. Si el enlace vence, el negocio puede emitir otro desde la lista.
- El punto de venta permite indicar cantidad y calcula una vista previa del crédito disponible, interés y vencimientos antes de guardar. El estado de cuenta muestra las cuotas, moras y totales del ciclo y se puede imprimir.

## Administrador global
- Existe una sola cuenta `SUPERADMIN`, configurada mediante variables de entorno con `npm run seed:admin`. El acceso es con email y contraseña.
- En `/superadmin/comercios` puede consultar las cuentas registradas, cambiar documentos, activar/desactivar y eliminar cuentas. **Probar panel** abre el panel del negocio seleccionado; las operaciones realizadas allí modifican sus datos reales. El acceso de prueba vence en una hora y permite volver al panel global.
- Las cuentas con ventas o pagos no se borran para preservar el historial financiero; el panel permite desactivarlas. Los registros antiguos sin cuenta de acceso pueden eliminarse para que la persona vuelva a registrarse.
- Las operaciones protegidas del comercio requieren una sesión de ese mismo negocio. Las cuentas desactivadas o de negocios desactivados no pueden iniciar sesión y sus tokens activos dejan de autorizar operaciones.

## Comandos de validación
| Comando | Qué valida | Requiere |
|---|---|---|
| `cd backend && npm test` | Motor financiero y validaciones/autorización | nada (sin BD) |
| `cd backend && npm run test:integration` | Registro e inicio de sesión RUC/DNI, operaciones del negocio y gestión global de cuentas | MySQL; copia `backend/.env.test.example` a `backend/.env.test` (la base `_test` se recrea) |
| `cd frontend && npm run build` | Compilación, estilos y tipos de Next.js | — |
| `cd frontend && npm run test:e2e` | Registro y acceso de cuentas RUC/DNI; control global | Backend en :4000 con la BD de pruebas y `npx playwright install chromium` |

## Decisiones
- **Perfiles:** RUC identifica un comercio y requiere el DNI personal del titular; DNI identifica un negocio de persona natural. Cada cuenta tiene email y contraseña propios.
- **Administrador global:** hay un registro único en `platform_admins` (ID fijo 1). El rol global no se puede asignar desde el registro público.
- **Cuentas de clientes:** se crean desde el comercio y definen su contraseña mediante un enlace de un solo uso (48 h; solo se guarda su hash SHA-256). Para acceder a un crédito usan la pantalla separada de clientes.
- **Eliminación:** se permite borrar una cuenta solo si no tiene ventas ni pagos asociados. Si existe historial, se debe desactivar para conservarlo.
- **Seguridad:** CORS por lista (`CORS_ORIGINS`), limitación de intentos en login y activación de contraseñas (`LOGIN_MAX`), errores internos solo al log, JWT HS256 de 8 h y contraseñas con bcrypt.
- Supuestos financieros: TNA→TEA con capitalización diaria (m=360); 1ª cuota un mes después de la fecha pactada; mora sobre capital+interés pendiente de la cuota.
