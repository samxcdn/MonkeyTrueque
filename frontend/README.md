# MonkeyTrueque

Plataforma web para publicar y proponer intercambios. El frontend Angular consume dos servicios Spring Boot y MySQL.

## Requisitos

- Node.js compatible con Angular 19 y npm
- Java 21
- MySQL 8 y RabbitMQ 4

## Iniciar en local

1. Sigue las instrucciones de `backend/README.md` para preparar MySQL y RabbitMQ e iniciar ambos servicios. Al arrancar con una base vacía se crea la cuenta de administrador `admin` (contraseña `Admin123*`).
2. Desde `frontend`, ejecuta `npm install` y `npm start`.
3. Abre `http://localhost:4200/` y crea una cuenta desde **Iniciar sesión**.

Las cuentas se guardan en MySQL. Spring Security autentica el nombre de usuario y la contrasena, cifra las contrasenas con BCrypt y emite JWT para autorizar ambos servicios. Las cuentas que se registran desde la página son siempre cuentas normales; los roles de moderador o administrador los asigna un administrador desde el panel.

## Comandos

```bash
npm run build
npm test -- --watch=false --browsers=ChromeHeadless
```

## Incluye

- Angular 19 standalone, Angular Material, Angular Router, NgRx Store y SCSS.
- Perfiles, publicaciones, intercambios, mensajes, apelaciones y herramientas de moderación conectadas al backend.
- Sesiones JWT con Spring Security y roles administrados desde la base de datos.
