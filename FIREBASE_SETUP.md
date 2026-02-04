# Configuración de Firebase

## Pasos para configurar Firebase en tu aplicación

### 1. Crear un proyecto en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Haz clic en "Agregar proyecto" o "Add project"
3. Ingresa un nombre para tu proyecto (ej: "cli-futbol")
4. Sigue los pasos del asistente

### 2. Configurar Firestore Database

1. En el menú lateral, ve a "Build" > "Firestore Database"
2. Haz clic en "Crear base de datos" o "Create database"
3. Selecciona el modo de inicio:
   - **Modo de prueba**: Para desarrollo (permite lectura/escritura sin autenticación)
   - **Modo de producción**: Para producción (requiere reglas de seguridad)
4. Selecciona una ubicación (ej: us-central1)

### 3. Obtener las credenciales de Firebase

1. En Firebase Console, ve a "Configuración del proyecto" (ícono de engranaje)
2. En la sección "Tus apps", haz clic en el ícono web `</>`
3. Registra tu app con un nombre (ej: "cli-futbol-app")
4. Copia las credenciales que aparecen en `firebaseConfig`

### 4. Configurar las credenciales en tu proyecto

1. Copia el archivo de ejemplo:
   ```bash
   cp src/environments/environment.example.ts src/environments/environment.ts
   cp src/environments/environment.example.ts src/environments/environment.prod.ts
   ```

2. Edita `src/environments/environment.ts` y reemplaza los valores con tus credenciales:
   ```typescript
   export const environment = {
     production: false,
     firebase: {
       apiKey: "AIzaSy...",
       authDomain: "tu-proyecto.firebaseapp.com",
       projectId: "tu-proyecto",
       storageBucket: "tu-proyecto.appspot.com",
       messagingSenderId: "123456789",
       appId: "1:123456789:web:abcdef"
     }
   };
   ```

3. Haz lo mismo con `src/environments/environment.prod.ts` (cambia `production: true`)

### 5. Configurar reglas de seguridad de Firestore (Opcional pero recomendado)

En Firebase Console > Firestore Database > Reglas, puedes configurar reglas de seguridad:

**Para desarrollo (permite todo):**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**Para producción (más seguro):**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /players/{playerId} {
      allow read: if true;
      allow write: if true; // Aquí puedes agregar autenticación
    }
  }
}
```

### 6. Ejecutar la aplicación

```bash
npm start
```

La aplicación ahora guardará y cargará los jugadores desde Firebase Firestore.

## Estructura de datos en Firestore

Los jugadores se guardan en la colección `players` con la siguiente estructura:

```json
{
  "id": "uuid-generado",
  "name": "Nombre del jugador",
  "defense": 3,
  "creation": 3,
  "offense": 3,
  "enabled": true
}
```

## Funcionalidades implementadas

- ✅ Cargar jugadores desde Firebase al iniciar la app
- ✅ Guardar nuevos jugadores en Firebase
- ✅ Actualizar jugadores existentes
- ✅ Eliminar jugadores
- ✅ Habilitar/deshabilitar jugadores
- ✅ Fallback a localStorage si Firebase falla
- ✅ Sincronización automática con Firebase en cada cambio

## Notas importantes

- Los archivos `environment.ts` y `environment.prod.ts` están en `.gitignore` para proteger tus credenciales
- No subas estos archivos a GitHub
- Usa `environment.example.ts` como referencia para otros desarrolladores
