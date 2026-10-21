# Backend de MonkeyTrueque

La versión local usa **Spring Boot, Maven, MySQL y RabbitMQ**. RabbitMQ 4.0.9 ya está instalado en esta computadora como servicio de Windows; no necesitas Docker ni el servidor de configuración para arrancarla. Hay dos aplicaciones Spring:

| Aplicación | Dirección local | Qué hace |
| --- | --- | --- |
| `catalog-service` | `http://localhost:8081` | Publicaciones, fotos, reportes y moderación |
| `exchange-service` | `http://localhost:8082` | Propuestas, mensajes del chat, encuentros y calificaciones |

Los mensajes del chat se guardan en la tabla `exchange_messages` de MySQL. Cuando ambas personas confirman un trueque, `exchange-service` registra un evento pendiente en MySQL y lo publica en RabbitMQ. `catalog-service` consume ese evento y cierra la publicación. Si RabbitMQ está temporalmente caído, el evento pendiente se vuelve a intentar al recuperarse. La cola es duradera y el catálogo acepta entregas duplicadas sin volver a modificar la publicación. Feign sigue usándose para consultar una publicación al proponer un trueque.

## Arranque manual, paso a paso

Con MySQL iniciado, abre `Iniciar-MySQL.sql` desde la carpeta principal en MySQL Workbench y ejecuta el contenido para crear las bases y el usuario local.

1. Comprueba que **MySQL Server** y **RabbitMQ** estén iniciados. En esta computadora los servicios de Windows se llaman `MySQL80` y `RabbitMQ`.
2. Abre **MySQL Workbench** y conecta a tu servidor local con tu usuario administrador. Ejecuta [el archivo SQL de preparación](../Iniciar-MySQL.sql). Crea las dos bases de datos y el usuario local `monkeytrueque` con contraseña `monkeytrueque_local`.
3. Abre una terminal PowerShell en `backend/catalog-service` y ejecuta `.\iniciar.cmd`. Déjala abierta. La primera vez, el wrapper descarga Maven y las dependencias.
4. Abre otra terminal PowerShell en `backend/exchange-service` y ejecuta `.\iniciar.cmd`. Déjala abierta.
La autenticacion usa nombres de usuario y contrasenas locales con Spring Security, BCrypt y JWT compartido entre servicios. Al iniciar `catalog-service/iniciar.cmd`, si `app_users` esta vacia, se crea la cuenta de demostracion `admin` con contrasena `Admin123*` y rol administrador. Si ya existe alguna cuenta, no se crea ni se restablece esa cuenta. Los nuevos usuarios pueden registrarse desde la pagina y siempre reciben una cuenta normal: registrarse nunca otorga el rol de administrador ni de moderador. Esos roles solo los asigna un administrador desde el panel. Para cambiar o desactivar la cuenta de demostracion, configura `DEMO_ADMIN_USERNAME`, `DEMO_ADMIN_PASSWORD` y `DEMO_ADMIN_ENABLED` en `backend/.env`. `APP_JWT_SECRET` debe coincidir en ambos servicios si reemplazas el valor local.
5. Abre una tercera terminal en `frontend` y ejecuta `npm.cmd install` si es la primera vez; después, `npm.cmd start`. Abre `http://localhost:4200`.

Para comprobar que arrancaron, abre `http://localhost:8081/actuator/health` y `http://localhost:8082/actuator/health`: ambos deben responder `UP`. Las migraciones de Flyway crean las tablas automáticamente. Puedes detener cada aplicación con `Ctrl+C` en su terminal.

Si ya tienes otra cuenta o contraseña en MySQL, configura `MYSQL_USER` y `MYSQL_PASSWORD` en **cada** terminal antes de arrancar Spring. Nunca pongas la contraseña de MySQL en Angular.

## Datos y API

Las aplicaciones usan dos bases de datos MySQL (`monkey_catalog` y `monkey_exchange`) y migraciones Flyway. Los endpoints protegidos verifican tokens JWT emitidos por `catalog-service` y validados con Spring Security. `exchange-service` consulta el catálogo con OpenFeign y envía eventos de trueques confirmados por RabbitMQ. Las aplicaciones exponen Actuator y métricas Prometheus.

| Método | Ruta | Acceso |
| --- | --- | --- |
| GET | `/api/listings`, `/api/listings/{id}` | Público |
| POST | `/api/listings` | Sesión cuenta local |
| DELETE | `/api/listings/{id}` | Propietario |
| GET | `/api/exchanges/mine`, `/api/exchanges/{id}` | Participante |
| POST | `/api/exchanges` | Sesión cuenta local |
| POST | `/api/exchanges/{id}/messages` | Participante |
| POST | `/api/exchanges/{id}/meetup` | Participante |
| POST | `/api/exchanges/{id}/confirm` | Participante |
| POST | `/api/exchanges/{id}/rating` | Participante |
| POST | `/api/reports` | Sesión cuenta local |
| GET/PATCH | `/api/admin/reports`, `/api/admin/reports/{id}` | Administrador |
| GET/PATCH | `/api/admin/listings`, `/api/admin/listings/{id}/visibility` | Administrador |
| GET | `/api/admin/exchanges`, `/api/admin/exchanges/{id}` | Administrador |
| GET | `/api/admin/actions` | Administrador |

Las peticiones protegidas envían `Authorization: Bearer <token de sesión cuenta local>`. Las nuevas fotos se suben desde `catalog-service` a Cloudinary; MySQL conserva la URL y el identificador de cada imagen, no el base64. Se aceptan JPG, PNG o WebP de hasta 10 MB por foto. Para configurarlo, copia `backend/catalog-service/.env.example` a `backend/catalog-service/.env`, reemplaza sus valores con los de Cloudinary y reinicia el backend. `.env` está excluido de Git. No pongas el API Secret en Angular, en `application.yml` ni en Git. Las fotos antiguas que ya están en MySQL no se migran automáticamente. La interfaz Angular usa `http://localhost:8081` y `http://localhost:8082` por defecto. Para desplegarla en otro dominio, cambia las etiquetas `catalog-api-url` y `exchange-api-url` de `frontend/src/index.html` y `CORS_ORIGIN` del backend.

RabbitMQ usa `localhost:5672` y la cuenta local `guest`/`guest` por defecto. Si cambias esa cuenta, configura `RABBITMQ_USER` y `RABBITMQ_PASSWORD` en ambas terminales Spring. La cola `monkeytrueque.exchange.completed` conserva eventos cuando el catálogo está apagado. Tras cinco fallos de procesamiento, RabbitMQ los mueve a `monkeytrueque.exchange.completed.failed` para revisarlos. El historial del chat permanece en MySQL.


