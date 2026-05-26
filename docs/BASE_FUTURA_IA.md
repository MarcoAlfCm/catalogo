# Base para catálogo personal e IA

Esta versión ya activa el primer flujo real de IA para pedidos personalizados.

## Flujo actual implementado

1. El usuario entra al catálogo público.
2. Si quiere pedir o personalizar, inicia sesión o se registra.
3. Desde `/personalizado` puede describir una pieza nueva o elegir un producto existente como modelo base.
4. Puede subir fotos de referencia. La IA no interpreta visualmente esas imágenes; por eso la interfaz le pide describir qué debe tomarse de ellas.
5. DeepSeek ordena la conversación y devuelve un resumen estructurado.
6. Cuando el resumen tiene datos suficientes, el cliente crea la solicitud.
7. La solicitud entra como pedido real en `orders`, con estado `Pendiente de revisión`.
8. El admin revisa el pedido, referencias, resumen IA, fecha, entrega y nota visible para el comprador.
9. El admin confirma, ajusta o cancela desde el panel de pedidos.

## Tablas usadas

- `users`: clientes y administradores.
- `orders`: pedidos reales y solicitudes personalizadas.
- `order_items`: partida visible del pedido personalizado.
- `customer_catalogs`: reservado para catálogos personales más avanzados.
- `customer_catalog_items`: reservado para piezas generadas o guardadas en catálogo personal.

## Campos de IA usados

- `orders.ai_summary`
- `orders.ai_payload`
- `order_items.ai_customization_summary`
- `order_items.ai_payload`

Estos campos guardan el resumen legible para admin y el JSON completo de conversación, referencias, modelo base y estructura final.
