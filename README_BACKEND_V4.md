# Catálogo Caja de Creaciones · Backend V4

Esta versión conserva el preview visual V3, pero ya agrega backend real para productos, imágenes y pedidos base.

## Rutas visuales

- `/` y `/catalogo`: catálogo público sin login.
- `/producto/:slug`: detalle de producto.
- `/login`: login visual para continuar al pedido.
- `/pedido`: confirmación de pedido.
- `/admin`: panel admin visual conectado al backend.

## API agregada

- `GET /api/status`
- `GET /api/catalog/products`
- `GET /api/catalog/products?includeHidden=1`
- `GET /api/catalog/products/:slug`
- `GET /api/catalog/categories`
- `GET /api/admin/products`
- `POST /api/admin/products`
- `PUT /api/admin/products/:id`
- `DELETE /api/admin/products/:id`
- `POST /api/admin/demo/reset`
- `GET /api/admin/orders`
- `POST /api/orders`

## Modo de datos

Si no se configura MySQL, la app inicia en modo memoria para pruebas. Esto permite desplegar sin romper el sitio.

Para persistencia real, configura `.env` con:

```env
DATA_SOURCE=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=catalogo_user
DB_PASSWORD=CAMBIAR_PASSWORD
DB_NAME=catalogo_czc
DB_STRICT=false
```

`DB_STRICT=false` permite que el sitio siga vivo si MySQL falla. Cuando el entorno esté estable, puede cambiarse a `true` para que el proceso no arranque sin base.

## Crear base de datos

```bash
mysql -u root -p < /opt/catalogo/db/schema.sql
mysql -u root -p < /opt/catalogo/db/seed_demo.sql
```

## Subida de imágenes

Las imágenes se guardan en:

```text
/opt/catalogo/public/uploads/products/
```

Y se sirven por:

```text
/uploads/products/archivo.webp
```

## Próximas fases previstas

1. Auth real para cliente y admin.
2. Catálogo personal por usuario.
3. Personalizaciones asistidas por IA.
4. Revisión/aprobación de resumen por admin.
5. Estados avanzados de pedido y anticipo.
