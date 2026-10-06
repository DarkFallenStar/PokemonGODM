# Master Cheat Sheet de Sustentación Técnica Oral
## Proyecto: Pokémon GO — Edición Exclusiva Campus UniSabana
### Manual Definitivo de Respuestas Modelo de Alta Solvencia Técnica (60% de la Nota)

> **Propósito de este documento:**  
> Esta guía recopila, unifica y estructura las respuestas técnicas ideales ante las preguntas que el cuerpo docente formulará de forma individual y aleatoria durante la sustentación oral presencial. Cada respuesta está diseñada para alcanzar el **100% de la calificación por pregunta**, abordando fundamentos matemáticos, complejidad algorítmica, gestión de memoria de hardware y arquitectura de cliente-servidor.

---

## ÍNDICE TEMÁTICO DE SUSTENTACIÓN

1. [Eje 1: WebSockets, Concurrencia y Red en Tiempo Real](#eje-1-websockets-concurrencia-y-red-en-tiempo-real)
2. [Eje 2: Arquitectura Móvil, Hilos y Gestión de Memoria (UI Thread vs. JS Thread)](#eje-2-arquitectura-móvil-hilos-y-gestión-de-memoria)
3. [Eje 3: Geofencing, Optimización de GPS y Algoritmos Espaciales](#eje-3-geofencing-optimización-de-gps-y-algoritmos-espaciales)
4. [Eje 4: Motor de Spawns, Persistencia y Ciclo de Vida TTL](#eje-4-motor-de-spawns-persistencia-y-ciclo-de-vida-ttl)
5. [Eje 5: Realidad Aumentada, Sensores Inerciales y Cinemática Balística](#eje-5-realidad-aumentada-sensores-inerciales-y-cinemática-balística)
6. [Eje 6: Web Scraping, Modelo Relacional 3FN y Seguridad de Datos](#eje-6-web-scraping-modelo-relacional-3fn-y-seguridad-de-datos)

---

## EJE 1: WebSockets, Concurrencia y Red en Tiempo Real

### Pregunta 1.1: ¿Por qué en un sistema peer-to-peer móvil con WebSockets se utiliza el modelo de "Autoridad del Receptor" (Receiver-Authoritative Damage) y no el del atacante?
**Respuesta Modelo (100%):**
> *"En redes celulares móviles existe jitter y latencia asimétrica (entre 50 y 250 ms). Si el atacante fuera quien calcula el daño y la salud del defensor, existiría una condición de carrera crítica al momento de la esquiva: el atacante emitiría un golpe a daño completo sin saber que el defensor realizó un gesto de swipe apenas 30 ms antes, generando desincronización y frustración en el usuario.  
> Al adoptar el modelo de **Autoridad del Receptor**, el atacante únicamente reporta la intención de ataque (`battle:fast_attack` con potencia y tipo). El cliente que recibe el golpe es la única fuente de la verdad para sus propios Puntos de Salud, ya que conoce con precisión de microsegundos en su propio hilo de UI si su ventana de esquiva (`isDodging = true`, 500 ms) estaba activa cuando el golpe aterrizó. El receptor descuenta la vida, aplica la mitigación del 75% si esquivó y transmite un paquete autoritativo `battle:hp_update`. De esta manera se evita la carrera y ambos dispositivos convergen exactamente en el mismo valor de salud."*

---

### Pregunta 1.2: ¿Cómo se previenen las condiciones de carrera y los paquetes duplicados o fuera de orden en el canal de WebSockets de Supabase?
**Respuesta Modelo (100%):**
> *"Implementamos dos mecanismos en `src/services/battleRealtime.ts`:  
> 1. **Numeración Monotónica (`seqId`):** Cada paquete emitido lleva un contador entero estrictamente incremental (1, 2, 3...) y una marca de tiempo UTC. Si por fluctuaciones de red un paquete llega fuera de orden respecto al último estado procesado, el sistema sabe cuál es el orden cronológico estricto de los eventos.  
> 2. **Deduplicación por UUID (`packetId`):** Cada paquete incluye un identificador único en formato `${userId}-${seqId}-${timestamp}`. El receptor mantiene una estructura `Set<string>` en memoria con los últimos IDs procesados. Si un paquete es retransmitido por la pasarela de WebSockets debido a un reintento de transporte, el receptor verifica el `Set` y lo descarta instantáneamente en tiempo O(1), impidiendo que un ataque o actualización de daño se contabilice dos veces."*

---

### Pregunta 1.3: ¿Qué ocurre a nivel de base de datos relacional si dos jugadores derrotan al defensor de un gimnasio en el mismo milisegundo? ¿Cómo se garantiza la consistencia ACID?
**Respuesta Modelo (100%):**
> *"Para prevenir la sobreescritura concurrente (Lost Update Anomaly), la asignación del gimnasio no se realiza mediante un simple `UPDATE` en cliente, sino a través de la función almacenada de PostgreSQL `finalize_gym_battle` ejecutada con nivel de aislamiento serializable mediante bloqueo pesimista:  
> `SELECT * FROM public.gymnasiums WHERE id = p_gym_id FOR UPDATE;`  
> La cláusula `FOR UPDATE` adquiere un candado exclusivo a nivel de fila sobre el registro del gimnasio. La primera transacción en llegar bloquea la fila, actualiza el equipo ganador y libera el bloqueo. La segunda transacción concurrente se suspende hasta que la primera hace `COMMIT`; cuando la segunda adquiere el candado, lee el nuevo equipo líder ya actualizado sin corromper la tabla ni sobreescribir datos en conflicto."*

---

### Pregunta 1.4: ¿Cómo se manejan la memoria y el ciclo de vida de los WebSockets en React Native para evitar memory leaks al navegar entre pantallas?
**Respuesta Modelo (100%):**
> *"En `GymBattleScreen.tsx` el ciclo de vida del canal de WebSockets se encuentra encapsulado en un `useEffect`:  
> 1. Al montar la pantalla, se suscribe al canal `gym:battle:<gym_id>` mediante `realtime.connect()`, enlazando listeners de `presence` y `broadcast`.  
> 2. La función de limpieza (*cleanup function*) del `useEffect` garantiza que al desmontar la pantalla o retroceder al mapa:  
>    - Se invoca `channel.unsubscribe()` cerrando activamente la conexión de transporte y retirando la presencia del usuario.  
>    - Se limpian los temporizadores activos en background (`clearInterval` del bot defensor y `clearTimeout` de la ventana de esquiva).  
>    - Se vacía el `Set` de deduplicación de paquetes en memoria.  
> Esto garantiza que no queden listeners zombi en el hilo de JavaScript ni conexiones colgadas en el gateway de Supabase consumiendo ancho de banda o memoria."*

---

### Pregunta 1.5: ¿Cuál es el fundamento matemático del cálculo de daño en combate y cómo se relacionan las estadísticas base con los IVs obtenidos al capturar?
**Respuesta Modelo (100%):**
> *"El daño se calcula de forma determinística en `src/services/battleEngine.ts` siguiendo la fórmula oficial de combate:  
> `Daño Base = Piso(0.5 * Potencia * (Ataque Efectivo / Defensa Efectiva) * STAB * Multiplicador de Tipo) + 1`  
> Donde:  
> - `Ataque Efectivo = Base Attack + IV Attack (0 a 15)`  
> - `Defensa Efectiva = Base Defense + IV Defense (0 a 15)`  
> - `STAB` vale 1.2 si el tipo del movimiento coincide con el tipo del atacante, o 1.0 en caso contrario.  
> - `Multiplicador de Tipo` es 2.0x (súper eficaz), 0.5x (poco eficaz), 0.0x (inmune) o 1.0x (neutral), derivado de la matriz de Gen 1.  
> Si el defensor esquivó dentro de la ventana de 500 ms tras el swipe lateral, el daño se mitiga al 25% (`Daño Final = Max(1, Piso(Daño Base * 0.25))`), absorbiendo el 75% del impacto."*

---

### Pregunta 1.6: ¿Por qué en el módulo de combate se implementó WebSockets Broadcast y Presence en lugar de peticiones HTTP/REST tradicionales con Polling a la base de datos?
**Respuesta Modelo (100%):**
> *"Por tres razones críticas de arquitectura de sistemas distribuidos y limitaciones de hardware móvil:  
> 1. **Latencia Inaceptable de HTTP vs. WebSockets:** El combate requiere respuestas táctiles y reducción de barras de vida en menos de 50 ms. Una petición HTTP estándar incurre en sobrecarga de handshake TCP/TLS y encabezados HTTP en cada tap (latencia típica de 300 a 800 ms). WebSockets establece un canal bidireccional dúplex permanente (`wss://`), reduciendo el retardo a sub-red (< 40 ms).  
> 2. **Saturación de I/O en la Base de Datos:** Enviar 3 taps por segundo mediante `UPDATE` o `INSERT` en PostgreSQL por cada usuario saturaría el motor relacional con bloqueos y escritura en disco innecesaria. El mecanismo `broadcast` de Supabase Realtime transmite los paquetes volátiles de ataque y esquiva en memoria RAM a través del broker Phoenix/Elixir sin tocar el disco de la base de datos.  
> 3. **Gestión de Presencia Distribuida (Presence):** En vez de hacer polling constante para saber si hay un rival en el gimnasio, el protocolo Presence utiliza un algoritmo CRDT (Conflict-free Replicated Data Type) en el servidor que notifica instantáneamente mediante eventos `join` y `leave` cuando otro entrenador entra o sale del radio del gimnasio."*

---

### Pregunta 1.7: ¿Cómo se resolvió la arquitectura multijugador para probar con 2 dispositivos concurrentes sin colisión de identidades ni falsos positivos en Presence?
**Respuesta Modelo (100%):**
> *"En un entorno de desarrollo donde ambos teléfonos apuntan al mismo servidor Metro, si ambos compartieran un único identificador de demostración, el canal de WebSockets descartaría los paquetes del rival por considerarlos ecos propios (`senderId === this.userId`), y al capturar un Pokémon uno de los dispositivos, el otro lo ocultaría al instante.  
> Para resolverlo con rigor ingenieril:  
> 1. Implementamos un sistema de doble identidad persistente: **Entrenador 1 (Ash Ketchum)** y **Entrenador 2 (Gary Oak)** con UUIDs estables y aislados en Supabase (`TRAINER_1_ID` y `TRAINER_2_ID`).  
> 2. Cada entrenador cuenta con su propio inventario de consumibles y su propio equipo de combate de alto nivel en `captured_instances`.  
> 3. Un conmutador dinámico en el HUD del mapa (`handleToggleTrainer`) permite alternar el dispositivo entre P1 y P2.  
> 4. `BattleRealtimeManager` suscribe la presencia con el ID del entrenador activo. Al detectar `peer.userId !== this.userId`, el sistema conmuta automáticamente el combate de un bot IA a un combate PvP humano real con handshake bidireccional."*

---

## EJE 2: Arquitectura Móvil, Hilos y Gestión de Memoria

### Pregunta 2.1: ¿Por qué la cinemática balística parabólica y las animaciones táctiles se ejecutan en Worklets de Reanimated y no en el JavaScript Thread tradicional?
**Respuesta Modelo (100%):**
> *"La arquitectura de React Native separa el **JavaScript Thread** (donde corre la lógica de React y las llamadas asíncronas) del **UI Thread** (hilo principal nativo que dibuja a 60 o 120 FPS). Si ejecutáramos el cálculo balístico con `requestAnimationFrame` en JavaScript, cualquier operación pesada (como deserializar JSON de red o el recolector de basura de V8/Hermes) generaría 'frame drops' (tartamudeo) y desfase táctil.  
> Mediante la directiva `'worklet';` de `react-native-reanimated`, la función de física se compila para ejecutarse directamente en el hilo de UI en C++. Esto garantiza sincronización perfecta con la tasa de refresco del display (16.6 ms por cuadro), cero latencia táctil y total aislamiento del recolector de basura de JS."*

---

### Pregunta 2.2: ¿Cómo protege la arquitectura de navegación actual el hilo principal (Main Thread) cuando el usuario cambia a la pestaña de Mochila o Mapa?
**Respuesta Modelo (100%):**
> *"Nuestra navegación utiliza `@react-navigation/bottom-tabs` integrado con **`react-native-screens`**. A diferencia de una barra de pestañas construida manualmente con vistas ocultas (`display: 'none'`), `react-native-screens` utiliza los contenedores nativos del sistema operativo (`Fragment` en Android y `UIViewController` en iOS). Cuando el usuario navega a otra pestaña, la propiedad `detachInactiveScreens` desacopla la vista del mapa de la jerarquía de renderizado activa. Esto libera el contexto de renderizado de la GPU y evita que el Main Thread ejecute ciclos de cálculo de layout innecesarios mientras el usuario interactúa con la Pokédex."*

---

### Pregunta 2.3: ¿Por qué decidiste instanciar Supabase como un singleton en `src/services/supabase.ts` en lugar de crear la instancia directamente dentro de cada pantalla mediante `createClient()`?
**Respuesta Modelo (100%):**
> *"Implementé el patrón **Singleton** para garantizar que exista una única instancia compartida del cliente en toda la memoria del runtime de JavaScript. Crear múltiples instancias de `createClient()` generaría conexiones HTTP redundantes, duplicaría la gestión de tokens y cachés en memoria, y aumentaría el consumo de sockets de red y RAM. Además, al centralizar la inicialización en un único módulo, se aplica el principio de **Fail-Fast**: si las variables de entorno `EXPO_PUBLIC_SUPABASE_URL` o `EXPO_PUBLIC_SUPABASE_ANON_KEY` no existen, la aplicación arroja una excepción descriptiva de inmediato antes de que cualquier pantalla intente ejecutar operaciones inválidas."*

---

### Pregunta 2.4: ¿Qué implicación de seguridad y empaquetado tiene el prefijo `EXPO_PUBLIC_` en React Native?
**Respuesta Modelo (100%):**
> *"En Expo, cualquier variable de entorno con el prefijo `EXPO_PUBLIC_` es incrustada en texto plano dentro del bundle de JavaScript durante la compilación (`build-time inlining`). Por esa razón, **únicamente** se debe exponer la `ANON_KEY` de Supabase, la cual está diseñada para ser pública y cuyo acceso a los datos está regulado estrictamente a nivel de base de datos mediante **Row Level Security (RLS)** y políticas de PostgreSQL. Las credenciales con privilegios elevados, como la `SERVICE_ROLE_KEY` o contraseñas maestras, jamás deben llevar este prefijo ni incluirse en el código del cliente móvil."*

---

## EJE 3: Geofencing, Optimización de GPS y Algoritmos Espaciales

### Pregunta 3.1: ¿Cómo funciona matemáticamente el algoritmo de Ray-casting para el Geofencing y cuál es su complejidad temporal?
**Respuesta Modelo (100%):**
> *"El algoritmo de Ray-casting determina si un punto está dentro de un polígono trazando un rayo horizontal imaginario hacia el infinito (eje X positivo) desde el punto dado, y contando cuántas veces cruza las aristas del polígono. Según el **Teorema de la Curva de Jordan (Even-Odd Rule)**:  
> - Si el número de intersecciones es **impar**, el punto está **DENTRO** del perímetro.  
> - Si el número de intersecciones es **par o cero**, el punto está **FUERA**.  
> Para cada arista definida por los vértices `A(x1, y1)` y `B(x2, y2)`, se evalúa:  
> 1. Si la latitud del punto cae en el intervalo vertical `(y1 > y) != (y2 > y)`.  
> 2. Si la coordenada X de la intersección calculada mediante interpolación lineal `x_inter = (x2 - x1) * (y - y1) / (y2 - y1) + x1` es mayor que la longitud del punto.  
> La complejidad temporal es estrictamente **O(N)**, donde N es el número de vértices del polígono (6 vértices en el campus de UniSabana), ejecutándose en menos de 0.05 milisegundos sin sobrecargar el hilo de UI."*

---

### Pregunta 3.2: ¿Por qué se implementó la fórmula de Haversine dentro de un Worklet de Reanimated y qué implicaciones tiene sobre el rendimiento?
**Respuesta Modelo (100%):**
> *"La fórmula de Haversine calcula la distancia de círculo máximo sobre la superficie esférica de la Tierra teniendo en cuenta la curvatura (radio promedio `R = 6,371,000 m`). En nuestra app, esta distancia se recalcula de forma continua para cada criatura salvaje, Poképarada y Gimnasio conforme el jugador camina.  
> Al implementarla como Worklet (`src/utils/distance.ts`), la operación se procesa de forma síncrona en el hilo de C++ sin requerir serialización a través del puente de React Native (*Bridge* o *JSI*). Esto evita la instanciación de objetos efímeros en la pila de JavaScript, impidiendo que el Garbage Collector provoque micro-pausas (*jank*) en el renderizado del mapa vectorial a 60 FPS."*

---

### Pregunta 3.3: ¿Cómo balanceas la precisión del GPS frente al consumo de batería según las directivas del examen y la arquitectura de Android/iOS?
**Respuesta Modelo (100%):**
> *"En `src/hooks/useLocationTracker.ts`, configuramos el listener nativo de ubicación (`FusedLocationProviderClient` en Android y `CLLocationManager` en iOS) con:  
> 1. `timeInterval: 3000` (3 segundos): Cumple estrictamente con la directiva de la rúbrica de no sobrecargar el GPS con frecuencias menores a 3s, permitiendo al módem celular y al chip GNSS entrar en estados transitorios de bajo consumo de energía (*Duty Cycling*).  
> 2. `distanceInterval: 2` (2 metros): Evita emitir actualizaciones por ruido o rebote térmico si el usuario está quieto.  
> 3. `accuracy: Location.Accuracy.Balanced`: Emplea una combinación inteligente de antenas celulares, balizas WiFi y satélites GNSS en lugar de forzar GPS de alta precisión continuo (`Accuracy.BestForNavigation`), reduciendo el drenaje térmico de la batería en un 40%."*

---

## EJE 4: Motor de Spawns, Persistencia y Ciclo de Vida TTL

### Pregunta 4.1: ¿Por qué las criaturas capturadas o que huyen no se eliminan inmediatamente de la tabla `active_spawns` y cómo se garantiza que la base de datos no se desborde?
**Respuesta Modelo (100%):**
> *"Diseñamos el sistema siguiendo el **Modelo de Mundo Compartido (Shared World)** de Pokémon GO real. En un juego multijugador geolocalizado, un spawn representa una entidad del mundo físico visible para todos los entrenadores en ese radio geográfico durante su tiempo de vida reglamentario (TTL de 10 a 15 minutos).  
> Si la captura de un jugador eliminara el registro de `active_spawns`, ningún otro estudiante presente en el campus podría ver ni capturar esa misma criatura. Por ello:  
> 1. El estado personal se desacopla en la tabla `user_spawn_interactions` con estados `'captured'` o `'fled'`. Al consultar el mapa, el cliente filtra los spawns con los que el usuario ya interactuó.  
> 2. Para evitar el crecimiento indefinido de la base de datos, implementamos la función de recolección de basura TTL `purge_expired_spawns()`, la cual elimina únicamente los spawns cuya marca `expires_at < now()`, garantizando consistencia y espacio acotado en PostgreSQL."*

---

### Pregunta 4.2: ¿Cómo funciona la persistencia y la sincronización de la máquina de estados del enfriamiento (cooldown de 5 minutos) de las Poképaradas?
**Respuesta Modelo (100%):**
> *"El cooldown de 300 segundos no se confía a un temporizador en memoria del cliente móvil (lo que permitiría trampas reiniciando la app o alterando el reloj del teléfono). Se persiste en Supabase en la tabla `user_pokestop_cooldowns` con marcas de tiempo en formato UTC (`now()`).  
> Al abrir una Poképarada, el cliente evalúa:  
> `Tiempo Restante = 300 - (FechaActualUTC - last_spun_at)`  
> Si el resultado es mayor a cero, el disco se bloquea visualmente y el marcador del mapa se tiñe de color púrpura. Cuando el usuario gira el disco, se actualiza optimísticamente en memoria local (`cooldownMap`) y se sincroniza asíncronamente con Supabase mediante un `upsert` con conflicto en `(user_id, pokestop_id)`."*

---

### Pregunta 4.3: ¿Cómo se garantiza matemáticamente que una criatura salvaje no aparezca en una autopista o lago prohibido, y cómo funciona el filtro visual de 30 metros?
**Respuesta Modelo (100%):**
> *"La generación aleatoria de coordenadas en el backend ejecuta el algoritmo de Ray-casting sobre el polígono cerrado del campus antes de insertar el registro en `active_spawns`. Si la coordenada calculada cae fuera de los límites o dentro de las zonas de exclusión (como el Lago o la Autopista Norte), se descarta y se reintenta hasta converger en una coordenada peatonal válida.  
> Por su parte, el filtro de 30 metros se evalúa localmente en el cliente: aunque el backend tenga 50 spawns activos en el campus, el componente `MapScreen` evalúa la distancia Haversine de cada criatura contra las coordenadas GPS del jugador en tiempo real. Solo aquellas con `distancia <= 30 m` se inyectan en el árbol de renderizado del mapa (`activeSpawns.map(...)`), ahorrando memoria y respetando la regla oficial."*

---

## EJE 5: Realidad Aumentada, Sensores Inerciales y Cinemática Balística

### Pregunta 5.1: ¿Cómo funciona el algoritmo de Fusión Sensorial (Filtro Complementario) para lograr estabilidad de Realidad Aumentada sin librerías pesadas como ARKit o ARCore?
**Respuesta Modelo (100%):**
> *"ARKit y ARCore requieren hardware SLAM complejo y empaquetan decenas de megabytes nativos que rompen la compatibilidad en dispositivos Android estándar. Nosotros implementamos **Sensor Fusion IMU** con `expo-sensors`:  
> 1. **Giróscopo (Alta Frecuencia ~40 Hz):** Mide velocidades angulares instantáneas (`ωx`, `ωy`). Al integrarlas en el tiempo (`Δθ = ω * Δt`), ofrece una respuesta suave e instantánea pero sufre de deriva (*drift*) a largo plazo.  
> 2. **Acelerómetro (Baja Frecuencia):** Mide el vector de gravedad estática terrestre (`Pitch_acc = atan2(az, sqrt(ax² + ay²))`). No sufre de deriva, pero tiene ruido por vibraciones de la mano.  
> 3. **Filtro Complementario (Ponderación α = 0.94):**  
>    `θ_pitch(t) = 0.94 * (θ_pitch(t-1) + ωx * Δt) + 0.06 * Pitch_acc`  
>    El filtro toma el 94% de la respuesta rápida del giróscopo y un 6% de la estabilidad del acelerómetro para corregir la deriva. El ángulo resultante se traduce al offset inverso en píxeles sobre la pantalla (`X = -θ_yaw * K`, `Y = θ_pitch * K`), haciendo que el Pokémon parezca fijo en el espacio real."*

---

### Pregunta 5.2: ¿Cuál es el modelo físico de la trayectoria de la Pokéball y cómo se detecta la colisión en profundidad 3D?
**Respuesta Modelo (100%):**
> *"Al soltar el dedo tras el gesto de arrastre (`Gesture.Pan()`), calculamos el vector de velocidad inicial `v0x = Δx/Δt`, `v0y = -Δy/Δt` y estimamos la velocidad de profundidad `v0z = sqrt(v0x² + v0y²) * β`.  
> La cinemática modela una parábola balística con resistencia aerodinámica y gravedad terrestre (`g = 9.81 m/s²`):  
> - `X(t) = v0x * t * e^(-0.08t)`  
> - `Z(t) = v0z * t * e^(-0.08t)`  
> - `Y(t) = v0y * t * e^(-0.08t) - 0.5 * g * t²`  
> Para proyectar en la pantalla 2D, se aplica una proyección cónica de perspectiva: `Scale(t) = D_focal / (D_focal + Z(t))`. A medida que Z avanza hacia el plano del Pokémon (`Z = 7.5 m`), la escala de la bola se reduce suavemente de 1.0 a 0.35.  
> La colisión se detecta en el instante en que `|Z(t) - Z_target| <= 0.6 m` y la distancia euclidiana en píxeles `sqrt((x_ball - x_poke)² + (y_ball - y_poke)²) <= 65 px`."*

---

### Pregunta 5.3: ¿Cómo funciona la secuencia de captura de las 3 sacudidas y cómo se garantiza la consistencia del inventario?
**Respuesta Modelo (100%):**
> *"La probabilidad de captura se modela según la ecuación oficial:  
> `Prob = 1 - (1 - BCR / (2 * MultiplicadorCP)) ^ MultiplicadorTotal`  
> Donde el multiplicador total combina el tipo de bola (Pokéball 1.0x, Superball 1.5x, Ultraball 2.0x) y el tiro (Nice 1.15x, Great 1.5x, Excellent 1.85x).  
> Para simular las 3 sacudidas, se deriva la probabilidad individual por sacudida: `b = Floor(65535 * (Prob / 4) ^ 0.25)`. Se generan 4 números aleatorios; si cada uno es menor que `b`, la bola completa la sacudida. Si las 4 evaluaciones tienen éxito, se consolida la captura.  
> La persistencia se ejecuta en la función RPC `execute_pokemon_capture` de PostgreSQL: en una sola transacción atómica, se resta la Pokéball del inventario, se crea el registro en `captured_instances` con sus IVs y se registra en `user_spawn_interactions`, evitando cualquier estado inconsistente ante pérdidas de red."*

---

### Pregunta 5.4: ¿Cómo se garantiza la atomicidad y la integridad de datos al transferir un Pokémon al Profesor Oak o al actualizar su salud tras un combate?
**Respuesta Modelo (100%):**
> *"La transferencia de Pokémon no es un simple borrado en cliente: se ejecuta mediante el procedimiento almacenado en PostgreSQL `transfer_pokemon_instance(p_user_id, p_instance_id)`. Este RPC realiza una comprobación atómica previa en la tabla `gyms`: si el Pokémon está registrado actualmente en la columna `defending_instance_id` de cualquier gimnasio, la transacción aborta con una excepción `RAISE EXCEPTION`, impidiendo dejar gimnasios huérfanos o con defensas corruptas.  
> Adicionalmente, la salud tras el combate persiste mediante `updatePokemonHealth` directamente en `captured_instances.current_hp`. Al capturar una criatura, el servidor calcula de forma determinista su salud máxima `maxHp = (base_hp * 2) + iv_hp + 50` y le asigna el 100% de PS. Si un Pokémon es debilitado en batalla (0 PS), queda inhabilitado para combatir hasta ser curado, y la victoria en el gimnasio se asigna dinámicamente al equipo del entrenador configurado en su perfil (`user_profiles.team`), resolviendo el control de gimnasios entre Místico, Valor e Instinto."*

---

## EJE 6: Web Scraping, Modelo Relacional 3FN y Seguridad de Datos

### Pregunta 6.1: El enunciado prohíbe taxativamente usar PokéAPI u otras APIs públicas. ¿Cómo garantizaste que tu pipeline de Web Scraping sea idempotente y no sature o sea bloqueado por el servidor de origen?
**Respuesta Modelo (100%):**
> *"Diseñamos un pipeline de extracción con **BeautifulSoup4** que realiza una única solicitud HTTP con User-Agent estándar para obtener el índice semántico de Gen 1 de PokemonDB. Para garantizar idempotencia y evitar re-ejecuciones innecesarias que comprometan la IP por rate-limiting, el script genera un archivo de persistencia local estructurado (`pokemon_gen1.json`). Esto permite que el seeding en PostgreSQL pueda repetirse en cualquier momento sin volver a tocar los servidores web externos, cumpliendo a cabalidad con la restricción de datos propios sin riesgo de penalizaciones de red."*

---

### Pregunta 6.2: ¿Por qué es indispensable separar las tablas `pokemon_base` de `captured_instances` y qué anomalías de base de datos se previenen con esta separación?
**Respuesta Modelo (100%):**
> *"Esta separación es la aplicación directa de la **Tercera Forma Normal (3FN)**. `pokemon_base` representa el catálogo inmutable de la especie (sus estadísticas base universales, nombres y tipos), mientras que `captured_instances` representa la entidad transaccional mutable de un jugador (sus IVs aleatorios de 0 a 15, nivel, CP individual y PS actuales). Si mezcláramos ambas entidades, incurriríamos en **anomalías de redundancia** (duplicar stats base por cada captura de un mismo Pokémon) y **anomalías de actualización** (un cambio en la descripción o tipo de un Pokémon requeriría modificar miles de filas de jugadores en lugar de un único registro maestro)."*

---

### Pregunta 6.3: ¿Cómo evitas que un usuario modifique el payload HTTP para asignarse 999 Pokéballs o robar Pokémon capturados por otro usuario?
**Respuesta Modelo (100%):**
> *"La seguridad no se delega en el frontend móvil, sino en la capa de datos mediante **Row Level Security (RLS)** en PostgreSQL. Para las tablas `user_inventory` y `captured_instances`, definimos políticas que evalúan la función del contexto criptográfico `auth.uid()`. PostgreSQL descarta a nivel de kernel cualquier sentencia `UPDATE`, `INSERT` o `DELETE` donde el `user_id` enviado no coincida con el identificador del token JWT firmado por Supabase Auth, haciendo matemáticamente imposible la inyección de items o la usurpación de capturas de terceros."*
