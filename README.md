# CliFutbolApp

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.1.2.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.


# 📘 Guía para publicar un proyecto Angular en GitHub Pages

Esta guía explica paso a paso cómo publicar **un proyecto Angular moderno** en **GitHub Pages**, usando la herramienta `angular-cli-ghpages`.

---

## 🧱 Requisitos previos

* Proyecto Angular funcionando en local
* Repositorio creado en GitHub
* Node.js y Angular CLI instalados
* **Personal Access Token** de GitHub (obligatorio)

---

## 1️⃣ Verificar la estructura del build

En Angular moderno (`@angular/build:application`), el build se genera en:

```
dist/<nombre-proyecto>/browser/
```

Verifica que exista el `index.html`:

```bash
ls dist/<nombre-proyecto>/browser/index.html
```

> ⚠️ GitHub Pages **necesita que `index.html` esté en la raíz** de lo que se publique.

---

## 2️⃣ Instalar la herramienta de despliegue

Desde la raíz del proyecto:

```bash
npm install -D angular-cli-ghpages
```

---

## 3️⃣ Compilar Angular para GitHub Pages

Es **obligatorio** definir correctamente el `base-href` usando el nombre del repositorio.

```bash
ng build --base-href /NOMBRE_REPO/
```

Ejemplo:

```bash
ng build --base-href /cli-futbol/
```

---

## 4️⃣ Publicar en la rama `gh-pages`

Ejecuta el siguiente comando apuntando a la carpeta correcta (`browser`):

```bash
npx angular-cli-ghpages \
  --dir=dist/cli-futbol/browser \
  --repo=https://github.com/jhonnnier/cli-futbol.git \
  --no-history
```

Cuando se solicite autenticación:

```text
Username: jhonnnier
Password:
```

👉 **En `Password` pega tu Personal Access Token**, no tu contraseña.

---

## 5️⃣ Configurar GitHub Pages

En el repositorio de GitHub:

1. Ve a **Settings → Pages**
2. Source: `Deploy from a branch`
3. Branch: `gh-pages`
4. Folder: `/ (root)`
5. Guarda los cambios

⏱️ Espera 1–2 minutos para que se publique el sitio.

---

## 6️⃣ Acceder a la aplicación

La aplicación quedará disponible en:

```
https://USUARIO.github.io/NOMBRE_REPO/
```

Ejemplo:

```
https://jhonnnier.github.io/cli-futbol/
```

---

## 7️⃣ Manejo de rutas (Angular Router)

Si usas `RouterModule`:

* `angular-cli-ghpages` crea automáticamente un `404.html`
* Esto evita errores 404 al refrescar rutas

No se requiere configuración adicional en la mayoría de los casos.

---

## 8️⃣ Comandos finales (resumen)

```bash
ng build --base-href /cli-futbol/

npx angular-cli-ghpages \
  --dir=dist/cli-futbol/browser \
  --repo=https://github.com/jhonnnier/cli-futbol.git \
  --no-history
```

---

## 🧠 Errores comunes

❌ Publicar `dist/cli-futbol/`

✅ Publicar `dist/cli-futbol/browser/`

---

❌ Usar contraseña de GitHub

✅ Usar **Personal Access Token**

---

❌ Ver `README.md` y asumir error

✅ Esperar cache de GitHub Pages o hacer hard refresh

---

## ✅ Conclusión

Si:

* El build genera `index.html`
* GitHub Pages apunta a `gh-pages`
* Se usa correctamente el `base-href`

👉 La aplicación Angular se publicará correctamente en GitHub Pages 🚀
