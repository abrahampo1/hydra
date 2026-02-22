<div align="center">

[<img src="https://raw.githubusercontent.com/hydralauncher/hydra/refs/heads/main/resources/icon.png" width="144"/>](https://github.com/abrahampo1/hydra)

  <h1 align="center">Hydra Launcher (Fork)</h1>

  <p align="center">
    <strong>Fork de <a href="https://github.com/hydralauncher/hydra">Hydra Launcher</a> con funciones sociales avanzadas, sistema de backups dual (Google Drive + local), gestión de almacenamiento y mejoras de interfaz.</strong>
  </p>

</div>

## Sobre este fork

Este repositorio es un fork del proyecto original [hydralauncher/hydra](https://github.com/hydralauncher/hydra). Hydra es una plataforma de gaming open-source construida con Electron, React, TypeScript y Python. Este fork extiende la funcionalidad base con las siguientes mejoras:

## Cambios respecto al proyecto original

### Funciones sociales

- **Feed de actividad en Home** — Sección que muestra la actividad de amigos en tiempo real: jugando ahora, jugado recientemente y reseñas recientes.
- **Avatares de amigos online en el header** — Muestra hasta 3 avatares de amigos en línea con indicador de actividad y badge "+N" para los restantes. Se actualiza cada 60 segundos.
- **Hover cards de amigos** — Tooltip flotante al pasar el cursor sobre un amigo que muestra su perfil, juego actual y duración de la sesión.
- **Acciones de amistad en perfil** — Botones para deshacer amistad y bloquear usuario desde el perfil.

### Perfil mejorado

- **Pestaña de estadísticas** — Dashboard completo con: tamaño de biblioteca, tiempo total jugado (con ranking percentil), promedio por juego, tasa de completado de logros, logros desbloqueados, puntos ganados y karma.
- **Juegos más jugados** — Top 5 de juegos con barras proporcionales de tiempo de juego.
- **Controles de biblioteca** — Búsqueda con fuzzy search, ordenación (por tiempo jugado, logros, jugado recientemente), y alternancia entre vista grilla/lista.
- **Vista de lista para juegos** — Nuevo componente de lista con tiempo de juego, progreso de logros y opción de fijar/desfijar juegos.

### Sistema de backups dual

- **Google Drive** — Sincronización de guardados a Google Drive con autenticación OAuth2, refresco automático de tokens, compresión tar y metadatos (hostname, plataforma, prefijo Wine).
- **Backup local** — Alternativa de backup en disco local con ruta configurable y archivos de metadatos `.meta.json`.
- **Restauración multiplataforma** — Soporte para mapeo de rutas Wine/Windows para restaurar backups entre sistemas.
- **Configuración en Ajustes** — Nueva pestaña "Backups" para elegir entre Hydra Cloud y backup local, con selector de ruta.

### Gestión de almacenamiento

- **Pestaña de almacenamiento en Ajustes** — Visualización del uso de disco con barra de progreso, desglose por juego con segmentos coloreados, leyenda de los 5 juegos que más espacio ocupan.
- **Eliminación selectiva** — Opción de borrar solo el instalador o los archivos completos del juego, con modal de confirmación que muestra el espacio que se liberará.
- **Protección inteligente** — Impide eliminar el instalador si el ejecutable del juego está dentro de la carpeta del instalador.

### Mejoras de UI

- **Sidebar mejorada** — Muestra progreso de descarga y extracción con barras de progreso individuales por juego.
- **Modal de opciones de juego rediseñado** — Nuevo layout con iconos descriptivos (Octicons), accesibilidad por teclado y variables de estado precalculadas para estados deshabilitados.
- **Estilos refinados** — Ajustes de SCSS en múltiples componentes: catálogo, detalles de juego, perfil, notificaciones, configuración, sidebar, modal de cloud sync, galería, entre otros.

### Backend y tipos

- **Nuevos servicios**: `GoogleDriveService`, `LocalBackupService` como singletons en `src/main/services/`.
- **Nuevos eventos IPC**: 7 eventos para Google Drive + 5 para backup local + `deleteGameInstaller`.
- **Tipos añadidos**: `GoogleDriveTokens`, `GoogleDriveUserInfo`, `GoogleDriveBackupArtifact`, `BackupProvider`, `DiskUsage`.
- **Tipos extendidos**: `UserPreferences` con `localBackupPath` y `backupProvider`; `UserDetails` con `karma`; `UserProfile` con `hasCompletedWrapped2025`; `UserGame` con `isPinned`.

## Estructura de archivos nuevos

```
src/main/events/google-drive/       # Eventos IPC de Google Drive
src/main/events/local-backup/       # Eventos IPC de backup local
src/main/events/library/delete-game-installer.ts
src/main/helpers/restore-backup.ts  # Restauración unificada de backups
src/main/services/google-drive.ts   # Servicio de Google Drive
src/main/services/local-backup.ts   # Servicio de backup local

src/renderer/src/components/header/friend-hover-card.tsx
src/renderer/src/components/header/online-friends-avatars.tsx
src/renderer/src/pages/home/activity-feed.tsx
src/renderer/src/pages/profile/profile-content/friend-actions.tsx
src/renderer/src/pages/profile/profile-content/library-controls.tsx
src/renderer/src/pages/profile/profile-content/most-played-games-box.tsx
src/renderer/src/pages/profile/profile-content/stats-tab.tsx
src/renderer/src/pages/profile/profile-content/user-library-game-list-item.tsx
src/renderer/src/pages/settings/settings-backups.tsx
src/renderer/src/pages/settings/settings-storage.tsx
```

## Compilar desde el código fuente

Consulta la documentación del proyecto original: [docs.hydralauncher.gg](https://docs.hydralauncher.gg/getting-started)

Requisitos adicionales:

- Usa **yarn**, no npm
- Node.js compatible con Electron

```bash
git clone https://github.com/abrahampo1/hydra.git
cd hydra
yarn install
yarn dev
```

## Licencia

Hydra está licenciado bajo la [Licencia MIT](LICENSE).

## Créditos

Proyecto original: [hydralauncher/hydra](https://github.com/hydralauncher/hydra)
