# Implementation Plan: firebase-data-sync

## Overview

Plan de implementación incremental y test-driven para conectar cli-futbol-app a Cloud Firestore y sincronizar players y goalkeepers. La estrategia:

1. Aislar la lógica de dominio (dedupe, merge, decisión de seed) en un módulo **puro** `sync/data-sync.ts` sin dependencias de Angular ni Firebase, y validarlo con property-based tests (fast-check).
2. Extender `FirebaseService` con disponibilidad (`isAvailable`), detección de placeholders y CRUD de `goalkeepers` (upsert por id vía `setDoc`), verificado con unit tests sobre `FirebaseService` mockeado.
3. Elevar `GoalkeeperService` al patrón asíncrono de `PlayerService` (init async, Firestore, merge, fallback, `maxSelected = 2`).
4. Ajustar `PlayerService` para reutilizar la función pura `mergePlayers` y el flag `isAvailable`.
5. Orquestar la inicialización de ambas colecciones en `Landing.ngOnInit`.
6. Verificación final (build + test).

Convenciones para las property tests:
- Librería `fast-check`, mínimo **100 iteraciones** por propiedad (`fc.assert(fc.property(...), { numRuns: 100 })`).
- Cada test property lleva el comentario `// Feature: firebase-data-sync, Property {n}: {texto}`.
- Se corren con `ng test` (Vitest 4 + jsdom).

## Tasks

- [x] 1. Agregar fast-check como dependencia de desarrollo
  - Instalar `fast-check` como devDependency en `cli-futbol-app` (`npm install -D fast-check`)
  - Verificar que quede registrado en `package.json` bajo `devDependencies` y que `ng test` siga levantando sin errores de resolución
  - _Requirements: (habilitador de testing) 2.5, 3.2, 6.6_

