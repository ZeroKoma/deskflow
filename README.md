# DeskFlow - Sistema de Gestión de Productividad

DeskFlow es una aplicación web diseñada para la gestión de notas, recordatorios y tareas diarias.

## Arquitectura del Proyecto

La aplicación sigue un patrón de diseño modular basado en **ES Modules (ESM)**, separando la lógica de negocio, el estado y la interfaz de usuario.

### Estructura de Archivos

- **`index.html`**: Punto de entrada único (SPA - Single Page Application). Contiene la estructura base y los contenedores de los modales.
- **`store.js`**: El "corazón" de la aplicación. Maneja el estado global (`state`), las mutaciones de datos (`mutations`) y los selectores calculados (`getters`). Sincroniza automáticamente con el servicio de datos (`data-service.js`).
- **`data-service.js`**: Capa de abstracción de datos. Decide si la información se lee/guarda en el almacenamiento local (IndexedDB) o en un servidor remoto.
- **`app.js`**: Orquestador principal. Configura los eventos globales y coordina la inicialización del sistema.
- **`view.js`**: Motor de renderizado de las vistas principales (Dashboard, Calendario, Lista de Notas).
- **`view-components.js`**: Componentes de UI reutilizables como badges, pills, notificaciones (toasts) y el sistema de tooltips.
- **`view-modals.js`**: Lógica específica para la gestión de formularios dentro de modales (Notas, Tags, Categorías).
- **`crypto-utils.js`**: Utilidades criptográficas basadas en la Web Crypto API (AES-GCM, PBKDF2).
- **`app-alarms.js`**: Servicio en segundo plano que monitoriza recordatorios y lanza notificaciones sonoras y de sistema.
- **`app-settings.js`**: Lógica administrativa para la exportación/importación de datos CSV y mantenimiento de la base de datos local.
- **`utils.js`**: Funciones auxiliares para el manejo de fechas y manipulación de archivos.
- **`translations/`**: Directorio que contiene los diccionarios de idiomas (`es.js`, `en.js`) y el motor de traducción centralizado.
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

### 5. Seguridad y Privacidad Blindada

DeskFlow implementa un sistema de seguridad de nivel bancario:

- **Cifrado AES-GCM 256-bit**: Los datos se cifran localmente antes de tocar el disco (IndexedDB).
- **Arquitectura de Bóveda (Vault)**: Una clave aleatoria maestra protege los datos. Esta clave está a su vez cifrada por la contraseña del usuario y una clave de recuperación maestra.
- **Derivación PBKDF2**: Las contraseñas se procesan con 100,000 iteraciones de hashing para prevenir ataques de fuerza bruta.
- **Conocimiento Cero (Zero-Knowledge)**: Ni el navegador ni un futuro servidor pueden leer el contenido de las notas sin la clave del usuario.
- **Persistencia de Sesión**: Uso de `sessionStorage` para permitir refrescar la página sin solicitar la contraseña constantemente, manteniendo la seguridad al cerrar la pestaña.

### 5. Soporte Multi-idioma (i18n)

DeskFlow detecta automáticamente el idioma del navegador y permite el cambio manual:

- **Traducción Estática**: Mediante atributos `data-t` en el HTML, el sistema traduce etiquetas al vuelo.
- **Traducción Dinámica**: Uso de la función `t()` para mensajes del sistema y notificaciones.
- **Localización de Fechas**: El calendario ajusta automáticamente el primer día de la semana (Lunes o Domingo) y el formato de fecha según el idioma.

## Gestión de Datos e Implementación de Backend

DeskFlow está diseñado siguiendo el patrón de **Service Layer**, lo que permite alternar entre almacenamiento local y remoto sin modificar la lógica de la interfaz de usuario.

### Arquitectura de Backend (Privacidad Total)

Para migrar los datos a una base de datos en la nube, se debe realizar lo siguiente:

1.  **Activar el modo Backend**: En `js/data-service.js`, cambia la constante `USE_BACKEND` a `true`.
2.  **Configurar la API**: Define la URL de tu servidor en la constante `API_BASE_URL`.
3.  **Seguridad en Tránsito**: El sistema ya está preparado para enviar los **blobs cifrados** al servidor. El backend solo almacenará datos ilegibles para terceros.
4.  **Implementar Endpoints**: El servidor deberá exponer rutas REST (o GraphQL) para:
    - `GET /notes`: Recuperar la lista de notas.
    - `POST /notes`: Guardar o sincronizar notas.
    - `GET/POST /tags` y `/categories`: Gestión de diccionarios de etiquetas.
    - `GET/POST /preferences`: Para persistir el tema e idioma elegidos por el usuario.
5.  **Transparencia**: El archivo `store.js` ya utiliza `async/await`, por lo que simplemente esperará la respuesta de la red en lugar de la respuesta de IndexedDB, sin necesidad de cambios adicionales.

### Persistencia Local (Modo actual)

- **IndexedDB**: Almacena de forma persistente notas, preferencias (**tema e idioma**), tags y categorías.
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
