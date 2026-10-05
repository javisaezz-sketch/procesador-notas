# Licitaciones en plazo

Cada mañana revisa los anuncios oficiales de la Plataforma de Contratación del Sector Público y envía un correo con las que siguen en plazo.

Entran servicios de Catalunya, Madrid y Aragón, desde 7.000 € sin IVA, de estas áreas:

- Comunicación y eventos, desde 7.000 €
- TIC, desde 30.000 €: PMO, datos, gobernanza o catálogos de datos, oficina técnica TIC, redacción o soporte de pliegos TIC, consultoría TIC, y videovigilancia solo si piden plataforma
- Mentoría, coaching, trabajo para pymes, dinamización comercial y formación empresarial o cursos para entidades con parte TIC o empresarial, desde 7.000 €

Quedan fuera el catering y los alquileres de espacio, carpa, escenario, sonido, mobiliario o vehículos. El texto que decide cada área está en `perfil.cjs`.

## Qué hay que configurar

El correo sale hacia **javisaezz@gmail.com** desde esa misma cuenta. En GitHub, Settings → Secrets and variables → Actions, el único secret necesario es `LICITACIONES_SMTP_PASS`: la contraseña de aplicación de 16 letras, no la de entrar a Gmail.

El primer parte automático es el martes 6 de octubre de 2026 a las 7:40, hora de Madrid. A partir de ese día el correo sale cada mañana a las 7:40 con lo publicado desde las 7:40 del día anterior. Lo ya enviado no se repite.

## Probarlo en local

```bash
node licitaciones/ejecutar.cjs --sin-envio --modo viernes --max-paginas 1
```

El correo queda en `licitaciones/salida/ultimo.txt` y no se envía. Para enviarlo, define las mismas variables en `.env` y quita `--sin-envio`.
