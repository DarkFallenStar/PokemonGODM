# Especificación Técnica (SDD): Etapa 3 - Renderizado de Mapa Nativo y Geofencing Estricto

**Estado**: En Revisión (Esperando Aprobación)  
**Fecha**: 2026-10-04  
**Autor**: Antigravity (Senior Mobile Architect) & User  
**Versión**: 1.0.0  
**Proyecto**: Pokémon GO UniSabana (Módulo 2 del Examen Práctico)  

---

## 1. Alcance y Objetivos (Scope & Objectives)

### 1.1. Contexto y Problema
El Módulo 2 del examen práctico exige restringir la experiencia jugable de manera estricta al perímetro geográfico del campus de la **Universidad de La Sabana en Chía**. La aplicación debe renderizar un mapa vectorial nativo con un estilo personalizado, orientar el avatar del jugador con la brújula digital del dispositivo, y ejecutar un algoritmo geométrico de **Punto en Polígono (Ray-Casting)** fuera del Main Thread. Si el usuario se encuentra fuera del campus, el juego congela el mapa y despliega un modal bloqueante persistente de *Fuera de Límites*.

### 1.2. Objetivos Principales
1. **Perímetro de Geofencing Estricto (UniSabana)**:
   - Delimitar un polígono cerrado de alta precisión que cubra los puntos clave del campus: Edificio Ad Portas, Puente del Común, Edificio O (Bienestar), Biblioteca Octavio Arizmendi, Canchas Deportivas y Lago.
2. **Algoritmo Matemático de Punto en Polígono (Ray-Casting en Worklet)**:
   - Implementar el algoritmo de Ray-Casting (regla par-impar) marcado con la directiva `'worklet';` de **React Native Reanimated**, garantizando que el cálculo espacial corra en el runtime de C++ sin bloquear los 60/120 FPS del hilo de interfaz de usuario (UI Thread).
3. **Gestión Óptima de Hardware (GPS y Batería)**:
   - Integrar `expo-location` (abstracción sobre `FusedLocationProviderClient` en Android y `CLLocationManager` en iOS) con una frecuencia de actualización $\ge 3$ segundos para mitigar el consumo de batería y calentamiento térmico.
4. **Orientación Espacial por Magnetómetro**:
   - Suscribir el sensor de magnetómetro (`expo-sensors`) para calcular el ángulo azimutal del usuario y rotar suavemente el avatar en el mapa según el rumbo real del jugador.
5. **Renderizado Vectorial Nativo con Mapbox (`@rnmapbox/maps`)**:
   - Visualización fluida del mapa con estilo personalizado de alto contraste/estilizado y marcadores personalizados para el jugador y los hitos del campus.
6. **Manejo de Estado Fuera de Límites (Out of Bounds)**:
   - Si las coordenadas GPS caen fuera del polígono, congelar el mapa, ocultar la generación de criaturas y renderizar un modal persistente bloqueante que impida la interacción hasta que el usuario retorne al campus.

### 1.3. Fuera de Alcance
- No se implementará la interacción con Poképaradas ni el motor de Spawning activo en el mapa en esta etapa (corresponde a la Etapa 4).
- No se activará la cámara AR en este módulo (corresponde a la Etapa 5).

---

## 2. Auditoría Topológica y Contexto de Memoria

