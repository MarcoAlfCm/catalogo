# SEO base para cajadecreaciones.com

Este patch agrega la base de indexación para Google sin cambiar la lógica de pedidos ni el panel administrativo.

## Qué incluye

- `robots.txt` dinámico en `/robots.txt`.
- `sitemap.xml` dinámico en `/sitemap.xml`, generado desde categorías y productos publicados.
- Ruta pública `/categoria/:slug` para indexar categorías.
- Metadatos base para catálogo y productos: title, description, canonical, Open Graph y Twitter Card.
- Datos estructurados JSON-LD:
  - `LocalBusiness` en catálogo.
  - `Product` en detalle de producto.
- Metadatos dinámicos server-side para `/producto/:slug` y `/categoria/:slug`.
- Metadatos dinámicos client-side como refuerzo cuando se navega dentro del catálogo.
- `noindex, nofollow` en pantallas privadas o no deseadas para búsqueda: login, admin, pedido, cuenta y personalizado.
- Imágenes base para compartir: `/assets/seo/caja-de-creaciones-og.jpg` y `/assets/seo/caja-de-creaciones-logo.png`.

## Instalación rápida

Desde el servidor:

```bash
cd /opt/catalogo
cp -a app.js app.js.bak-seo
unzip -o catalogo-seo-cajadecreaciones-archivos.zip -d /opt/catalogo
npm install
pm2 restart ecosystem.config.js
```

Si usas un nombre de proceso PM2 distinto:

```bash
pm2 restart catalogo
```

## Validación

Después de reiniciar:

```bash
curl -I https://cajadecreaciones.com/catalogo
curl https://cajadecreaciones.com/robots.txt
curl https://cajadecreaciones.com/sitemap.xml
curl https://cajadecreaciones.com/producto/llavero-personalizado-resina | grep -E "<title>|canonical|schema-product|og:title"
curl https://cajadecreaciones.com/categoria/resina | grep -E "<title>|canonical|og:title"
```

## Google Search Console

Enviar este sitemap:

```text
https://cajadecreaciones.com/sitemap.xml
```

Luego inspeccionar manualmente:

```text
https://cajadecreaciones.com/catalogo
https://cajadecreaciones.com/categoria/resina
https://cajadecreaciones.com/producto/llavero-personalizado-resina
```

## Variables opcionales

El dominio ya quedó por defecto como `https://cajadecreaciones.com`, pero puedes sobreescribirlo en `.env`:

```env
PUBLIC_SITE_URL=https://cajadecreaciones.com
SITE_NAME=Caja de Creaciones
SITE_DESCRIPTION=Catálogo artesanal de Caja de Creaciones: llaveros personalizados, piezas en impresión 3D, resina, regalos creativos y detalles hechos a mano en México.
SITE_LOCALITY=Querétaro
SITE_REGION=Querétaro
SITE_COUNTRY=MX
SITE_AREA_SERVED=México
SITE_PHONE=
SITE_INSTAGRAM=
SITE_FACEBOOK=
```
