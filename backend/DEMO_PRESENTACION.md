# Datos de demostración

El proyecto incluye cargadores de datos de demostración, desactivados por defecto. Para activarlos en los dos servicios locales, define `DEMO_DATA_ENABLED=true` antes de iniciar cada `iniciar.cmd`. La carga es aditiva e idempotente: no elimina ni reemplaza publicaciones o usuarios existentes, y no vuelve a insertar los registros de demostración si ya están guardados.

## Cuentas de prueba

| Rol | Usuario | Contraseña |
| --- | --- | --- |
| Administrador | `admin` | `Admin123*` |
| Moderadora | `demo_moderador` | `Moderador123*` |
| Usuario | `demo_usuario` | `Usuario123*` |
| Usuario | `demo_vecina` | `Vecina123*` |

La cuenta `admin` se crea automáticamente cuando la tabla de usuarios está vacía. Los otros tres usuarios se agregan al iniciar el catálogo si aún no existen. Las contraseñas se guardan con BCrypt.

## Qué incluye

- Publicaciones visibles de distintos tipos, categorías y distritos.
- Una publicación oculta con un motivo de ejemplo, visible al entrar como `demo_usuario` a **Mi cuenta → Consultar medidas y respuestas a mis apelaciones → Medidas y revisiones**.
- Un reporte pendiente para revisar desde el panel de administración.
- Una propuesta de trueque y un mensaje en **Mis mensajes**, entre `demo_usuario` y `demo_vecina`.

Por el momento, los archivos `iniciar.cmd` dejan la carga desactivada. Para volver a cargar los ejemplos en local, define `DEMO_DATA_ENABLED=true` en `backend/.env` y reinicia ambos servicios.

Estas credenciales son solo para presentar el proyecto en local. No las uses en una instalación pública.
