# DeskFlow - Sistema de Gestión de Productividad

DeskFlow es una aplicación web diseñada para la gestión de notas, recordatorios y tareas diarias.

## Arquitectura del Proyecto

La aplicación sigue un patrón de diseño modular basado en **ES Modules (ESM)**, separando la lógica de negocio, el estado y la interfaz de usuario.

### Estructura de Archivos

- **`index.html`**: Punto de entrada único (SPA - Single Page Application). Contiene la estructura base y los contenedores de los modales.
- **`store.js`**: El "corazón" de la aplicación. Maneja el estado global (`state`), las mutaciones de datos (`mutations`) y los selectores calculados (`getters`). Sincroniza automáticamente con `localStorage`.
- **`data-service.js`**: Capa de abstracción de datos. Decide si la información se lee/guarda en el almacenamiento local (IndexedDB) o en un servidor remoto.
- **`app.js`**: Orquestador principal. Configura los eventos globales y coordina la inicialización del sistema.
- **`view.js`**: Motor de renderizado de las vistas principales (Dashboard, Calendario, Lista de Notas).
- **`view-components.js`**: Componentes de UI reutilizables como badges, pills, notificaciones (toasts) y el sistema de tooltips.
- **`view-modals.js`**: Lógica específica para la gestión de formularios dentro de modales (Notas, Tags, Categorías).
- **`app-alarms.js`**: Servicio en segundo plano que monitoriza recordatorios y lanza notificaciones sonoras y de sistema.
- **`app-settings.js`**: Lógica administrativa para la exportación/importación de datos CSV y mantenimiento de la base de datos local.
- **`utils.js`**: Funciones auxiliares para el manejo de fechas y manipulación de archivos.
- **`style.css`**: Sistema de diseño basado en variables CSS, con soporte nativo para temas claro y oscuro.

## Funcionalidades Clave

### 1. Gestión de Notas y Recordatorios

DeskFlow diferencia inteligentemente entre:

- **Notas**: Tareas o ideas sin fecha específica (sección "Notas").
- **Recordatorios**: Eventos vinculados a una fecha y hora, integrados automáticamente en el calendario.

### 2. Sistema de Alarmas Inteligente

El servicio de alarmas (`app-alarms.js`) se ejecuta cada 10 segundos, permitiendo:

- **Avisos Previos**: Notificación informativa 5 minutos antes del evento.
- **Alarma Real**: Notificación crítica (visual y sonora) en el momento exacto.
- **Notificaciones Nativas**: Integración con las notificaciones del Sistema Operativo mediante la API de Notificaciones de JavaScript.

### 3. Organización mediante Tags y Categorías

- Sistema de etiquetado dinámico con colores personalizables.
- **Tag de Sistema "Alarma"**: Una etiqueta protegida que se sincroniza automáticamente con el estado del recordatorio, permitiendo filtrar tareas críticas de forma visual.

### 4. Calendario Multi-Vista

Vistas adaptables de Mes, Semana y Día, con persistencia de estado para una navegación fluida entre fechas.

## Gestión de Datos e Implementación de Backend

DeskFlow está diseñado siguiendo el patrón de **Service Layer**, lo que permite alternar entre almacenamiento local y remoto sin modificar la lógica de la interfaz de usuario.

### Guía para implementar un Backend remoto

Si deseas migrar los datos a una base de datos en la nube, debes realizar lo siguiente:

1.  **Activar el modo Backend**: En `js/data-service.js`, cambia la constante `USE_BACKEND` a `true`.
2.  **Configurar la API**: Define la URL de tu servidor en la constante `API_BASE_URL`.
3.  **Implementar Endpoints**: Tu servidor deberá exponer rutas REST (o GraphQL) para:
    - `GET /notes`: Recuperar la lista de notas.
    - `POST /notes`: Guardar o sincronizar notas.
    - `GET/POST /tags` y `/categories`: Gestión de diccionarios de etiquetas.
    - `GET/POST /preferences`: Para persistir el tema elegido por el usuario.
4.  **Transparencia**: El archivo `store.js` ya utiliza `async/await`, por lo que simplemente esperará la respuesta de la red en lugar de la respuesta de IndexedDB, sin necesidad de cambios adicionales.

### Persistencia Local (Modo actual)

- **IndexedDB**: Almacena de forma persistente notas, preferencias (como el tema), tags y categorías.
- **Exportación/Importación JSON**: Permite la portabilidad de los datos. El sistema valida la estructura del archivo JSON durante la importación para evitar la corrupción de datos.

## Personalización (Theming)

Se utiliza variables CSS para el manejo de temas. El cambio entre modo claro y oscuro es instantáneo y se persiste en las preferencias del usuario.

```css
:root {
  --primary: #2563eb;
  /* ... variables de luz ... */
}
[data-theme="dark"] {
  --bg-main: #0f172a;
  /* ... variables de oscuridad ... */
}
```

---

**DeskFlow | v1.0**
By ZeroKoma

```

```