- [ ] 2. Crear el módulo puro de sincronización con sus funciones y tipos
  - [x] 2.1 Definir tipos e implementar `dedupeGoalkeeperIds`
    - Crear `src/app/services/sync/data-sync.ts` importando `Player`, `Goalkeeper` de `../../models/player.model`
    - Declarar interfaces `DedupeResult` (`goalkeepers`, `reassignments: {oldId,newId,name}[]`, `duplicateIds`) y `SeedDecision<T>` (`action: 'seed' | 'merge'`, `data: T[]`)
    - Implementar `dedupeGoalkeeperIds(goalkeepers)`: la primera aparición de cada `id` conserva su id; las siguientes reciben `${id}-${n}` (n=2,3,...) incrementando n si el candidato ya existe (unicidad global); preservar `name`/`skill`/`selected`/`image`; poblar `duplicateIds` y `reassignments`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x]* 2.2 Escribir property test para el dedupe (unicidad + cardinalidad)
    - Archivo `src/app/services/sync/data-sync.spec.ts`; arbitrary de `Goalkeeper` con `id` de dominio pequeño (`fc.constantFrom('gk1','gk2','gk5')`) para forzar colisiones
    - **Property 5: El dedupe produce IDs únicos y conserva la cardinalidad** — `result.goalkeepers.length === input.length` y `new Set(ids).size === length`
    - `// Feature: firebase-data-sync, Property 5: El dedupe produce IDs únicos y conserva la cardinalidad`
    - **Validates: Requirements 3.2, 3.5**

  - [x]* 2.3 Escribir property test para el dedupe (preserva campos + reporta cambios)
    - **Property 6: El dedupe preserva los campos de dominio y reporta los cambios correctamente** — preservar por posición `name`/`skill`/`selected`/`image`; `duplicateIds` = ids que aparecían más de una vez; cada `reassignments[i]` tiene `newId !== oldId` y `newId` coincide con la posición del resultado
    - `// Feature: firebase-data-sync, Property 6: El dedupe preserva los campos de dominio y reporta los cambios correctamente`
    - **Validates: Requirements 3.1, 3.3, 3.4**

  - [x] 2.4 Implementar `mergePlayers` y `mergeGoalkeepers`
    - `mergePlayers(remote, seed)`: partir del Player remoto; si el remoto no tiene `image` y el JSON (por id) sí, asignar `image` del JSON; ídem `order`; conservar remoto cuando ya los tiene; remotos sin par en JSON quedan intactos; determinística
    - `mergeGoalkeepers(remote, seed)`: análogo preservando solo `image`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6_

  - [x]* 2.5 Escribir property test para idempotencia del merge
    - **Property 2: Idempotencia del merge** — `merge(merge(r,s),s)` deep-equals `merge(r,s)` para `mergePlayers` y `mergeGoalkeepers`
    - `// Feature: firebase-data-sync, Property 2: Idempotencia del merge`
    - **Validates: Requirements 2.5, 6.6**

  - [x]* 2.6 Escribir property test para `mergePlayers` (image/order + orden)
    - **Property 3: mergePlayers conserva estado remoto y rellena presentación desde el JSON** — conserva image/order remoto cuando existen; rellena desde JSON cuando faltan; demás campos del remoto intactos; remotos sin par intactos
    - `// Feature: firebase-data-sync, Property 3: mergePlayers conserva estado remoto y rellena presentación desde el JSON`
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [x]* 2.7 Escribir property test para `mergeGoalkeepers` (image)
    - **Property 4: mergeGoalkeepers conserva estado remoto y rellena `image` desde el JSON** — conserva `image` remoto cuando existe; rellena desde JSON cuando falta; demás campos del remoto intactos
    - `// Feature: firebase-data-sync, Property 4: mergeGoalkeepers conserva estado remoto y rellena image desde el JSON`
    - **Validates: Requirements 6.4**

  - [x] 2.8 Implementar `decideSeed` y `countSelected`
    - `decideSeed<T extends {id: string}>(remote, seedPrepared, merge)`: `remote.length === 0` ⇒ `{action:'seed', data: seedPrepared}`; en otro caso ⇒ `{action:'merge', data: merge(remote, seed)}`
    - `countSelected(goalkeepers)`: cantidad de `selected === true`
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x]* 2.9 Escribir property test para la decisión de seed vs merge
    - **Property 1: Decisión de seed vs. merge según el estado remoto** — remote vacío ⇒ `action='seed'` y `data === seedPrepared`; remote no vacío ⇒ `action='merge'` y `data` contiene todos los ids de `remote`
    - `// Feature: firebase-data-sync, Property 1: Decisión de seed vs. merge según el estado remoto`
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Extender FirebaseService con disponibilidad y CRUD de goalkeepers
  - [x] 4.1 Implementar detección de disponibilidad e init robusta
    - En `src/app/services/firebase.service.ts` agregar `readonly isAvailable: boolean` y `private hasPlaceholderConfig(config): boolean` (detecta marcadores `TU_...` sin reemplazar)
    - En el constructor: si `hasPlaceholderConfig` ⇒ `isAvailable = false`, `console.error('[FirebaseService] Config de Firebase con placeholders...')`, NO llamar `initializeApp`; si la config parece real, envolver `initializeApp`/`getFirestore` en `try/catch` y en error `isAvailable = false` + log descriptivo
    - Que las operaciones remotas existentes chequeen `isAvailable`: `getPlayers` devuelve `[]` y `savePlayer(s)`/`updatePlayer`/`deletePlayer` son no-op cuando `isAvailable === false`
    - _Requirements: 1.1, 1.4, 1.5_

  - [x] 4.2 Implementar getGoalkeepers/saveGoalkeeper/saveGoalkeepers (upsert por id)
    - `getGoalkeepers(): Promise<Goalkeeper[]>` lee la colección `goalkeepers` y reconstruye `{ ...doc.data(), id: doc.id }`; devuelve `[]` si `isAvailable === false`
    - `saveGoalkeeper(gk)`: construir data omitiendo `image` cuando es vacío/undefined y usar `setDoc(doc(db, 'goalkeepers', gk.id), data)` (upsert por id); no-op si `isAvailable === false`
    - `saveGoalkeepers(list)`: `Promise.all` de `saveGoalkeeper`
    - _Requirements: 1.3, 2.6, 4.5_

  - [x]* 4.3 Escribir unit tests de FirebaseService (mockeado, sin Firestore real)
    - Mockear `firebase/firestore` (`getFirestore`, `collection`, `getDocs`, `doc`, `setDoc`, etc.)
    - 1.1: config real ⇒ `isAvailable === true`; 1.4: placeholders ⇒ `isAvailable === false`, no lanza, `getX` devuelve `[]`, loguea; 1.5: `initializeApp` lanza ⇒ `isAvailable === false`, no lanza
    - 1.2/1.3: `getPlayers`/`getGoalkeepers`/`saveGoalkeeper(s)` invocan las APIs correctas; 2.6/4.5: `saveGoalkeeper` usa `setDoc(doc(db,'goalkeepers',gk.id),...)` (no `addDoc`)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.6, 4.5_

