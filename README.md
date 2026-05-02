# DeskFlow - Productivity Management System

DeskFlow is a web application designed for managing notes, reminders, and daily tasks.

## Project Architecture

The application follows a modular design pattern based on **ES Modules (ESM)**, separating business logic, state, and user interface.

### File Structure

- **`index.html`**: Single entry point (SPA - Single Page Application). Contains the base structure and modal containers.
- **`store.js`**: The "heart" of the application. Manages global state (`state`), data mutations (`mutations`), and computed selectors (`getters`). Automatically synchronizes with the data service (`data-service.js`).
- **`data-service.js`**: Data abstraction layer. Decides if information is read/saved in local storage (IndexedDB) or on a remote server.
- **`app.js`**: Main orchestrator. Configures global events and coordinates system initialization.
- **`view.js`**: Rendering engine for main views (Dashboard, Calendar, Notes List).
- **`view-components.js`**: Reusable UI components like badges, pills, notifications (toasts), and the tooltip system.
- **`view-modals.js`**: Specific logic for form management within modals (Notes, Tags, Categories).
- **`crypto-utils.js`**: Cryptographic utilities based on the Web Crypto API (AES-GCM, PBKDF2).
- **`app-alarms.js`**: Background service that monitors reminders and triggers sound and system notifications.
- **`app-settings.js`**: Administrative logic for exporting/importing JSON data and maintaining the local database.
- **`utils.js`**: Auxiliary functions for date handling and file manipulation.
- **`translations/`**: Directory containing language dictionaries (`es.js`, `en.js`) and the centralized translation engine.
- **`style.css`**: Design system based on CSS variables, with native support for light and dark themes.

## Key Features

### 1. Notes and Reminders Management

DeskFlow intelligently differentiates between:

- **Notes**: Tasks or ideas without a specific date ("Notes" section).
- **Reminders**: Events linked to a date and time, automatically integrated into the calendar.

### 2. Intelligent Alarm System

The alarm service (`app-alarms.js`) runs every 10 seconds, allowing:

- **Advance Notices**: Informative notification 5 minutes before the event.
- **Real Alarm**: Critical notification (visual and sound) at the exact moment.
- **Native Notifications**: Integration with Operating System notifications via the JavaScript Notifications API.

### 3. Organization through Tags and Categories

- Dynamic tagging system with customizable colors.
- **"Alarm" System Tag**: A protected tag that automatically synchronizes with the reminder state, allowing critical tasks to be filtered visually.

### 4. Multi-View Calendar

Adaptable Month, Week, and Day views, with state persistence for fluid navigation between dates.

### 5. Ironclad Security and Privacy

DeskFlow implements a bank-level security system:

- **256-bit AES-GCM Encryption**: Data is encrypted locally before touching the disk (IndexedDB).
- **Vault Architecture**: A random master key protects the data. This key is in turn encrypted by the user's password and a master recovery key.
- **PBKDF2 Derivation**: Passwords are processed with 100,000 hashing iterations to prevent brute-force attacks.
- **Zero-Knowledge**: Neither the browser nor a future server can read the content of the notes without the user's key.
- **Session Persistence**: Use of `sessionStorage` to allow page refreshing without constantly requesting the password, maintaining security when closing the tab.

### 6. Multi-language Support (i18n)

DeskFlow automatically detects the browser language and allows manual switching:

- **Static Translation**: Through `data-t` attributes in the HTML, the system translates labels on the fly.
- **Dynamic Translation**: Use of the `t()` function for system messages and notifications.
- **Date Localization**: The calendar automatically adjusts the first day of the week (Monday or Sunday) and the date format according to the language.

## Data Management and Backend Implementation

DeskFlow is designed following the **Service Layer** pattern, which allows switching between local and remote storage without modifying the user interface logic.

### Backend Architecture (Total Privacy)

To migrate data to a cloud database, the following must be performed:

1.  **Activate Backend mode**: In `js/data-service.js`, change the `USE_BACKEND` constant to `true`.
2.  **Configure the API**: Define your server URL in the `API_BASE_URL` constant.
3.  **Security in Transit**: The system is already prepared to send **encrypted blobs** to the server. The backend will only store data that is unreadable to third parties.
4.  **Implement Endpoints**: The server must expose REST (or GraphQL) routes for:
    - `GET /notes`: Retrieve the list of notes.
    - `POST /notes`: Save or synchronize notes.
    - `GET/POST /tags` and `/categories`: Management of tag dictionaries.
    - `GET/POST /preferences`: To persist the user's chosen theme and language.
5.  **Transparency**: The `store.js` file already uses `async/await`, so it will simply wait for the network response instead of the IndexedDB response, with no additional changes needed.

### Local Persistence (Current Mode)

- **IndexedDB**: Persistently stores notes, preferences (**theme and language**), tags, and categories.
- **JSON Export/Import**: Allows data portability. The system validates the structure of the JSON file during import to prevent data corruption.

## Customization (Theming)

CSS variables are used for theme management. Switching between light and dark mode is instantaneous and is persisted in the user's preferences.

```css
:root {
  --primary: #2563eb;
  /* ... light variables ... */
}
[data-theme="dark"] {
  --bg-main: #0f172a;
  /* ... dark variables ... */
}
```

---

**DeskFlow | v1.0**
By ZeroKoma

```

```
