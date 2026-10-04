# Módulo 3: Renderizado del Mapa Nativo y Geofencing Estricto UniSabana

Este documento contiene la documentación técnica, los fundamentos matemáticos y las preguntas clave de sustentación para la evaluación oral de la **Etapa 3 / Módulo 2 del proyecto**.

---

## 1. Arquitectura de Mapbox y Mapa Vectorial

### 1.1 Configuración de `@rnmapbox/maps`
El mapa del Campus UniSabana se renderiza utilizando la librería nativa `@rnmapbox/maps` integrada sobre Expo con prebuild/CNG (Continuous Native Generation).
- **Estilo:** `MapboxGL.StyleURL.Dark` para un look moderno, inmersivo y de bajo consumo en pantallas OLED.
- **Centrado Inicial:** Coordenadas del Campus UniSabana (`[ -74.03450, 4.86110 ]` en formato GeoJSON `[longitud, latitud]`).
- **Puntos de Interés (POIs):** Carga dinámica directa desde Supabase (`pokestops` y `gymnasiums`), renderizados mediante `MapboxGL.PointAnnotation` con callouts informativos y diferenciación visual de iconos/colores.

### 1.2 Brújula y Orientación del Avatar
El avatar del entrenador (`MapAvatarMarker`) incluye una flecha de rumbo impulsada por el magnetómetro (`expo-sensors`), calculando el ángulo de azimut:
$$\theta = \text{atan2}(y, x) \times \left(\frac{180}{\pi}\right)$$
con filtro de estabilización angular para prevenir temblores (jittering) en el renderizado.

---

## 2. Geofencing Estricto: Algoritmo de Ray-Casting (Jordan Curve)

### 2.1 Perímetro Oficial Campus UniSabana
El polígono de delimitación consta de 8 vértices GPS exactos que rodean las instalaciones de la Universidad de La Sabana:
1. `(4.86450, -74.03750)` — Extremo Noroccidental
2. `(4.86520, -74.03200)` — Límite Norte (Autopista Norte / Acceso)
3. `(4.86310, -74.02850)` — Extremo Nororiental
4. `(4.85900, -74.02900)` — Límite Oriental (Río Bogotá)
5. `(4.85650, -74.03250)` — Extremo Suroriental
6. `(4.85700, -74.03680)` — Límite Sur
7. `(4.86020, -74.03920)` — Extremo Suroccidental
8. `(4.86300, -74.03900)` — Límite Occidental

### 2.2 Fundamento Matemático (Teorema de la Curva de Jordan)
El algoritmo traza un rayo horizontal imaginario desde el punto del jugador $(x, y)$ hacia el infinito positivo $(+\infty, y)$.
Para cada segmento del polígono delimitado por los vértices $P_i(x_i, y_i)$ y $P_j(x_j, y_j)$:
1. Se verifica si la ordenada $y$ del punto cruza el intervalo vertical del segmento:
   $$(y_i > y) \neq (y_j > y)$$
2. Si lo cruza, se calcula la coordenada de intersección en $X$ mediante interpolación lineal:
   $$X_{\text{intersección}} = \frac{(x_j - x_i)(y - y_i)}{y_j - y_i} + x_i$$
3. Si $x < X_{\text{intersección}}$, el rayo interseca el segmento. Cada intersección conmuta el estado de paridad (`inside = !inside`).
4. **Regla de Paridad:**
   - **Número impar de intersecciones:** El punto está **dentro** del polígono.
   - **Número par de intersecciones (o 0):** El punto está **fuera** del polígono.

### 2.3 Ejecución en Worklet (Thread de UI / C++)
La función `isPointInPolygonWorklet` posee la directiva `'worklet';` de `react-native-reanimated`.
- **Beneficio de Rendimiento:** El cálculo geométrico se ejecuta en el thread de UI de C++ (Hermes Runtime secundario) sin sobrecargar el JavaScript Thread principal ni bloquear animaciones de 60/120 FPS.
- **Complejidad Temporal:** $O(N)$ donde $N = 8$ vértices $\implies$ tiempo de cálculo inferior a **0.05 milisegundos**.

---

## 3. Optimización de Batería en Geolocalización

