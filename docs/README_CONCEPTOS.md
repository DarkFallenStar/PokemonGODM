# Enciclopedia de Conceptos Técnicos y Arquitectura
## Proyecto: Pokémon GO — Edición Exclusiva Campus UniSabana
### Guía Fundamental de Conceptos: Qué son, Cómo funcionan por debajo y Por qué se usan

> **Propósito de este documento:**  
> Este compendio explica desde la raíz los conceptos fundamentales de ingeniería de software, arquitectura móvil, sistemas distribuidos, física computacional y bases de datos implementados en el proyecto. Está diseñado para brindar una comprensión profunda y rigurosa de cada tecnología utilizada, facilitando la sustentación técnica individual ante el cuerpo docente.

---

## ÍNDICE DE CONCEPTOS

1. [Worklets (React Native Reanimated)](#1-worklets-react-native-reanimated)
2. [Arquitectura de Hilos Móviles: UI Thread vs. JS Thread vs. Shadow Thread](#2-arquitectura-de-hilos-móviles-ui-thread-vs-js-thread-vs-shadow-thread)
3. [JSI (JavaScript Interface) y la Nueva Arquitectura de React Native](#3-jsi-javascript-interface-y-la-nueva-arquitectura-de-react-native)
4. [Geofencing y Algoritmo de Ray-Casting (Punto en Polígono)](#4-geofencing-y-algoritmo-de-ray-casting-punto-en-polígono)
5. [Fórmula de Haversine y Geometría Esférica](#5-fórmula-de-haversine-y-geometría-esférica)
6. [WebSockets: Canales Realtime, Broadcast y Protocolo de Presencia (Presence)](#6-websockets-canales-realtime-broadcast-y-protocolo-de-presencia-presence)
7. [Modelo de Daño de Autoridad del Receptor (Receiver-Authoritative Resolution)](#7-modelo-de-daño-de-autoridad-del-receptor-receiver-authoritative-resolution)
8. [Fusión Sensorial IMU (Sensor Fusion) y Filtro Complementario](#8-fusión-sensorial-imu-sensor-fusion-y-filtro-complementario)
9. [Cinemática Balística 3D y Proyección Cónica de Perspectiva](#9-cinemática-balística-3d-y-proyección-cónica-de-perspectiva)
10. [Tercera Forma Normal (3FN) y Modelo Relacional Normalizado](#10-tercera-forma-normal-3fn-y-modelo-relacional-normalizado)
11. [Seguridad a Nivel de Filas (Row Level Security - RLS) en PostgreSQL](#11-seguridad-a-nivel-de-filas-row-level-security---rls-en-postgresql)
12. [Mundo Compartido Desacoplado (Shared World State) y Ciclo de Vida TTL](#12-mundo-compartido-desacoplado-shared-world-state-y-ciclo-de-vida-ttl)
13. [Áreas Seguras (Safe Area Insets) y Diseño Edge-to-Edge](#13-áreas-seguras-safe-area-insets-y-diseño-edge-to-edge)

---

## 1. Worklets (React Native Reanimated)

### ¿Qué es un Worklet?
Un **Worklet** es una pequeña función de JavaScript que es interceptada por el compilador de Babel y empaquetada para ejecutarse **directamente dentro del hilo de renderizado nativo (UI Thread)** en un entorno de C++, en lugar de correr en el hilo tradicional de JavaScript.

Se declara simplemente colocando la directiva `'worklet';` en la primera línea de la función:

```typescript
export function calculateHaversineDistanceWorklet(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  'worklet';
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371000; // Radio de la Tierra en metros
  // Cálculo matemático ejecutado en el hilo de UI...
  return R * c;
}
```

### ¿Cómo funciona por debajo?
1. **Transpilación en Build-Time:** Durante la compilación, el plugin de Babel de Reanimated detecta la directiva `'worklet';`.
2. **Extracción y Cierre:** Toma el cuerpo de la función y genera una copia serializable junto con las variables capturadas de su entorno léxico (*closure*).
3. **Paso al Runtime de C++:** Cuando la app arranca, Reanimated inicializa un contexto secundario de JavaScript dentro del hilo nativo (UI Thread).
4. **Ejecución Síncrona a 60/120 FPS:** Cuando la pantalla dibuja un fotograma, el hilo de UI llama al Worklet de forma síncrona en memoria nativa sin necesidad de enviar mensajes a través de ningún puente asíncrono.

### ¿Por qué se usa en este proyecto?
* **Cero Caídas de Fotogramas (Frame Drops / Jank):** En el modo captura de realidad aumentada, la Pokéball vuela en una parábola mientras el usuario la lanza con el dedo. Si ese cálculo balístico corriera en el hilo común de JavaScript, cualquier operación de fondo (como recibir un paquete de red o una pausa del recolector de basura) congelaría la animación por unos milisegundos.
* **Cálculo Espacial Continuo:** Al evaluar si 15 Pokémon salvajes están a menos de 30 metros del jugador mientras camina por el campus, el cálculo de Haversine corre en un Worklet, garantizando que el mapa se actualice con fluidez absoluta a 60 cuadros por segundo.

---

## 2. Arquitectura de Hilos Móviles: UI Thread vs. JS Thread vs. Shadow Thread

### ¿Qué es la arquitectura de hilos en React Native?
A diferencia de una aplicación nativa tradicional escrita solo en Kotlin o Swift donde el desarrollador suele gestionar hilos manualmente, React Native opera dividiendo el trabajo en tres hilos fundamentales del sistema operativo:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   HILOS DE EJECUCIÓN EN LA APP                         │
├────────────────────────────────┬───────────────────────────────────────┤
│ 1. UI Thread (Main Thread)     │ Dibuja la pantalla a 60/120 Hz,       │
│                                │ procesa toques en pantalla (Touch).   │
├────────────────────────────────┼───────────────────────────────────────┤
│ 2. JavaScript Thread (Hermes)  │ Ejecuta la lógica de React, estados   │
│                                │ (useState), llamadas a Supabase y red.│
├────────────────────────────────┼───────────────────────────────────────┤
│ 3. Shadow Thread (Yoga Engine) │ Calcula el layout de CSS (Flexbox),   │
│                                │ anchos, altos y márgenes en C++.      │
└────────────────────────────────┴───────────────────────────────────────┘
```

### ¿Por qué se producen los "Frame Drops" (Tartamudeo o Jank)?
El ojo humano percibe fluidez cuando la pantalla se actualiza cada **16.6 milisegundos** (60 FPS). 
Si el **JavaScript Thread** está ocupado procesando un JSON gigante o el **Garbage Collector (GC)** detiene el hilo para limpiar objetos viejos de memoria, el hilo de JavaScript se bloquea durante 50 o 100 ms. 
* Si las animaciones dependían del hilo de JS, la animación se congela visiblemente.
* Al delegar animaciones y cinemática balística a **Worklets**, el **UI Thread** continúa dibujando a 60 FPS ininterrumpidamente sin importar qué tan ocupado esté el hilo de JavaScript.

---

## 3. JSI (JavaScript Interface) y la Nueva Arquitectura de React Native

### ¿Qué es JSI?
**JSI (JavaScript Interface)** es una capa de abstracción escrita en C++ que permite al motor de JavaScript (Hermes o V8) interactuar **directamente** con el código nativo (Java, Kotlin, Objective-C, C++) sin intermediarios.

### El Antiguo Bridge vs. JSI
* **El antiguo "Bridge" (Puente):** En versiones antiguas de React Native, cuando JavaScript quería hablar con el hardware (por ejemplo, pedir la ubicación al GPS), tenía que transformar los datos a una cadena JSON, enviarla por un túnel asíncrono, esperar a que el lado nativo la deserializara, ejecutara la acción y enviara otro JSON de vuelta. Esto introducía un cuello de botella enorme de latencia y uso de memoria.
* **Con JSI:** El motor de JavaScript tiene referencias directas a punteros de memoria de objetos C++ en memoria compartida (*Host Objects*). Las llamadas son inmediatas, síncronas y con cero sobrecarga de serialización JSON.

### ¿Por qué importa en este proyecto?
Gracias a JSI, librerías como `react-native-reanimated`, `expo-sensors` y el motor de gestos `react-native-gesture-handler` pueden leer las coordenadas del dedo y los sensores del giróscopo en tiempo real con latencia menor a 1 milisegundo.

---

## 4. Geofencing y Algoritmo de Ray-Casting (Punto en Polígono)

### ¿Qué es Geofencing?
El **Geofencing** (perímetro virtual) es una técnica geoespacial que delimita una frontera geográfica en el mundo real mediante un polígono de coordenadas de latitud y longitud. Si el dispositivo entra o sale de este polígono, el software reacciona automáticamente (en nuestro caso, bloqueando la app con una pantalla de *Fuera de Límites* si el usuario abandona el campus).

### ¿Cómo funciona el algoritmo de Ray-Casting?
Para saber si un punto `P(lat, lon)` está dentro de un polígono irregular de N vértices (como el polígono del campus de UniSabana), el algoritmo se basa en el **Teorema de la Curva de Jordan (Even-Odd Rule)**:

1. Traza un rayo imaginario horizontal que sale desde el punto `P` y se extiende hacia el infinito hacia el Este (eje X positivo).
2. Cuenta cuántas veces ese rayo cruza las aristas (fronteras) del polígono:
   * Si el número de intersecciones es **IMPAR (1, 3, 5...)**, el punto está **DENTRO** del polígono.
   * Si el número de intersecciones es **PAR o CERO (0, 2, 4...)**, el punto está **FUERA** del polígono.

```
          Frontera del Campus
         /───────────────────\
        /                     \
       /   P (Dentro)          \
──────[X]──●──────────────[X]───\────> Rayo hacia el infinito (2 cruces = fuera si fuera exterior)
        \                  |    /
         \─────────────────┴───/
```

### Fundamento Matemático
Para cada segmento entre el vértice A `(x1, y1)` y el vértice B `(x2, y2)`:
```
1. Condición vertical: ¿Cae la coordenada Y del punto entre y1 e y2?
   (y1 > y) != (y2 > y)

2. Cálculo de la intersección horizontal (X) mediante interpolación:
   x_interseccion = (x2 - x1) * (y - y1) / (y2 - y1) + x1

3. Si x < x_interseccion, el rayo cruzó la arista. Se invierte la bandera (inside = !inside).
```

### Complejidad y Rendimiento
* **Complejidad Temporal:** Estrictamente **O(N)**, donde N es la cantidad de vértices. Para el campus de UniSabana (6 vértices), el algoritmo realiza solo 6 iteraciones en menos de **0.02 milisegundos**, ejecutándose de manera imperceptible para el CPU.

---

## 5. Fórmula de Haversine y Geometría Esférica

### ¿Qué es la Fórmula de Haversine?
Es una ecuación trigonométrica que calcula la **distancia ortodrómica** (la distancia más corta sobre la superficie de una esfera) entre dos pares de coordenadas geográficas `(lat1, lon1)` y `(lat2, lon2)`.

### ¿Por qué no usar el Teorema de Pitágoras?
En un plano bidimensional euclidiano, la distancia es `sqrt((x2-x1)^2 + (y2-y1)^2)`. 
Sin embargo, **la Tierra es una esfera tridimensional**:
1. Los meridianos de longitud convergen en los polos, por lo que 1 grado de longitud en el ecuador mide ~111.32 km, pero cerca de los polos mide casi 0 km.
2. Pitágoras generaría distancias completamente distorsionadas e inválidas para comparar radios de 20 o 30 metros.

### Ecuación Matemática de Haversine
Dado el radio medio de la Tierra `R = 6,371,000 metros`:

```
Δlat = (lat2 - lat1) en radianes
Δlon = (lon2 - lon1) en radianes

a = sin²(Δlat / 2) + cos(lat1) * cos(lat2) * sin²(Δlon / 2)
c = 2 * atan2(sqrt(a), sqrt(1 - a))

Distancia = R * c
```

### Aplicación en el Proyecto
* **Poképaradas (< 20 metros):** Habilita el giro del disco para obtener consumibles.
* **Gimnasios (< 40 metros):** Habilita la entrada a la arena de combate.
* **Filtro de Aparición de Criaturas (< 30 metros):** Aunque en la base de datos existan 50 spawns en todo el campus, solo aquellos a 30 metros o menos del jugador se renderizan en el mapa.

---

## 6. WebSockets: Canales Realtime, Broadcast y Protocolo de Presencia (Presence)

### ¿Qué es un WebSocket?
Un **WebSocket** es un protocolo de red sobre TCP que establece un canal de comunicación **bidireccional, persistente y dúplex completo** entre el cliente móvil y el servidor. A diferencia de HTTP, donde el cliente debe preguntar y esperar respuesta cerrando la conexión, en un WebSocket ambos extremos pueden enviarse mensajes en cualquier momento con una latencia insignificante (< 40 ms).

### Broadcast vs. Presence vs. Postgres Changes en Supabase

En nuestro proyecto usamos Supabase Realtime (`supabase.channel`), que divide su funcionamiento en tres tecnologías especializadas:

```
┌──────────────────┬─────────────────────────────┬────────────────────────────────────┐
│ MECANISMO        │ ¿DÓNDE SE EJECUTA?          │ USO EN NUESTRO PROYECTO            │
├──────────────────┼─────────────────────────────┼────────────────────────────────────┤
│ 1. Broadcast     │ En memoria RAM del Broker   │ Ataques rápidos, ataques cargados, │
│                  │ (Phoenix/Elixir). No toca BD│ esquivas y daño en combate.        │
├──────────────────┼─────────────────────────────┼────────────────────────────────────┤
│ 2. Presence      │ Protocolo distribuido CRDT  │ Saber si otro jugador humano está  │
│                  │ sincronizado en memoria.    │ dentro del gimnasio para combatir. │
├──────────────────┼─────────────────────────────┼────────────────────────────────────┤
│ 3. Database      │ Monitorea el Write-Ahead    │ Cambios en gimnasios conquistados  │
│    Changes (WAL) │ Log (WAL) de PostgreSQL.    │ o cooldowns persistidos.           │
└──────────────────┴─────────────────────────────┴────────────────────────────────────┘
```

### ¿Por qué NO usar HTTP Polling para las batallas?
* **Sobrecarga de Red:** Enviar un ataque rápido cada 300 ms mediante peticiones HTTP `POST` obligaría a negociar encabezados y certificados TLS en cada toque, consumiendo datos móviles masivos.
* **I/O en Disco:** Si cada golpe intentara hacer un `UPDATE` en la tabla de la base de datos, el disco entraría en contención de bloqueos. **Broadcast** envía el paquete directamente a la memoria RAM del rival en menos de 40 ms.

---

## 7. Modelo de Daño de Autoridad del Receptor (Receiver-Authoritative Resolution)

### ¿Qué es la Autoridad del Receptor?
En videojuegos en red existen dos filosofías principales para resolver las acciones de combate:
1. **Autoridad del Atacante (Attacker-Authoritative):** El atacante decide si el golpe impactó y cuánta vida le quitó al defensor.
2. **Autoridad del Receptor (Receiver-Authoritative):** El atacante solo comunica su **intención de ataque** (`battle:fast_attack` con tipo y potencia). El **defensor es la única autoridad** que calcula cuánto daño recibe su propia criatura y publica su nueva salud (`battle:hp_update`).

### ¿Por qué nuestro proyecto implementa Autoridad del Receptor?
En redes móviles existe el problema del **desfase de red (Jitter/Latency)**.  
Imagina que el defensor realiza un gesto de deslizamiento (Swipe) para esquivar. La ventana de esquiva dura **500 milisegundos**.
* Si el atacante tuviera la autoridad: Su teléfono enviaría el golpe antes de enterarse de que el defensor esquivó, causando que el defensor vea un golpe completo en su pantalla a pesar de haber esquivado a tiempo (el clásico "falso impacto por lag").
* Con **Autoridad del Receptor**: Cuando el paquete de ataque llega al teléfono del defensor, este evalúa localmente en su propio hilo de ejecución:
  ```typescript
  const damageResult = calculateBattleDamage({
    rawPower,
    attackerEffectiveAttack,
    defenderEffectiveDefense: playerPokemon.stats.defense.effectiveValue,
    isDodging: isDodgingRef.current, // ¿Estaba esquivando en este milisegundo exacto?
  });
  ```
  Si estaba esquivando, mitiga el daño al 25% y le transmite su barra de vida autoritativa al rival. No hay contradicciones ni desincronización.

---

## 8. Fusión Sensorial IMU (Sensor Fusion) y Filtro Complementario

### ¿Qué es un IMU?
Una **Unidad de Medición Inercial (IMU)** es el conjunto de sensores de silicio micro-electro-mecánicos (MEMS) integrados en el teléfono móvil:
1. **Giróscopo:** Mide la velocidad angular de rotación (`rad/s`) en los ejes X, Y, Z.
2. **Acelerómetro:** Mide la aceleración total que experimenta el teléfono (`m/s²`), incluyendo el vector de gravedad terrestre.

### El Problema de usar un solo sensor
* **El Giróscopo es rápido pero sufre de Deriva (Drift):** Si integras la velocidad angular a lo largo del tiempo para calcular la posición, los pequeños errores numéricos se acumulan rápidamente. En 10 segundos, el Pokémon en Realidad Aumentada se habría desplazado flotando fuera de la pantalla.
* **El Acelerómetro no tiene deriva pero es muy Ruidoso:** Mide la gravedad estática apuntando hacia el suelo (lo que permite saber la inclinación absoluta), pero cualquier temblor involuntario de la mano introduce vibraciones de alta frecuencia que harían temblar la criatura bruscamente.

### La Solución: El Filtro Complementario (Ponderación α = 0.94)
Combina matemáticamente lo mejor de ambos sensores mediante un filtro de paso bajo (para el acelerómetro) y un filtro de paso alto (para el giróscopo):

```
Ángulo_Estimado(t) = 0.94 * (Ángulo(t-1) + Velocidad_Giroscopo * Δt) + 0.06 * Ángulo_Acelerometro
```

* El **94%** proviene del giróscopo, brindando una respuesta suave, inmediata y sin temblores.
* El **6%** proviene del acelerómetro, corrigiendo continuamente la deriva a largo plazo y anclando el horizonte hacia la gravedad de la Tierra.

---

## 9. Cinemática Balística 3D y Proyección Cónica de Perspectiva

### ¿Qué es la Cinemática Balística?
Es el modelado físico del movimiento de un proyectil (la Pokéball) en el espacio tridimensional sujeto a:
1. **Aceleración por Gravedad Terrestre:** Vector vertical constante hacia abajo (`g = 9.81 m/s²`).
2. **Resistencia Aerodinámica (Drag):** Pérdida exponencial de velocidad horizontal y de profundidad por fricción con el aire (`e^(-0.08 * t)`).

### Ecuaciones de Movimiento en el Espacio 3D
Cuando el jugador suelta el dedo tras el gesto táctil de lanzamiento (`Gesture.Pan()`), el sistema calcula la velocidad inicial en X, Y y estima la profundidad en Z:

```
X(t) = v0x * t * exp(-0.08 * t)
Z(t) = v0z * t * exp(-0.08 * t)          (Profundidad alejándose hacia el Pokémon)
Y(t) = v0y * t * exp(-0.08 * t) - 0.5 * g * t²  (Parábola balística vertical)
```

### Proyección de Perspectiva (De 3D a la Pantalla 2D)
Para que el ojo humano perciba que la bola se está alejando en el espacio hacia el fondo, aplicamos la ecuación de **cámara de proyección en perspectiva**:

```
Escala(t) = Distancia_Focal / (Distancia_Focal + Z(t))
```

A medida que `Z(t)` avanza desde `0` metros (frente a la cámara) hasta `7.5` metros (donde se encuentra el Pokémon salvaje), la escala de la bola decrece suavemente de `1.0` a `0.35`, dando una sensación natural de profundidad tridimensional sin requerir un motor pesado como Unity.

---

## 10. Tercera Forma Normal (3FN) y Modelo Relacional Normalizado

### ¿Qué es la Tercera Forma Normal (3FN)?
Es una regla estricta de diseño de bases de datos relacionales que exige:
1. **1FN:** Que cada columna contenga valores atómicos indivisibles (sin listas o arrays empaquetados en un solo campo).
2. **2FN:** Que todos los atributos no clave dependan por completo de la clave primaria.
3. **3FN:** Que **no existan dependencias transitivas** (ningún atributo no clave debe depender de otro atributo no clave).

### Aplicación en el Proyecto: `pokemon_base` vs. `captured_instances`
* **`pokemon_base` (Catálogo Maestro Inmutable):** Almacena las características universales de la especie: número en la Pokédex, nombre, tipos elementales, estadísticas base (HP base, Ataque base, Defensa base) y sprite animado.
* **`captured_instances` (Entidades Transaccionales Mutables):** Almacena la criatura individual atrapada por un jugador: su `user_id`, apodo, sus IVs individuales (0 a 15), puntos de combate (CP individual) y salud actual (`current_hp`).

### ¿Qué problemas se evitan con 3FN?
* **Cero Redundancia de Datos:** Si un jugador tiene 10 Pikachu, no se duplican 10 veces las estadísticas base ni la URL del sprite.
* **Cero Anomalías de Modificación:** Si se corrige el nombre o sprite de un Pokémon en `pokemon_base`, se actualiza en un solo lugar y se propaga automáticamente a todos los inventarios de los jugadores.

---

## 11. Seguridad a Nivel de Filas (Row Level Security - RLS) en PostgreSQL

### ¿Qué es RLS?
**Row Level Security (RLS)** es una característica de seguridad integrada directamente en el motor del kernel de PostgreSQL. A diferencia de la seguridad tradicional donde una aplicación backend filtra los datos con un `WHERE user_id = ...`, RLS aplica las reglas de autorización **a nivel de cada fila individual en la base de datos**.

### ¿Cómo opera en Supabase?
Cada solicitud enviada desde la app móvil lleva un token criptográfico JWT (*JSON Web Token*). PostgreSQL inspecciona ese token mediante la función `auth.uid()`:

```sql
CREATE POLICY "Los usuarios solo pueden modificar su propio inventario"
ON public.user_inventory
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

### ¿Por qué es crucial?
Incluso si un usuario malicioso decompilara la aplicación, interceptara la URL de Supabase y tratara de enviar una petición HTTP modificada para robar las Pokéballs o los Pokémon de otro entrenador, PostgreSQL evaluará la política y **rechazará la consulta de raíz con un error de autorización**.

---

## 12. Mundo Compartido Desacoplado (Shared World State) y Ciclo de Vida TTL

### ¿Qué es el Estado de Mundo Compartido?
Es un patrón de arquitectura distribuida donde el entorno físico virtual existe de forma **única y centralizada** para todos los participantes concurrentes. Si un Charmander aparece en la Plazoleta de los Kioskos, debe estar ubicado exactamente en esa coordenada GPS para todos los estudiantes presentes en el campus.

### Desacoplamiento de Capturas (`active_spawns` vs. `user_spawn_interactions`)
En un juego multijugador geolocalizado, la captura de una criatura por parte de un jugador **no debe hacer desaparecer al Pokémon del mundo físico** para los demás jugadores:

1. **`active_spawns` (Entidad Global):** Almacena la especie, latitud, longitud y `expires_at` (TTL de 10 a 15 minutos).
2. **`user_spawn_interactions` (Relación Personal):** Registra si el Entrenador A ya capturó esa instancia (`status = 'captured'`).
3. **Consulta en el Cliente:**
   ```sql
   SELECT s.* FROM active_spawns s
   LEFT JOIN user_spawn_interactions usi 
     ON s.id = usi.spawn_id AND usi.user_id = :current_user
   WHERE usi.id IS NULL AND s.expires_at > now();
   ```
   * Si Ash atrapa la criatura, se registra en sus interacciones y desaparece de la pantalla de Ash.
   * La criatura **permanece intacta en la base de datos**, por lo que Gary puede verla y capturarla también.

### Recolección de Basura por TTL (Time-To-Live)
Para evitar que la base de datos crezca de forma descontrolada con miles de spawns obsoletos, se ejecuta periódicamente la rutina:
```sql
DELETE FROM public.active_spawns WHERE expires_at < now();
```
Esto garantiza un consumo de almacenamiento acotado y constante a lo largo del tiempo.

---

## 13. Áreas Seguras (Safe Area Insets) y Diseño Edge-to-Edge

### ¿Qué son los Safe Area Insets?
En los teléfonos inteligentes modernos, las pantallas ya no son rectángulos planos perfectos:
* Tienen esquinas redondeadas (*rounded corners*).
* Tienen muescas (*notches*) o cámaras perforadas (*punch-holes* / Dynamic Island) en la parte superior donde se ubican la hora y la batería.
* Tienen barras de navegación por gestos (*home indicator pill*) o la barra de tres botones en la parte inferior.

Los **Safe Area Insets** son los márgenes de seguridad en píxeles que el sistema operativo (Android / iOS) reporta a la aplicación para indicar qué zonas de la pantalla están libres de solapamiento con el hardware.

```
┌──────────────────────────────────────────────┐
│  [10:45]          ( CÁMARA )        [85% 🔋] │ <── insets.top (Status Bar)
├──────────────────────────────────────────────┤
│                                              │
│             ÁREA SEGURA DE LA APP            │
│          (Botones, Textos, Listas)           │
│                                              │
├──────────────────────────────────────────────┤
│                 ───────────                  │ <── insets.bottom (Barra de Gestos)
└──────────────────────────────────────────────┘
```

### ¿Por qué se utiliza `useSafeAreaInsets` en este proyecto?
1. **Evita que la barra superior se corte:** En [`GymBattleScreen.tsx`](file:///c:/Users/kenny/OneDrive/Documents/Cosas%20de%20movil%20que%20lo%20buguie%20todo/PokemonGoExam/PokemonGoExam/src/screens/GymBattleScreen.tsx), el encabezado con el botón *✕ Salir* y el nombre del gimnasio calcula su margen con:
   ```typescript
   paddingTop: Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight : 0, 12)
   ```
   Garantizando que nunca quede oculto detrás de la cámara frontal ni de los iconos de reloj y batería.
2. **Evita que los botones queden inalcanzables:** El botón fijo de *Entrar a la Arena* y los controles de ataque cargado usan `paddingBottom: Math.max(insets.bottom, 16)`, situándose siempre por encima de la barra de navegación del teléfono.

---

### Resumen para Sustentación
Dominar estos 13 conceptos te permite responder con solvencia técnica a cualquier pregunta teórica, arquitectónica o matemática que el docente plantee durante la evaluación oral presencial. Todos los conceptos están directamente respaldados por líneas de código activas en el repositorio.
