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
  { latitude: 4.86430, longitude: -74.03520 },
  ...
];

// Zona 2: Sector Buena Suerte (Cajicá)
export const HOME_CAJICA_POLYGON: Coordinate[] = [
  { latitude: 4.89120, longitude: -74.03400 },
  { latitude: 4.89150, longitude: -74.03175 },
  { latitude: 4.89120, longitude: -74.02950 },
  { latitude: 4.88885, longitude: -74.02920 },
  { latitude: 4.88650, longitude: -74.02950 },
  { latitude: 4.88620, longitude: -74.03175 },
  { latitude: 4.88650, longitude: -74.03400 },
  { latitude: 4.88885, longitude: -74.03430 },
  { latitude: 4.89120, longitude: -74.03400 },
];
```

### 1.3 Reglas para agregar o cambiar vértices:
1. **Obtener coordenadas exactas:** Entra a [Google Maps](https://maps.google.com), haz clic derecho sobre cualquier punto del mapa y pulsa en las coordenadas que aparecen arriba para copiarlas al portapapeles (ejemplo: `4.86154, -74.03321`).
2. **Sentido de los puntos:** Deben colocarse en orden secuencial consecutivo (en el sentido de las agujas del reloj o antihorario) para formar una figura cerrada sin cruces en "ocho".
3. **Mínimo y máximo:** Puedes tener desde 3 puntos (un triángulo) hasta 20 o más puntos. Como la función está delegada a un **Worklet en C++**, se calcula en menos de 0.05 ms sin importar la cantidad de vértices.

### 1.4 Coordenadas Centrales de Referencia
En el mismo archivo, cuentas con los puntos de referencia:
- `CAMPUS_CENTER_COORDINATE`: Universidad de La Sabana (`4.86082, -74.03264`).
- `HOME_CAJICA_CENTER`: Sector Buena Suerte, Cajicá (`4.8888463, -74.0317459`).

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
6. En tu teléfono, presiona el botón **`🔄 Actualizar`** en la esquina superior derecha del mapa: **las nuevas paradas, gimnasios y criaturas salvajes se sincronizarán al instante sin necesidad de reiniciar la app**.

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

## 3. Cómo Asignar y Gestionar Defensores en los Gimnasios

Cuando creas un gimnasio en la tabla `gymnasiums`, su campo `defending_instance_id` queda en blanco (`NULL`). En la aplicación se mostrará el mensaje *«Sin Defensor Asignado»*.

Para que un gimnasio tenga un defensor activo, dicho Pokémon debe existir en la tabla `captured_instances` vinculado al usuario de sistema guardián (`00000000-0000-0000-0000-000000000099`), con sus movimientos cargados y el 100% de sus Puntos de Salud (PS).

Tienes **tres formas muy sencillas** de asignarle un defensor a cualquier gimnasio:

---

### Método 1: Con una sola línea de SQL en Supabase (Recomendado y más rápido)

Hemos instalado la función `public.assign_gym_defender_by_name` en tu base de datos de Supabase.

1. Ve a tu panel de **[Supabase -> SQL Editor](https://supabase.com/dashboard/project/ugvoqswljfvwftoinyxt/sql)**.
2. Escribe y ejecuta una sola línea con el nombre de tu gimnasio y el Pokémon que quieras:

```sql
-- Asignar a Snorlax al gimnasio Mesón para el equipo Místico (azul):
SELECT public.assign_gym_defender_by_name('Mesón', 'Snorlax', 'mystic', 'Snorlax del Mesón');

-- O asignar a cualquier otro Pokémon (puedes usar el nombre en inglés o el ID del 1 al 151):
SELECT public.assign_gym_defender_by_name('Gimnasio Biblioteca', 'Arcanine', 'valor', 'Guardián Arcanine');
SELECT public.assign_gym_defender_by_name('Gimnasio Deportivo', 'Gengar', 'instinct', 'Fantasma del Gym');
```

> **¿Qué hace automáticamente esta función SQL?**
> 1. Busca el gimnasio por coincidencia de nombre.
> 2. Consulta la especie Pokémon (1 al 151) y calcula sus estadísticas base, IVs de guardián (14/14/15) y Puntos de Combate (CP).
> 3. Asigna automáticamente sus movimientos canónicos (un ataque rápido y un ataque cargado de la tabla `moves`).
> 4. Cura su salud al **100% de PS** (`(base_hp * 2) + iv_hp + 50`).
> 5. Lo vincula al gimnasio bajo el usuario guardián del sistema, evitando duplicados en la Pokédex personal de los jugadores.

---

### Método 2: Desde la consola con el Script de Python

Puedes usar la herramienta CLI [`scraper/assign_gym_defender.py`](file:///c:/Users/kenny/OneDrive/Documents/Cosas%20de%20movil%20que%20lo%20buguie%20todo/PokemonGoExam/PokemonGoExam/scraper/assign_gym_defender.py) desde tu terminal:

```bash
# 1. Ver todos los gimnasios y qué defensor tienen actualmente:
python scraper/assign_gym_defender.py --list

# 2. Asignar un defensor específico:
python scraper/assign_gym_defender.py --gym "Mesón" --pokemon "Snorlax" --team "mystic" --nickname "Snorlax del Mesón"

# 3. Asignar a cualquier otro gimnasio:
python scraper/assign_gym_defender.py --gym "NombreGym" --pokemon "Lapras" --team "valor"
```

Si ejecutas `python scraper/assign_gym_defender.py` sin argumentos, el script detectará automáticamente los gimnasios que no tengan defensor y te propondrá uno para asignarlo de inmediato.

---

### Método 3: En el juego conquistando el Gimnasio (Flujo del Jugador)

Cuando un jugador derrota en combate al defensor de un gimnasio:
1. El motor del juego ejecuta la función `finalize_gym_battle` en Supabase.
2. Clona automáticamente a la criatura ganadora como un guardián independiente al 100% de PS para defender el gimnasio.
3. El gimnasio cambia al color y equipo del jugador conquistador (*Valor*, *Místico* o *Instinto*).
4. El Pokémon original en la Pokédex del jugador **no sufre alteraciones ni pierde vida**.

---

## 4. Tip Pro: ¿Cómo simular el juego en tu propia casa o barrio para probar caminando?

Si deseas probar el juego caminando en la vida real pero no estás en Chía:

1. Abre Google Maps y busca tu casa o un parque cercano.
2. Copia 4 o 5 coordenadas alrededor de tu manzana o parque y reemplázalas en `UNISABANA_POLYGON` en [`src/utils/geofence.ts`](file:///c:/Users/kenny/OneDrive/Documents/Cosas%20de%20movil%20que%20lo%20buguie%20todo/PokemonGoExam/PokemonGoExam/src/utils/geofence.ts).
3. Cambia `CAMPUS_CENTER_COORDINATE` por las coordenadas de tu ubicación.
4. En Supabase, mueve 2 Poképaradas a las esquinas de tu calle.
5. **Resultado:** Al salir a caminar con la app en modo `GPS: Real`, el geofencing detectará que estás "dentro del campus" en tu propio barrio, y podrás ver cómo la flecha y las Poképaradas reaccionan a tus pasos reales.
6. Al terminar las pruebas, simplemente vuelves a restaurar las coordenadas originales de UniSabana.