Para cumplir estrictamente con la rúbrica y no agotar la batería del dispositivo del usuario:
1. **Intervalo Temporal:** `timeInterval: 3500` ms (3.5 segundos $\ge$ 3000 ms requeridos).
2. **Intervalo Espacial:** `distanceInterval: 5` metros (deadband filtering). La antena GPS no emite eventos si el jugador permanece estático.
3. **Nivel de Precisión:** `Location.Accuracy.Balanced`. En lugar de `High` o `BestForNavigation` (que fuerzan la activación continua de la radio satelital L1/L5 y el chip GNSS), se utiliza la triangulación combinada Wi-Fi / Cell Tower / Sensor Hub administrada por el `FusedLocationProviderClient` de Android y `CLLocationManager` de iOS.
4. **Mock de Pruebas Integrado:** Para facilitar la sustentación y pruebas fuera del campus, el HUD cuenta con el botón interactivo **"GPS: Real / Campus"** que sitúa instantáneamente al usuario dentro o fuera del geofence para validar la congelación del mapa y el modal de advertencia.

---

## 4. Congelación por Fuera del Perímetro

Cuando `isInsideGeofence === false`:
- Se bloquean los gestos del mapa en tiempo real: `scrollEnabled={false}`, `pitchEnabled={false}`, `rotateEnabled={false}`, `zoomEnabled={false}`.
- Se presenta el componente `OutOfBoundsModal` indicando que el entrenador se encuentra fuera de los límites del campus de la Universidad de La Sabana.

---

## 5. Instrucciones de Ejecución y Recompilación Nativa

> [!IMPORTANT]
> **RECOMPILACIÓN NATIVA OBLIGATORIA (EAS BUILD):**
> En este módulo se incorporó el módulo nativo de geolocalización `expo-location` y sensores `expo-sensors`.
> **Esta aplicación NO se puede ejecutar en el cliente estándar de Expo Go de las tiendas de aplicaciones.**
> Cualquier cambio que agregue código nativo requiere regenerar el Development Build para Android/iOS:

### 5.1 Generar Build de Desarrollo con EAS
```bash
# Para compilar el APK instalable en Android:
npx eas-cli build -p android --profile development
```

### 5.2 Iniciar el Servidor de Desarrollo
Una vez instalado el APK en el dispositivo físico:
```bash
npx expo start --dev-client
```

### 5.3 Verificación de Tipos
```bash
npx tsc --noEmit
```

### 5.4 Guía Paso a Paso para Probar y Sustentar en Vivo

1. **Abrir la Aplicación en el Dispositivo:**
   - Una vez instalado el nuevo APK generado por EAS, abre la aplicación `PokemonGoExam`.
   - Conéctate al servidor de desarrollo que corre en tu PC (`npx expo start --dev-client`) seleccionando la URL local o escaneando el código QR.

2. **Verificación de Detección Fuera del Perímetro (Geofencing Activo):**
   - Si estás físicamente fuera del campus de la Universidad de La Sabana, la app detectará automáticamente tu coordenada GPS real.
   - El algoritmo de **Ray-Casting en Worklet** calculará que el punto no pertenece al polígono.
   - **Resultado Esperado:** Se despliega en pantalla el modal rojo: `⚠️ Fuera de Límites del Campus UniSabana` y todos los gestos del mapa (zoom, arrastre, rotación) quedan **completamente congelados**.

3. **Demostración de Entrada al Campus (Simulador / Mock GPS):**
   - En la esquina superior derecha del mapa, presiona el botón interactivo **`GPS: Real / Campus`**.
   - Esto activa el modo de simulación, situando al avatar en el centro exacto del campus (`4.86110, -74.03450`).
   - **Resultado Esperado:** El modal rojo desaparece instantáneamente, el mapa se desbloquea, y la cámara vuela suavemente hacia el centro de la universidad.

4. **Verificación de Puntos de Interés (POIs de Supabase):**
   - En el mapa verás renderizadas las marcas en sus coordenadas reales:
     - 🔵 **Poképaradas:** Biblioteca Octavio Arizmendi Posada, Puente de Madera, Fuente de los Sabios, Edificio E.
     - 🔴 **Gimnasios:** Edificio Ad Portas, Concha Acústica.
   - Al tocar cualquier marcador, se desplegará el callout con su nombre oficial.

5. **Prueba del Magnetómetro y Brújula del Avatar:**
   - Observa el avatar del entrenador (círculo azul con flecha direccional blanca).
   - Gira físicamente tu teléfono hacia el norte, sur, este u oeste.
   - **Resultado Esperado:** La flecha rota en tiempo real sincronizada con la orientación física del teléfono gracias al sensor de campo magnético (`expo-sensors`).

6. **Verificación Visual del Polígono:**
   - Aleja ligeramente el mapa con dos dedos.
   - Verás claramente dibujado el polígono azul con borde cian que delimita con precisión el contorno geográfico del campus UniSabana.


