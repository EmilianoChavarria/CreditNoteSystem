# Notas Créditos Front

Frontend de gestión de notas de crédito desarrollado con Angular 21.

## Resumen

Este proyecto implementa:

- Autenticación y layout protegido por guardas.
- Dashboard con tarjetas/estadísticas y gráficas.
- Gestión de solicitudes (nueva, borradores, carga masiva).
- Módulos funcionales de pendientes, historial y notificaciones.
- Configuración administrativa (usuarios, clientes, roles, seguridad, workflows, configuración del sistema).
- Internacionalización con `@ngx-translate` (es/en).

## Stack técnico

- Angular 21 (`@angular/build` + standalone components).
- TypeScript 5.9.
- RxJS 7.
- `@ngx-translate/core` + `@ngx-translate/http-loader`.
- `lucide-angular` para iconografía.
- `ng2-charts` + `chart.js` para gráficas.
- `ngx-toastr` para notificaciones.
- `pdfmake` para generación de documentos.
- Tailwind CSS v4 (instalado en dependencias de desarrollo).
- Vitest (ejecución de pruebas unitarias vía `ng test`).

## Requisitos

- Node.js LTS reciente.
- npm 10+ (el proyecto declara `npm@10.8.1`).
- Angular CLI 21 (opcional global; puede usarse con `npx ng`).

## Inicio rápido

1. Instalar dependencias:

```bash
npm install
```

2. Levantar entorno local:

```bash
npm run start
```

3. Abrir en navegador:

```text
http://localhost:4200/
```

## Scripts disponibles

- `npm run start`: servidor de desarrollo (`ng serve`).
- `npm run build`: compilación de producción.
- `npm run watch`: build en modo observación para desarrollo.
- `npm run test`: pruebas unitarias.

## Estructura del proyecto

```text
src/
	app/
		core/
			guards/
			interceptors/
			services/
		data/
			interfaces/
		features/
			auth/
			dashboard/
			history/
			notifications/
			pending/
			requests/
			settings/
			not-found/
		shared/
			components/
			directives/
```

### Carpetas clave

- `core`: servicios base, guardas e interceptores.
- `features`: páginas y flujos por dominio funcional.
- `shared`: componentes reutilizables y directivas comunes.
- `data/interfaces`: contratos de tipos para entidades y respuestas API.
- `public/assets/i18n`: archivos de traducción `es.json` y `en.json`.

## Enrutamiento principal

- `auth/*`: acceso al flujo de autenticación (protegido con `LoginGuard`).
- `app/*`: área autenticada bajo `Layout` (protegida con `AuthGuard`).
- `app/dashboard`: inicio de la aplicación.
- `app/request/*`: flujos de solicitudes.
- `app/settings/*`: administración y parametrización.
- `app/404`: pantalla de no encontrado.

## Configuración destacada

- Bootstrapping standalone en `src/main.ts` con `bootstrapApplication`.
- Proveedores globales en `src/app/app.config.ts`:
	- `provideRouter(routes)`
	- `provideHttpClient()`
	- `TranslateModule.forRoot(...)`
	- `LucideAngularModule.pick(...)`
	- `provideCharts(withDefaultRegisterables())`
	- `provideToastr()`

## Internacionalización

- Idiomas activos: Español (`es`) e Inglés (`en`).
- Ubicación de traducciones: `public/assets/i18n/`.
- Loader personalizado: `CustomTranslateLoader` en `app.config.ts`.

## Build y calidad

- Build productivo con presupuestos configurados en `angular.json`.
- Estilo de código soportado por Prettier (configuración incluida en `package.json`).
- Ejecutar pruebas unitarias:

```bash
npm run test
```

## Notas para desarrollo

- El proyecto usa arquitectura por features y componentes standalone.
- Para agregar nuevas pantallas, mantener la convención actual en `src/app/features`.
- Para componentes compartidos, usar `src/app/shared/components`.

## Recursos

- Angular CLI Docs: https://angular.dev/tools/cli
- Angular Docs: https://angular.dev