- [ ] 5. Elevar GoalkeeperService al patrón asíncrono (Firestore + merge + fallback)
  - [x] 5.1 Implementar initializeGoalkeepers y persist
    - En `src/app/services/goalkeeper.service.ts` inyectar `FirebaseService`, agregar guard `isInitialized`
    - `initializeGoalkeepers()`: si `isInitialized` retorna; `try` lee `remote = await getGoalkeepers()`, calcula `seedPrepared = dedupeGoalkeeperIds(goalkeepersData).goalkeepers` (loguea `duplicateIds`/`reassignments`), `decision = decideSeed(remote, seedPrepared, mergeGoalkeepers)`, persiste `decision.data` con `saveGoalkeepers` y hace `set(decision.data)`; `catch` lee `localStorage` (si hay, set) y si no `set(dedupeGoalkeeperIds(goalkeepersData).goalkeepers)`; al final `isInitialized = true`
    - `private async persist()`: escribe `localStorage` y luego `saveGoalkeeper(s)` en `try/catch` que conserva `localStorage` y loguea `[GoalkeeperService]` en fallo
    - _Requirements: 2.2, 2.4, 3.4, 4.3, 5.3, 5.4, 5.6, 6.4_

  - [x] 5.2 Convertir toggleGoalkeeper a async respetando maxSelected
    - `async toggleGoalkeeper(id)`: mantener `maxSelected = 2` (rechazar seleccionar un tercero, estado sin cambios), actualizar el signal y llamar `persist()` (localStorage + upsert Firestore)
    - Mantener firma de `canSelect(id)`
    - _Requirements: 4.1, 4.2, 4.4, 4.5_

  - [x]* 5.3 Escribir property test del invariante de máximo seleccionados
    - En `goalkeeper.service.spec.ts`, con `FirebaseService` mockeado; arbitrary de secuencia de toggles `fc.array(fc.constantFrom(...ids))`
    - **Property 7: Invariante de máximo de arqueros seleccionados** — tras cualquier secuencia de toggles `countSelected(goalkeepers()) <= 2`; seleccionar con 2 ya activos deja el estado sin cambios
    - `// Feature: firebase-data-sync, Property 7: Invariante de máximo de arqueros seleccionados`
    - **Validates: Requirements 4.4**

  - [x]* 5.4 Escribir unit tests de wiring/fallback de GoalkeeperService (mockeado)
    - 4.1/4.2/4.3: `toggleGoalkeeper` persiste vía `saveGoalkeeper` + `localStorage`; `initializeGoalkeepers` con remoto no vacío deja el signal con datos remotos mergeados
    - 5.3/5.4: lectura que rechaza ⇒ `localStorage`, y sin cache ⇒ `Seed_JSON` deduplicado; 5.6: escritura que rechaza ⇒ conserva `localStorage` y loguea
    - _Requirements: 4.1, 4.2, 4.3, 5.3, 5.4, 5.6_

- [ ] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Ajustar PlayerService para usar la función pura y el flag isAvailable
  - [x] 7.1 Reemplazar el merge inline por mergePlayers y anteponer isAvailable
    - En `src/app/services/player.service.ts` sustituir el merge inline por `mergePlayers(remote, seed)`
    - Anteponer el chequeo de `firebaseService.isAvailable` para elegir el camino de fallback antes del `try/catch`; conservar `savePlayers`, el guard `isInitialized` y el orden en el computed `players`
    - _Requirements: 5.1, 5.2, 5.5, 6.1, 6.2, 6.3, 6.5_

  - [x]* 7.2 Escribir unit tests de PlayerService (mockeado)
    - 5.1/5.2: lectura que rechaza ⇒ `localStorage`, sin cache ⇒ `Seed_JSON`; 5.5: escritura que rechaza ⇒ conserva `localStorage` y loguea
    - 6.5: tras el merge, `initializePlayers` llama `savePlayers` con el resultado mergeado
    - _Requirements: 5.1, 5.2, 5.5, 6.5_

- [ ] 8. Orquestar la inicialización en Landing
  - [x] 8.1 Inyectar GoalkeeperService y disparar ambas inicializaciones en ngOnInit
    - En `src/app/pages/landing/landing.ts` inyectar `GoalkeeperService` y en `ngOnInit` ejecutar `await Promise.all([playerService.initializePlayers(), goalkeeperService.initializeGoalkeepers()])`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 4.3_

  - [x]* 8.2 Escribir unit test de Landing (mockeado)
    - Verificar que `ngOnInit` invoca `initializePlayers` e `initializeGoalkeepers` (servicios mockeados)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 4.3_

- [x] 9. Verificación final - build + test
  - Ejecutar `ng build` (compila sin errores de tipos) y `ng test` (Vitest, corrida única) y asegurar que todas las pruebas (unit + property) pasan
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Las tareas marcadas con `*` son sub-tareas de testing (property/unit) y son opcionales; pueden omitirse para un MVP más rápido, pero cubren las 7 correctness properties y los criterios EXAMPLE/SMOKE del diseño.
- Cada tarea referencia sub-requisitos específicos y/o una propiedad del diseño para trazabilidad.
- Los checkpoints (tareas 3, 6 y 9) aseguran validación incremental.
- Toda la lógica property-based vive en funciones puras de `sync/data-sync.ts`, por lo que no se requiere un Firestore real; los servicios se prueban con `FirebaseService` mockeado.
