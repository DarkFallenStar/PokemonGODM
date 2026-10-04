# Guía Práctica: Modificación de Límites del Geofence y Ubicación de Poképaradas / Gimnasios

Esta guía explica paso a paso cómo ajustar o redefinir el polígono perimetral del campus y cómo cambiar las coordenadas de las Poképaradas y Gimnasios.

---

## 1. Cómo Modificar los Límites del Geofence (Perímetro del Campus)

El perímetro que utiliza el algoritmo de **Ray-Casting** y que dibuja el polígono cian en Mapbox se encuentra centralizado en un solo archivo de TypeScript.

### 1.1 Archivo a Modificar
👉 [`src/utils/geofence.ts`](file:///c:/Users/kenny/OneDrive/Documents/Cosas%20de%20movil%20que%20lo%20buguie%20todo/PokemonGoExam/PokemonGoExam/src/utils/geofence.ts)

### 1.2 Estructura del Polígono (`UNISABANA_POLYGON`)
Dentro del archivo encontrarás la constante `UNISABANA_POLYGON`. Contiene los vértices en formato `{ latitude: number, longitude: number }`:

```typescript
export const UNISABANA_POLYGON: Coordinate[] = [
  { latitude: 4.86450, longitude: -74.03750 }, // Vértice 1 (Noroeste)
  { latitude: 4.86520, longitude: -74.03200 }, // Vértice 2 (Norte / Autopista)
  { latitude: 4.86310, longitude: -74.02850 }, // Vértice 3 (Noreste)
  { latitude: 4.85900, longitude: -74.02900 }, // Vértice 4 (Este / Río Bogotá)
  { latitude: 4.85650, longitude: -74.03250 }, // Vértice 5 (Sureste)
  { latitude: 4.85700, longitude: -74.03680 }, // Vértice 6 (Sur)
  { latitude: 4.86020, longitude: -74.03920 }, // Vértice 7 (Suroeste)
  { latitude: 4.86300, longitude: -74.03900 }, // Vértice 8 (Oeste)
];
```

### 1.3 Reglas para agregar o cambiar vértices:
1. **Obtener coordenadas exactas:** Entra a [Google Maps](https://maps.google.com), haz clic derecho sobre cualquier punto del mapa y pulsa en las coordenadas que aparecen arriba para copiarlas al portapapeles (ejemplo: `4.86154, -74.03321`).
2. **Sentido de los puntos:** Deben colocarse en orden secuencial consecutivo (en el sentido de las agujas del reloj o antihorario) para formar una figura cerrada sin cruces en "ocho".
3. **Mínimo y máximo:** Puedes tener desde 3 puntos (un triángulo) hasta 20 o más puntos. Como la función está delegada a un **Worklet en C++**, se calcula en menos de 0.05 ms sin importar la cantidad de vértices.

### 1.4 Coordenada Central del Campus (`CAMPUS_CENTER_COORDINATE`)
En el mismo archivo, puedes ajustar el punto central donde aterriza la cámara y donde te sitúa el botón de simulación:

```typescript
export const CAMPUS_CENTER_COORDINATE: Coordinate = {
  latitude: 4.86110,
  longitude: -74.03450,
};
```

> **Efecto Inmediato:** Al guardar `src/utils/geofence.ts`, Metro actualizará el mapa y la delimitación automáticamente sin reiniciar el servidor.

---

## 2. Cómo Modificar las Posiciones de Poképaradas y Gimnasios (POIs)

Las Poképaradas y Gimnasios **no están quemados en el código de la app**; se consumen dinámicamente desde la base de datos PostgreSQL en **Supabase** cada vez que la app abre el mapa.

Tienes dos formas muy sencillas de editarlos:

---

### Opción A: Desde el Table Editor de Supabase (Recomendada, sin código)

1. Ingresa a tu proyecto en Supabase: **[https://supabase.com/dashboard/project/ugvoqswljfvwftoinyxt](https://supabase.com/dashboard/project/ugvoqswljfvwftoinyxt)**.
2. En el menú lateral izquierdo, haz clic en **Table Editor** (icono de tabla).
3. Selecciona la tabla **`pokestops`** (para Poképaradas) o **`gymnasiums`** (para Gimnasios).
4. Verás las filas existentes:
   - Haz **doble clic** sobre la celda `latitude` o `longitude` que quieras cambiar.
   - Pega las nuevas coordenadas y presiona Enter o fuera de la celda para guardar.
5. **Para agregar una nueva Poképarada o Gimnasio:**
   - Haz clic en el botón superior verde **`Insert row`**.
   - Ingresa:
     - `name`: Nombre del lugar (ej. *«Cafetería Central»*).
     - `latitude`: Latitud decimal (ej. `4.86050`).
     - `longitude`: Longitud decimal (ej. `-74.03380`).
   - Pulsa **Save**.
6. En tu teléfono, cambia de pestaña (a *Mochila*) y vuelve al *Mapa* (o recarga la app): **las nuevas paradas aparecerán en sus nuevas posiciones inmediatamente**.

---

### Opción B: Ejecutando una Consulta SQL en Supabase

Si prefieres moverlos con precisión mediante comandos SQL:

1. Ve a la sección **SQL Editor** en el panel de Supabase.
2. Ejecuta una instrucción como esta:

```sql
-- Mover la Biblioteca a una nueva coordenada:
UPDATE pokestops 
SET latitude = 4.86150, longitude = -74.03320 
WHERE name = 'Biblioteca Octavio Arizmendi Posada';

-- Mover el Gimnasio Ad Portas:
UPDATE gymnasiums 
SET latitude = 4.86380, longitude = -74.03210 
WHERE name = 'Edificio Ad Portas';
```

---

## 3. Tip Pro: ¿Cómo simular el juego en tu propia casa o barrio para probar caminando?

Si deseas probar el juego caminando en la vida real pero no estás en Chía:

1. Abre Google Maps y busca tu casa o un parque cercano.
2. Copia 4 o 5 coordenadas alrededor de tu manzana o parque y reemplázalas en `UNISABANA_POLYGON` en [`src/utils/geofence.ts`](file:///c:/Users/kenny/OneDrive/Documents/Cosas%20de%20movil%20que%20lo%20buguie%20todo/PokemonGoExam/PokemonGoExam/src/utils/geofence.ts).
3. Cambia `CAMPUS_CENTER_COORDINATE` por las coordenadas de tu ubicación.
4. En Supabase, mueve 2 Poképaradas a las esquinas de tu calle.
5. **Resultado:** Al salir a caminar con la app en modo `GPS: Real`, el geofencing detectará que estás "dentro del campus" en tu propio barrio, y podrás ver cómo la flecha y las Poképaradas reaccionan a tus pasos reales.
6. Al terminar las pruebas, simplemente vuelves a restaurar las coordenadas originales de UniSabana.
