# Pedidos personalizados con IA

Esta entrega activa la pantalla `/personalizado` para clientes con sesión.

## Qué hace

- Permite seleccionar un producto del catálogo como modelo base.
- Permite subir imágenes de referencia en `/uploads/custom-orders`.
- Mantiene la advertencia funcional: DeepSeek trabaja con texto en este flujo; la imagen queda guardada para el admin y el cliente debe describir qué debe tomarse como referencia.
- Conversa con DeepSeek para ordenar la solicitud.
- Si DeepSeek responde genérico o falla, el servidor calcula campos faltantes específicos para no repetir la misma frase.
- El resumen vive en el panel izquierdo para que el cliente vea qué información ya dio y qué falta.
- Cierra la solicitud cuando tiene información suficiente: qué quiere, cómo lo quiere, cantidad, fecha necesaria, modelo base/modificaciones y referencias.
- Crea un pedido real en `orders` con estado `Pendiente de revisión`.
- Guarda el resumen en `orders.ai_summary` y el JSON completo en `orders.ai_payload`.
- Guarda una partida visible en `order_items` para que el admin pueda revisar la solicitud desde el panel de pedidos.

## Variables de entorno

No se debe guardar la API key dentro del repositorio o del zip. Configúrala en `.env` del servidor:

```env
DEEPSEEK_API_KEY=tu_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_JSON_MODEL=deepseek-v4-flash
DEEPSEEK_TIMEOUT_MS=45000
```

## Endpoints nuevos

- `POST /api/custom-orders/reference`
  - Requiere sesión de cliente.
  - Recibe `multipart/form-data` con `referenceImage`.
  - Devuelve URL pública de la referencia.

- `POST /api/custom-orders/chat`
  - Requiere sesión de cliente.
  - Recibe mensajes, modelo base y referencias.
  - Devuelve respuesta de IA, campos faltantes y resumen.

- `POST /api/custom-orders/finalize`
  - Requiere sesión de cliente.
  - Reanaliza la conversación y crea el pedido personalizado.

## Nota operativa

Si DeepSeek no está configurado o falla por timeout, el sistema no rompe la pantalla. Usa un resumen local temporal para permitir pruebas de flujo, pero en producción debe configurarse `DEEPSEEK_API_KEY`.

## Comportamiento de referencias

Con la configuración actual no se envía la imagen como contenido visual al modelo. Se envían únicamente los metadatos de la referencia y la conversación del cliente. Por eso el flujo obliga a que el cliente escriba algo como:

```txt
De la referencia toma solo la forma y los colores; no tomes el texto.
```

Si en el futuro se quiere interpretación automática de imágenes, debe agregarse un proveedor de visión aparte para convertir la imagen en una descripción textual y después pasar esa descripción a DeepSeek.

## Campos mínimos que controla el servidor

- Qué pieza quiere.
- Cantidad de piezas.
- Colores, medidas, tema o modificaciones.
- Fecha en la que lo necesita.
- Qué debe tomarse de la referencia, cuando el cliente sube imagen.

## Ajuste V7.3 - Chat a la izquierda y constructor a la derecha

- El mini chat vive dentro del panel izquierdo para que el cliente converse en un solo lugar.
- El constructor derecho muestra modelo base, resumen, referencia y botón para crear solicitud.
- El resumen ya no intenta parecer formulario editable: son filas de lectura.
- El analizador local y el prompt de DeepSeek evitan confundir medidas como `15 cm` con cantidad de piezas.
- La respuesta del asistente debe decir lo que ya entendió y preguntar únicamente lo que falta, no repetir un mensaje genérico.
