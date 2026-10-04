# Licitaciones en plazo

Cada mañana revisa los anuncios oficiales de la Plataforma de Contratación del Sector Público y envía un correo con las que siguen en plazo.

Entran servicios de Catalunya, Madrid y Aragón, desde 7.000 € sin IVA, de estas áreas:

- Comunicación y eventos
- TIC, datos y PMO
- Mentoría
- Dinamización comercial
- Videovigilancia, cuando el objeto es la plataforma y no solo las cámaras

Quedan fuera el catering y los alquileres de espacio, carpa, escenario, sonido, mobiliario o vehículos. El texto que decide cada área está en `perfil.cjs`.

## Qué hay que configurar

En el repositorio de GitHub: Settings → Secrets and variables → Actions.

El correo sale hacia **javisaezz@gmail.com**. Para enviarlo hace falta un buzón de salida. Con el mismo Gmail:

| Secret | Valor |
|---|---|
| `LICITACIONES_SMTP_HOST` | `smtp.gmail.com` |
| `LICITACIONES_SMTP_PORT` | `587` |
| `LICITACIONES_SMTP_USER` | `javisaezz@gmail.com` |
| `LICITACIONES_SMTP_PASS` | contraseña de aplicación de Google (no la contraseña de entrar al correo) |
| `LICITACIONES_EMAIL_FROM` | opcional. Si falta, se usa la cuenta SMTP |

La contraseña de aplicación se crea en la cuenta de Google: Seguridad → Verificación en dos pasos → Contraseñas de aplicaciones.

El workflow `.github/workflows/licitaciones.yml` se ejecuta cada día a las 07:00 (horario de verano) o a las 06:00 (horario de invierno). También se puede lanzar a mano en Actions → Licitaciones en plazo.

La primera ejecución lee hasta 30 páginas de cada fuente (unas 500 por página: en la plataforma estatal eso cubre cerca de una semana). Las siguientes solo leen lo publicado desde la última vez y conservan la lista en la caché de Actions. Si quieres mirar más atrás la primera vez, lanza el workflow a mano y sube «Páginas por fuente». Si la caché se borra, el siguiente día vuelve a hacer el recorrido largo.

## Probarlo en local

```bash
node licitaciones/ejecutar.cjs --sin-envio --max-paginas-inicial 1 --atras-dias 2
```

El correo queda en `licitaciones/salida/ultimo.txt` y no se envía. Para enviarlo, define las mismas variables en `.env` y quita `--sin-envio`.
