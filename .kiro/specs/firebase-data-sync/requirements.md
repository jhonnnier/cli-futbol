# Requirements Document

## Introduction

Esta feature conecta la aplicación Angular **cli-futbol-app** a **Firebase Cloud Firestore** para persistir de forma centralizada los datos de jugadores de campo (players) y arqueros (goalkeepers). Hoy los jugadores ya tienen una base de integración con Firestore (colección `players`), mientras que los arqueros funcionan únicamente contra el archivo JSON local y `localStorage`.

El objetivo es: (1) formalizar y completar la conexión a Firestore, (2) sembrar (seed) de forma idempotente los datos iniciales de `src/assets/data/players.json` y `src/assets/data/goalkeepers.json`, (3) persistir en Firestore las operaciones sobre goalkeepers al mismo nivel que players, y (4) definir el comportamiento de merge y de fallback cuando Firestore no está disponible, preservando propiedades editadas localmente y datos de presentación.

Un riesgo confirmado en los datos de origen es que `goalkeepers.json` contiene dos entradas con el mismo identificador `gk5` (los arqueros "Yonathan" y "Ricardo"), lo que rompe cualquier operación de upsert por identificador en Firestore. El seed debe detectar y corregir identificadores duplicados. Además, todo el proceso de seed debe ser idempotente para no duplicar ni sobrescribir datos ya editados en cada arranque de la aplicación.

## Glossary

- **App**: La aplicación cliente Angular cli-futbol-app.
- **Firestore**: La base de datos Cloud Firestore de Firebase usada como almacén remoto.
- **Firebase_Config**: El objeto de configuración de Firebase definido en `src/environments/environment.ts`.
- **Player**: Jugador de campo, con los campos `id`, `name`, `defense`, `creation`, `offense`, `enabled` y los opcionales `lastToggled`, `order`, `image`.
- **Goalkeeper**: Arquero, con los campos `id`, `name`, `skill`, `selected` y el opcional `image`.
- **Players_Collection**: La colección de Firestore que almacena documentos de tipo Player (colección `players`).
- **Goalkeepers_Collection**: La colección de Firestore que almacena documentos de tipo Goalkeeper (colección `goalkeepers`).
- **Firebase_Service**: El servicio Angular que encapsula el acceso a Firestore (`FirebaseService`).
- **Player_Service**: El servicio Angular que gestiona el estado de los Player (`PlayerService`).
- **Goalkeeper_Service**: El servicio Angular que gestiona el estado de los Goalkeeper (`GoalkeeperService`).
- **Seed_Process**: El proceso de sembrado inicial que carga los datos de los archivos JSON en Firestore la primera vez.
- **Seed_JSON**: Los archivos de datos iniciales `src/assets/data/players.json` y `src/assets/data/goalkeepers.json`.
- **Local_Cache**: El almacenamiento local del navegador (`localStorage`) usado como respaldo offline.
- **Local_Property**: Una propiedad de presentación o estado gestionada del lado del cliente que debe preservarse durante un merge, específicamente `image` y `order` para Player, e `image` para Goalkeeper.
- **Idempotent_Operation**: Una operación que, ejecutada una o varias veces con la misma entrada, produce el mismo estado final sin crear duplicados ni sobrescribir cambios previos del usuario.
- **Upsert**: Una operación de escritura que crea un documento si no existe o lo actualiza si ya existe, identificado por su `id`.

## Requirements

### Requirement 1: Conexión a Firebase/Firestore

**User Story:** Como desarrollador de cli-futbol-app, quiero que la aplicación se conecte a Firestore usando la configuración de entorno, para tener un almacén de datos centralizado y compartido entre dispositivos.

#### Acceptance Criteria

1. WHEN la App arranca, THE Firebase_Service SHALL inicializar la conexión a Firestore usando Firebase_Config.
2. THE Firebase_Service SHALL exponer operaciones de lectura y escritura para Players_Collection.
3. THE Firebase_Service SHALL exponer operaciones de lectura y escritura para Goalkeepers_Collection.
4. IF Firebase_Config contiene valores de marcador de posición sin reemplazar, THEN THE Firebase_Service SHALL registrar un mensaje de error descriptivo y permitir que la App continúe operando en modo local.
5. IF la inicialización de Firestore falla, THEN THE Firebase_Service SHALL registrar un mensaje de error descriptivo y permitir que la App continúe operando en modo local.

### Requirement 2: Seed idempotente de datos iniciales

**User Story:** Como usuario de cli-futbol-app, quiero que los jugadores y arqueros iniciales se carguen automáticamente en Firestore la primera vez, para no tener que ingresarlos manualmente y para no perder ni duplicar datos en arranques posteriores.

#### Acceptance Criteria

1. WHEN la App arranca y Players_Collection está vacía, THE Seed_Process SHALL escribir en Players_Collection los Player definidos en Seed_JSON.
2. WHEN la App arranca y Goalkeepers_Collection está vacía, THE Seed_Process SHALL escribir en Goalkeepers_Collection los Goalkeeper definidos en Seed_JSON.
3. WHEN la App arranca y Players_Collection contiene al menos un documento, THE Seed_Process SHALL usar los datos de Players_Collection como fuente de estado en lugar de reemplazarlos con Seed_JSON.
4. WHEN la App arranca y Goalkeepers_Collection contiene al menos un documento, THE Seed_Process SHALL usar los datos de Goalkeepers_Collection como fuente de estado en lugar de reemplazarlos con Seed_JSON.
5. THE Seed_Process SHALL ser un Idempotent_Operation para Players_Collection y para Goalkeepers_Collection.
6. WHEN el Seed_Process escribe un documento existente identificado por su `id`, THE Seed_Process SHALL realizar un Upsert por `id`.

