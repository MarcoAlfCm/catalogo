# Catálogo Caja de Creaciones - Preview oficial V3

## Rutas visuales

- `/` o `/catalogo`: catálogo público sin login.
- `/producto/:slug`: detalle visual del producto.
- `/login`: pantalla visual de ingreso/registro rápido al finalizar pedido.
- `/pedido`: confirmación visual del pedido.
- `/admin`: panel administrativo visual.

## Alcance de esta fase

Esta versión sigue siendo preview. No usa MySQL, sesiones reales ni subida real de imágenes.

- Los productos del admin se guardan en `localStorage` del navegador.
- El carrito/pedido se guarda en `localStorage` del navegador.
- Las imágenes subidas en admin son previsualización local.

## Siguiente fase recomendada

1. Endpoints reales para productos.
2. Subida real con Multer.
3. MySQL para productos, categorías, imágenes, usuarios y pedidos.
4. Login real para clientes al finalizar pedido.
5. Login obligatorio para admin.