### 2.1. Estado de Herramientas Existentes
- **`@rnmapbox/maps`**: `^10.3.5` ya presente en `package.json` y configurado como plugin en `app.json`.
- **`expo-sensors`**: `~57.0.3` instalado (provee `Magnetometer`).
- **`react-native-reanimated` & `react-native-worklets`**: `4.5.1` configurados para cómputo en segundo hilo.
- **Navegación**: [`src/screens/MapScreen.tsx`](file:///c:/Users/kenny/OneDrive/Documents/Cosas%20de%20movil%20que%20lo%20buguie%20todo/PokemonGoExam/PokemonGoExam/src/screens/MapScreen.tsx) ya montada en `BottomTabNavigator` esperando la implementación interactiva.

### 2.2. Dependencia a Instalar
- **`expo-location`**: Módulo nativo estandarizado de Expo para acceder al proveedor unificado de ubicación (`FusedLocationProviderClient` en Android / `CLLocationManager` en iOS):
  ```bash
  npx expo install expo-location
  ```

---

## 3. Delimitación del Polígono del Campus UniSabana

El polígono geográfico cerrado delimitado por coordenadas GPS de alta precisión rodea las instalaciones de la Universidad de La Sabana (Chía, Cundinamarca):

```typescript
export interface Coordinate {
  latitude: number;
  longitude: number;
}

// Coordenadas perimetrales del Campus Universidad de La Sabana
export const UNISABANA_POLYGON: Coordinate[] = [
  { latitude: 4.86430, longitude: -74.03520 }, // 1. Puente del Común (Norte)
  { latitude: 4.86310, longitude: -74.03600 }, // 2. Edificio Ad Portas (Noroeste)
  { latitude: 4.86050, longitude: -74.03550 }, // 3. Costado Occidental / Parqueaderos
  { latitude: 4.85680, longitude: -74.03620 }, // 4. Canchas Deportivas / Pistas (Suroeste)
  { latitude: 4.85620, longitude: -74.03380 }, // 5. Edificio O / Zona Río (Sur)
  { latitude: 4.85900, longitude: -74.03150 }, // 6. Zona del Lago / Costado Oriental
  { latitude: 4.86200, longitude: -74.03180 }, // 7. Biblioteca / Plazoleta Central (Noreste)
  { latitude: 4.86430, longitude: -74.03520 }, // Cierre del polígono al vértice inicial
];
```

---

## 4. Algoritmo de Geofencing: Ray-Casting en UI Worklet

### 4.1. Fundamento Matemático (Jordan Curve Theorem & Even-Odd Rule)
Para determinar si una coordenada $P(x, y)$ (donde $x = \text{longitud}$, $y = \text{latitud}$) reside dentro de un polígono cerrado arbitrario, se proyecta un rayo horizontal semi-infinito desde el punto $P$ hacia la derecha ($x \to +\infty$).
- Cada vez que el rayo cruza una arista del polígono delimitada por los vértices $V_i$ y $V_{i+1}$, se invierte un valor booleano `inside = !inside`.
- Si el número total de intersecciones es **impar**, el punto está **dentro** del polígono.
- Si el número total de intersecciones es **par**, el punto está **fuera**.

La condición de intersección para cada segmento formado por $A(x_1, y_1)$ y $B(x_2, y_2)$ es:
$$(y_1 > y) \neq (y_2 > y) \quad \land \quad x < \frac{(x_2 - x_1)(y - y_1)}{y_2 - y_1} + x_1$$

### 4.2. Implementación como Worklet (Prevención de Bloqueo del Main Thread)
El algoritmo se declara con la directiva `'worklet';` para que sea compilado por Reanimated y se ejecute en el hilo secundario (Worklet Thread en C++), cumpliendo estrictamente con la restricción del parcial:
> *"Prohibido procesar cálculos geométricos pesados en el hilo de interfaz de usuario (UI Thread)."*

```typescript
// src/utils/geofence.ts
export function isPointInPolygonWorklet(
  point: { latitude: number; longitude: number },
  polygon: { latitude: number; longitude: number }[]
): boolean {
  'worklet';
  const x = point.longitude;
  const y = point.latitude;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].longitude;
    const yi = polygon[i].latitude;
    const xj = polygon[j].longitude;
    const yj = polygon[j].latitude;

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}
```

---

## 5. Arquitectura de Sensores y Hardware

### 5.1. Listener GPS con Balance de Batería (`src/hooks/useLocationTracker.ts`)
- Utiliza `expo-location.watchPositionAsync`.
- **Configuración balanceada**:
  - `accuracy: Location.Accuracy.Balanced` (precisión de ~10 a 30 metros, evitando forzar el chipset GPS a máxima potencia en todo momento).
  - `timeInterval: 3500` ms (actualización no menor a 3 segundos, cumpliendo el requerimiento).
  - `distanceInterval: 3` metros (solo notifica si el desplazamiento es físico y perceptible).

### 5.2. Orientación por Magnetómetro (`src/hooks/useHeadingTracker.ts`)
- Suscripción a `Magnetometer.addListener(data => ...)`.
- Conversión de vector $(x, y)$ a ángulo azimutal en grados:
  $$\theta = \text{atan2}(y, x) \times \left(\frac{180}{\pi}\right)$$
  $$\text{heading} = (\theta \ge 0) \ ? \ \theta \ : \ (\theta + 360)$$
- Suavizado mediante interpolación para evitar vibraciones bruscas en el marcador del avatar.

---

## 6. Comportamiento "Fuera de Límites" (Out of Bounds Modal)

Si `isInsideGeofence === false`:
1. **Congelamiento de Mapa**: El mapa deshabilita gestos de desplazamiento y panning (`scrollEnabled={false}`, `pitchEnabled={false}`, `rotateEnabled={false}`).
2. **Suspensión de Spawns**: Se emite señal para no consultar ni renderizar criaturas.
3. **Modal Persistente Ineludible**: Se despliega una vista modal bloqueante con diseño temático de Pokémon GO:
   - Título: *"¡Fuera de Límites!"*.
   - Mensaje: *"Te encuentras fuera del campus de la Universidad de La Sabana. Dirígete a las instalaciones de la universidad para continuar tu aventura Pokémon."*.
   - Botón de reintento/verificación forzada de GPS.

---

## 7. Contratos TypeScript (`src/types/map.ts`)

```typescript
export interface CampusPOIMarker {
  id: string;
  name: string;
  type: 'pokestop' | 'gym';
  latitude: number;
  longitude: number;
}

export interface MapViewportState {
  userLocation: {
    latitude: number;
    longitude: number;
  } | null;
  heading: number; // Grados azimut (0 - 360)
  isInsideGeofence: boolean;
  isLoadingGPS: boolean;
  gpsError: string | null;
}
```

---

## 8. Criterios de Aceptación (Gherkin Syntax)

### Escenario 1: Detección Correcta Dentro del Campus
- **Given** que el usuario se encuentra en la Biblioteca Octavio Arizmendi (`4.86082, -74.03264`).
- **When** el listener de ubicación emite la posición.
- **Then** el algoritmo Ray-Casting determina `isInsideGeofence = true`, el mapa renderiza el avatar orientado por el magnetómetro y las pestañas permanecen operativas sin modales bloqueantes.

### Escenario 2: Detección Fuera de Límites (Out of Bounds)
- **Given** que las coordenadas GPS reportan una ubicación externa (ej. Bogotá D.C. `4.7110, -74.0721` o Centro Chía).
- **When** se evalúa la posición contra `UNISABANA_POLYGON`.
- **Then** `isInsideGeofence = false`, el mapa se congela y se despliega inmediatamente el modal bloqueante persistente impidiendo cualquier interacción de juego.

### Escenario 3: Conservación del Hilo Principal (Thread Safety)
- **Given** que el usuario camina continuamente y la brújula emite eventos frecuentes.
- **When** se procesan los cálculos geométricos y la rotación.
- **Then** los cálculos espaciales se delegan a worklets y el UI Thread mantiene una tasa constante de 60 FPS sin tirones (*frame drops*).

---

## 9. Plan de Archivos a Crear y Modificar

| Acción | Archivo | Responsabilidad |
|---|---|---|
| **Instalar** | `expo-location` | `npx expo install expo-location` |
| **Crear** | `src/types/map.ts` | Tipos y contratos para GPS, Brújula, Geofencing y Marcadores |
| **Crear** | `src/utils/geofence.ts` | Polígono de UniSabana y algoritmo Ray-Casting como Worklet |
| **Crear** | `src/hooks/useLocationTracker.ts` | Hook de GPS nativo con intervalo $\ge 3$s |
| **Crear** | `src/hooks/useHeadingTracker.ts` | Hook de magnetómetro con cálculo de azimut |
| **Crear** | `src/components/OutOfBoundsModal.tsx` | Componente modal bloqueante persistente |
| **Crear** | `src/components/MapAvatarMarker.tsx` | Marcador nativo del avatar con rotación dinámica |
| **Modificar** | `src/screens/MapScreen.tsx` | Integración de Mapbox, Geofencing, Marcadores y Modal |
| **Crear** | `docs/README_MODULO_3.md` | Documentación pedagógica de sustentación con 3 preguntas clave |

---

## 10. Verificación y Sincronización
- Verificación con `npx tsc --noEmit` y `npx expo lint`.
- Sincronización del grafo de arquitectura con `codebase-memory`.
- Commit y push en GitHub para la Etapa 3.
