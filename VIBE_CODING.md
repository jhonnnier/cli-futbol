# ⚽ CLI Futbol App - Vibe Coding

## 🎯 Concepto Core

Generador inteligente de equipos de fútbol que balancea habilidades y respeta restricciones sociales. Piensa en ello como un "matchmaker" deportivo que entiende tanto las stats como las dinámicas humanas.

## 🧠 La Filosofía del Algoritmo

### Sistema de Rating Multidimensional
Cada jugador es evaluado en 3 ejes (escala 1-5 estrellas):
- **Defensa** 🛡️ - Capacidad defensiva
- **Creación** 🎯 - Visión de juego y pases
- **Ofensiva** ⚔️ - Capacidad goleadora

No es solo "buenos vs malos", es balancear perfiles complementarios.

### Algoritmo de Distribución Inteligente

```typescript
// El flow mental del algoritmo:
1. Pre-asignar jugadores que NO pueden estar juntos (restricciones sociales)
2. Ordenar restantes por skill total (DESC)
3. Distribuir minimizando el "imbalance score" en cada dimensión
4. Validar que las restricciones se cumplan
5. Retry hasta 100 veces si falla
6. Shuffle visual para que no se vea predecible
```

**Imbalance Score**: Suma de diferencias absolutas entre equipos en cada stat. Menor = mejor balance.

### Restricciones Sociales (Separated Pairs)

```typescript
separatedPairs: [string, string][] = [
  [jhonatan, jorge],    // Estos dos nunca juntos
  [edinson, camilo]     // Estos tampoco
]
```

Porque a veces el mejor equipo no es el más balanceado en papel, sino el que funciona en la cancha.

## 🏗️ Arquitectura

### Stack
- **Angular 21** (Signals-based reactivity)
- **Firebase** (Realtime persistence)
- **TypeScript** (Type safety)
- **SCSS** (Responsive mobile-first)

### Estructura de Datos

```typescript
Player {
  id: string
  name: string
  defense: 1-5      // Stats multidimensionales
  creation: 1-5
  offense: 1-5
  enabled: boolean  // Habilitado para jugar hoy
  lastToggled: timestamp
  order: number
  image?: string
}

Goalkeeper {
  id: string
  name: string
  skill: 1-5
  selected: boolean  // Max 2 seleccionados
  image?: string
}

Team {
  name: string
  players: Player[]
  goalkeeper?: Goalkeeper
  totalSkill: number
  generationId: string  // Para tracking de generaciones
}
```

## 🎮 Features Clave

### 1. **Gestión Dinámica de Roster**
- Habilitar/deshabilitar jugadores on-the-fly
- Solo los habilitados entran en el sorteo
- Persistencia en Firebase + LocalStorage (fallback)

### 2. **Sistema de Arqueros Especial**
- Pool separado de goalkeepers
- Solo 2 pueden estar seleccionados
- Se distribuyen 1 por equipo automáticamente

### 3. **Generación Iterativa**
- Botón "🎲 Repartir Equipos" puede presionarse infinitas veces
- Cada generación es única (random seed diferente)
- Scroll automático a resultados

### 4. **Visualización Tipo Formación**
```
        🧤 Arquero
    
    🛡️  🛡️  🛡️   <- Defensores
    
    🎯  🎯  🎯   <- Mediocampistas
    
    ⚔️  ⚔️  ⚔️   <- Delanteros
```
Posición asignada por stat dominante del jugador.

## 🔥 Detalles Técnicos Interesantes

### Signals Everywhere
```typescript
readonly players = computed(() => {
  // Auto-sort: enabled first, then by lastToggled, then by order
})
```
Reactive sin RxJS boilerplate. Angular 21 vibes.

### Retry Logic con Validación
```typescript
for (let attempt = 0; attempt < 100; attempt++) {
  const teams = tryGenerateTeams(allPlayers);
  if (validateTeams(teams)) return teams;  // ✅ Valid
}
// Si falla 100 veces, fuck it, retorna el último intento
```

### Dual Persistence
```typescript
async savePlayers() {
  localStorage.setItem(...)     // Instant
  await firebase.savePlayers()  // Cloud backup
}
```
Optimistic UI + cloud sync.

## 📱 Mobile-First

- Diseño responsive desde el inicio
- Touch-friendly buttons
- Floating action buttons (⚽ 🏃)
- Scroll automático a secciones relevantes

## 🎨 UX Philosophy

**Menos clicks, más fútbol:**
- No modals innecesarios
- Toggle directo de jugadores (click = enable/disable)
- Generación instantánea de equipos
- Visual feedback claro (stats, promedios, totales)

## 🚀 Deploy

```bash
npm run deploy
# → Build production + GitHub Pages deploy
```

Hosted en: `https://jhonnnier.github.io/cli-futbol/`

## 💡 El "Por Qué"

Este proyecto resuelve el problema real de "¿cómo armamos equipos justos?" en partidos casuales. No es solo random, no es solo por skill - es un balance inteligente que considera:

1. **Equidad competitiva** (balance de stats)
2. **Dinámicas sociales** (separated pairs)
3. **Disponibilidad real** (enabled/disabled)
4. **Posiciones naturales** (stat dominante)
5. **Arqueros especializados** (pool separado)

Es el tipo de herramienta que usarías antes de cada partido del domingo.

---

**TL;DR**: Smart team generator que balancea stats multidimensionales, respeta restricciones sociales, y hace que armar equipos sea un click en vez de 10 minutos de discusión.