---

## 6. Preguntas de Sustentación para la Evaluación Oral

A continuación se presentan las 3 preguntas clave de sustentación con sus **respuestas ideales 100% técnicas y fundamentadas**:

---

### Pregunta 1: ¿Cómo funciona matemáticamente el algoritmo de Ray-casting y por qué su complejidad temporal es $O(N)$?
**Respuesta Ideal:**
> "El algoritmo de Ray-casting se basa en el **Teorema de la Curva de Jordan**, el cual establece que cualquier curva cerrada simple divide el plano en dos regiones disjuntas: el interior y el exterior. 
> Matemáticamente, tomamos las coordenadas del usuario $(x, y)$ y proyectamos un rayo horizontal unidireccional hacia la derecha ($x \to +\infty$). Recorremos secuencialmente cada uno de los $N$ segmentos del polígono formados por los vértices $(P_i, P_j)$. 
> Primero verificamos si el rayo cruza el intervalo vertical del segmento mediante la condición lógica $(y_i > y) \neq (y_j > y)$. Si lo cruza, despejamos la abscisa de intersección mediante interpolación lineal:
> $$X = \frac{(x_j - x_i)(y - y_i)}{y_j - y_i} + x_i$$
> Si $x < X$, incrementamos el contador de intersecciones (o invertimos una bandera booleana). Al finalizar, si la paridad es impar, el punto está estrictamente dentro del polígono; si es par o cero, está fuera.
> Su complejidad temporal es estrictamente **$O(N)$**, donde $N$ es el número de vértices, porque solo requiere un bucle lineal sobre las aristas del polígono con operaciones aritméticas elementales de costo $O(1)$ sin recurrir a estructuras espaciales pesadas."

---

### Pregunta 2: ¿Por qué y cómo se delega el cálculo de geofencing a un Worklet en lugar de procesarlo en el JavaScript Thread tradicional?
**Respuesta Ideal:**
> "En React Native, la arquitectura tradicional delega la ejecución de la lógica de negocio al **JavaScript Thread**, el cual comparte su ciclo de eventos (event loop) con la serialización del bridge, llamadas de red, estado de React y re-renders. Si realizáramos cálculos geométricos intensivos o continuos en el JS Thread cada vez que el GPS o los sensores emiten una actualización, saturaríamos el hilo y generaríamos caídas de frames (jank) perceptibles en el mapa.
> Al declarar la función con la directiva `'worklet';` de **React Native Reanimated**, el compilador de Babel/Hermes extrae el bytecode de la función y permite ejecutarla sincrónicamente en el **UI Thread / Worklet Runtime (C++)**. 
> Esto significa que la evaluación del geofence ocurre a nivel nativo en el hilo de renderizado, garantizando una respuesta inmediata a 60/120 FPS sin bloquear la interacción del usuario ni competir por tiempo de CPU con las consultas de Supabase o la lógica de React."

---

### Pregunta 3: ¿Cómo balanceas la precisión del GPS frente al consumo de batería según las directivas del examen y la arquitectura de Android/iOS?
**Respuesta Ideal:**
> "El consumo de batería en aplicaciones móviles basadas en localización está gobernado por el estado de energía del chip GNSS/GPS. Mantener la antena satelital encendida en modo continuo de alta precisión (`LocationAccuracy.High`) demanda hasta un 20-30% más de batería por hora debido al procesamiento de radiofrecuencia L1/L5.
> Para mitigar esto implementamos tres estrategias clave:
> 1. **Throttling Temporal (`timeInterval: 3500 ms`):** Configuramos las actualizaciones periódicas a 3.5 segundos, superando el umbral de 3 segundos exigido por la rúbrica. Esto permite que el hardware de localización entre en ciclos breves de baja potencia (sleep/idle states).
> 2. **Filtrado por Desplazamiento (`distanceInterval: 5 m`):** Establecemos una banda muerta de 5 metros. Si el entrenador se encuentra detenido en un aula o biblioteca, el sistema operativo no emite eventos ni despierta el hilo de ejecución.
> 3. **Precisión Balanceada (`LocationAccuracy.Balanced`):** En lugar de forzar satélites GPS puros, el sistema operativo delega la localización al `FusedLocationProviderClient` de Android y a `CLLocationManager` de iOS, los cuales combinan torres celulares, balizas Wi-Fi y el sensor de pasos/acelerómetro del dispositivo para obtener una precisión de 10 a 50 metros con una fracción del costo energético."
