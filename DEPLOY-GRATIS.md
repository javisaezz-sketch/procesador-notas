# Despliegue gratuito — panel móvil + emails cada 10 min

Stack **0 €**:

| Pieza | Servicio | Coste |
|-------|----------|-------|
| Dashboard web | [Vercel](https://vercel.com) Hobby | Gratis |
| Pipeline POP3 + IA | [GitHub Actions](https://github.com) | Gratis* |
| Base de datos | Supabase (ya lo tienes) | Gratis |

\* GitHub da **minutos ilimitados** en repos **públicos**. En repos privados hay límite (~2000 min/mes); con cron cada 10 min se agota. **Recomendación: repo público** (sin subir `.env`; las claves van en Secrets).

---

## Paso 1 — Subir el código a GitHub

1. Crea un repo en GitHub (público recomendado).
2. Sube el proyecto **sin** el archivo `.env`.

```bash
git init
git add .
git commit -m "Panel editorial multi-medio"
git remote add origin https://github.com/TU_USUARIO/procesador-notas.git
git push -u origin main
```

---

## Paso 2 — Secrets en GitHub (para el pipeline automático)

En el repo: **Settings → Secrets and variables → Actions → New repository secret**

Añade:

| Secret | Valor |
|--------|--------|
| `SUPABASE_URL` | Tu URL de Supabase |
| `SUPABASE_ANON_KEY` | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key |
| `GEMINI_API_KEY` | API key Gemini |
| `GEMINI_MODEL` | `gemini-3.6-flash` |

El workflow `.github/workflows/pipeline.yml` ya está configurado para ejecutarse **cada 10 minutos**.

Prueba manual: **Actions → Pipeline emails → Run workflow**.

---

## Paso 3 — Desplegar el dashboard en Vercel

1. Entra en [vercel.com](https://vercel.com) con tu cuenta GitHub.
2. **Add New → Project** → importa el repo.
3. Framework: **Next.js** (detectado automático).
4. En **Environment Variables** añade:

| Variable | Dónde se usa |
|----------|----------------|
| `SUPABASE_URL` | Dashboard |
| `SUPABASE_ANON_KEY` | Dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Borrar email POP3 al publicar/anular |
| `DASHBOARD_USER` | Usuario del login (ej. `panel`) |
| `DASHBOARD_PASSWORD` | Contraseña que pondrás en el móvil |

5. **Deploy**.

Te dará una URL tipo: `https://procesador-notas.vercel.app`

---

## Paso 4 — Usar desde el móvil

1. Abre la URL de Vercel en el navegador del móvil.
2. El navegador pedirá **usuario y contraseña** (Basic Auth).
3. Guarda en favoritos o “Añadir a pantalla de inicio”.

---

## Qué queda automático

```
Cada 10 min (GitHub Actions)
    → Lee POP3 de todos los medios
    → Gemini genera artículos
    → Guarda en Supabase

Tú desde el móvil (Vercel)
    → Ves artículos pendientes
    → Publicas o anulas
    → Borra el email del buzón
```

Tu PC de casa **no tiene que estar encendido**.

---

## Local vs producción

| Entorno | Auth |
|---------|------|
| Local (`npm run dev`) | Sin contraseña si no pones `DASHBOARD_*` en `.env` |
| Vercel | Obligatorio configurar `DASHBOARD_USER` y `DASHBOARD_PASSWORD` |

---

## Límites del plan gratis

- **Vercel**: suficiente para este panel (tráfico bajo).
- **GitHub Actions**: cada ejecución del pipeline ~1–2 min. Cada 10 min ≈ 6000 min/mes → solo viable gratis con **repo público**.
- **Supabase**: revisa cuota del plan free si suben muchos emails/imágenes.

---

## Si prefieres repo privado

Cambia el cron a cada 30–60 min en `.github/workflows/pipeline.yml`:

```yaml
- cron: '0 * * * *'   # cada hora
```

O lanza el pipeline a mano desde **Actions → Run workflow** cuando quieras.