### Requirement 3: Corrección de identificadores duplicados de arqueros

**User Story:** Como desarrollador de cli-futbol-app, quiero que el seed detecte y corrija los identificadores de arqueros duplicados presentes en el archivo de origen, para que cada arquero tenga un documento único en Firestore y las operaciones de upsert no colisionen.

#### Acceptance Criteria

1. WHEN el Seed_Process lee Seed_JSON de Goalkeeper, THE Seed_Process SHALL detectar cualquier conjunto de Goalkeeper que compartan el mismo `id`.
2. IF dos o más Goalkeeper comparten el mismo `id`, THEN THE Seed_Process SHALL asignar un `id` único a cada Goalkeeper afectado antes de escribir en Goalkeepers_Collection.
3. WHEN el Seed_Process asigna un `id` único a un Goalkeeper afectado por duplicación, THE Seed_Process SHALL preservar los campos `name`, `skill`, `selected` e `image` de ese Goalkeeper.
4. THE Seed_Process SHALL registrar el conjunto de identificadores duplicados detectados y los identificadores nuevos asignados.
5. WHEN el Seed_Process finaliza, THE Goalkeepers_Collection SHALL contener un documento por cada Goalkeeper de Seed_JSON con identificadores únicos entre sí.

### Requirement 4: Persistencia de operaciones de arqueros en Firestore

**User Story:** Como usuario de cli-futbol-app, quiero que la selección y edición de arqueros se guarden en Firestore, para que mis cambios se conserven entre sesiones y dispositivos igual que ocurre con los jugadores de campo.

#### Acceptance Criteria

1. WHEN el usuario cambia el estado `selected` de un Goalkeeper, THE Goalkeeper_Service SHALL persistir el Goalkeeper actualizado en Goalkeepers_Collection.
2. WHEN el usuario cambia el estado `selected` de un Goalkeeper, THE Goalkeeper_Service SHALL escribir el estado actualizado en Local_Cache.
3. WHEN la App arranca, THE Goalkeeper_Service SHALL cargar los Goalkeeper desde Goalkeepers_Collection como fuente de estado inicial.
4. WHILE el número de Goalkeeper con `selected` en verdadero es igual al máximo permitido, THE Goalkeeper_Service SHALL rechazar seleccionar un Goalkeeper adicional.
5. WHEN el Goalkeeper_Service persiste un cambio de un Goalkeeper, THE Goalkeeper_Service SHALL realizar un Upsert por `id`.

### Requirement 5: Estrategia de fallback ante Firestore no disponible

**User Story:** Como usuario de cli-futbol-app, quiero que la aplicación siga funcionando cuando Firestore no está disponible, para poder usar la app sin conexión y sin perder mis últimos datos conocidos.

#### Acceptance Criteria

1. IF una lectura de Players_Collection falla, THEN THE Player_Service SHALL cargar los Player desde Local_Cache.
2. IF una lectura de Players_Collection falla y Local_Cache no contiene Player, THEN THE Player_Service SHALL cargar los Player desde Seed_JSON.
3. IF una lectura de Goalkeepers_Collection falla, THEN THE Goalkeeper_Service SHALL cargar los Goalkeeper desde Local_Cache.
4. IF una lectura de Goalkeepers_Collection falla y Local_Cache no contiene Goalkeeper, THEN THE Goalkeeper_Service SHALL cargar los Goalkeeper desde Seed_JSON.
5. IF una escritura en Players_Collection falla, THEN THE Player_Service SHALL conservar el cambio en Local_Cache y registrar un mensaje de error descriptivo.
6. IF una escritura en Goalkeepers_Collection falla, THEN THE Goalkeeper_Service SHALL conservar el cambio en Local_Cache y registrar un mensaje de error descriptivo.

### Requirement 6: Merge para preservar propiedades locales

**User Story:** Como usuario de cli-futbol-app, quiero que las propiedades de presentación y orden se conserven al sincronizar con Firestore, para no perder las imágenes ni el orden de visualización configurados.

#### Acceptance Criteria

1. WHEN el Player_Service fusiona un Player de Players_Collection con su Player correspondiente de Seed_JSON, THE Player_Service SHALL conservar el valor de `image` de Players_Collection cuando ese valor está presente.
2. WHEN el Player_Service fusiona un Player de Players_Collection sin `image` con su Player correspondiente de Seed_JSON que sí tiene `image`, THE Player_Service SHALL asignar el `image` de Seed_JSON al Player fusionado.
3. WHEN el Player_Service fusiona un Player de Players_Collection sin `order` con su Player correspondiente de Seed_JSON que sí tiene `order`, THE Player_Service SHALL asignar el `order` de Seed_JSON al Player fusionado.
4. WHEN el Goalkeeper_Service fusiona un Goalkeeper de Goalkeepers_Collection sin `image` con su Goalkeeper correspondiente de Seed_JSON que sí tiene `image`, THE Goalkeeper_Service SHALL asignar el `image` de Seed_JSON al Goalkeeper fusionado.
5. WHEN el proceso de merge finaliza para Players_Collection, THE Player_Service SHALL persistir los Player fusionados en Players_Collection mediante un Idempotent_Operation.
6. FOR ALL Player y Goalkeeper, aplicar el merge de forma repetida con la misma entrada SHALL producir el mismo conjunto de documentos (propiedad de idempotencia del merge).
