# Pokémon GO - Edición Exclusiva Campus UniSabana

> **Producto Mínimo Viable (MVP)** para la Evaluación Parcial de Desarrollo Móvil.  
> Aplicación móvil multiplataforma que replica la experiencia core de Pokémon GO, restringida mediante geofencing estricto al campus de la Universidad de La Sabana.

---

## 1. Arquitectura Base y Tecnologías

- **Cliente Móvil**: React Native (TypeScript) ejecutado sobre Expo Development Builds (`EAS Build`) para soportar módulos nativos en C++, Java y Swift.
- **Backend y Base de Datos**: Supabase (PostgreSQL + Realtime WebSockets).
- **Restricción Crítica Cumplida**: **No se consumen APIs públicas preconstruidas (como PokéAPI)**. Todo el catálogo de datos opera sobre una base de datos propia.

---

## 2. Módulo 1: Pipeline de Extracción (Scraping) y Base de Datos

### Pipeline de Datos (Python + BeautifulSoup)
- **Script automatizado** (`requests` + `BeautifulSoup`) que extrae la información de los primeros 151 Pokémon directamente desde la fuente oficial [PokemonDB](https://pokemondb.net/) (HTML semántico estático).
- **Datos extraídos**:
  - Número en la Pokédex nacional
  - Nombre
  - Tipos elementales
  - Multiplicadores de daño
  - Estadísticas base: HP, Ataque, Defensa, Puntos de Combate (CP)
  - Lista de movimientos
  - Base Catch Rate (Ratio de captura base)
  - Descarga de sprites (frontales y animaciones)

### Modelo Relacional (Supabase PostgreSQL)
- **Normalización**: Esquema relacional estructurado en Tercera Forma Normal (3FN).
- **Tablas core**:
  - `pokemon_base`: Catálogo maestro de criaturas y stats base.
  - `user_inventory`: Items y consumibles por entrenador.
  - `captured_instances`: Instancias capturadas con IVs individuales (0-15), CP calculado y movimientos asignados.
  - `pokestops`: Ubicaciones fijas, radio de interacción y cooldowns.
  - `gymnasiums`: Puntos de control, líder actual y estado de combates.
- **Seguridad**: Implementación estricta de **Row Level Security (RLS)** garantizando que ningún usuario pueda manipular inventarios o capturas ajenas.

---

## 3. Módulo 2: Geofencing y Renderizado de Mapa Nativo

### Renderizado Vectorial
- Integración de **Mapbox SDK** (`@rnmapbox/maps`) para renderizar el mapa vectorial nativo con un estilo visual personalizado (simplificado/estilizado).
- Marcador de avatar propio con orientación y rotación anclada en tiempo real al **magnetómetro** del dispositivo.

### Geofencing Estricto y Concurrencia
- **Polígono Geográfico Cerrado**: Coordenadas GPS de alta precisión abarcando los puntos cardinales del campus:
  - Edificio Ad Portas
  - Puente del Común
  - Edificio O
  - Biblioteca Central
  - Canchas deportivas
  - Zona del lago
- **Worklets (React Native Reanimated)**:
  - El algoritmo matemático de punto en polígono (*Ray-casting*) se ejecuta en el hilo secundario (C++ / UI Worklet).
  - **Prohibición estricta** de procesar cálculos geométricos pesados en el hilo principal de la interfaz de usuario (UI Thread).
- **Estado Out of Bounds**:
  - Si el dispositivo sale del polígono, la UI congela el mapa, detiene de inmediato el spawning y despliega un modal bloqueante persistente.
- **Optimización GPS**:
  - Listener nativo configurado con un intervalo de muestreo no menor a 3 segundos para balancear la precisión de posicionamiento y el consumo de batería.

---

## 4. Módulo 3: Puntos de Interés y Motor de Spawning

### Poképaradas y Gimnasios
- **Ubicaciones Geolocalizadas Fijas**: Hitos emblemáticos del campus UniSabana:
  - Biblioteca Central
  - Edificio Ad Portas
  - Edificio O
  - Plazoleta Central / Kioskos
  - Complejo Deportivo
- **Mecánica**:
  - Validación de proximidad radial (< 20 metros) para habilitar interacción con el disco.
  - Al deslizar (spin), otorga consumibles e inserta un registro en Supabase con marca de tiempo UTC para validar el enfriamiento (*cooldown*) de 5 minutos.

### Spawn Engine (Backend Autónomo)
- **PostGIS + pg_cron**:
  - Extensión espacial y rutinas cron ejecutadas directamente en el motor PostgreSQL de Supabase.
  - Generación de coordenadas aleatorias validadas estrictamente dentro de la geometría poligonal del campus (`ST_Contains`).
  - Tiempo de Vida (TTL) de criaturas activas de 10 a 15 minutos.
- **Optimización de Cliente**:
  - Filtrado por distancia visual: el cliente móvil solo renderiza en pantalla las criaturas situadas a una distancia visual ≤ 30 metros.

---

## 5. Módulo 4: Modo Captura y Físicas AR

### Cámara y Realidad Aumentada Manual
- Activación de cámara en pantalla completa al entrar en encuentro.
- **Compensación Inercial sin ARCore**:
  - Procesamiento de datos crudos del giroscopio y acelerómetro (Ángulos de Euler vía `expo-sensors`).
  - Aplicación de una matriz de compensación angular al sprite 2D para estabilizar el modelo espacialmente en el visor de cámara, sin depender de librerías cerradas o cajas negras como Google ARCore / Apple ARKit.

### Física Balística y Ecuación de Captura
- **Gesto Táctil (Swipe)**: Detección y análisis del trazo para extraer vector de velocidad, ángulo de elevación y curvatura.
- **Simulación Parabólica**: Animación física de la Pokéball con aceleración por gravedad hacia el hitbox del Pokémon.
- **Círculo Concéntrico Interactivo**: Feedback dinámico de precisión (*Nice*, *Great*, *Excellent*).
- **Ecuación Probabilística de Captura**:
  - Combina: `Base Catch Rate` (de `pokemon_base`), multiplicador de precisión del tiro y tipo de Pokéball.
  - Tras captura exitosa: inserción en `captured_instances` generando aleatoriamente los Individual Values (IVs: Ataque, Defensa, Stamina de 0 a 15).

---

## 6. Módulo 5: Inventario y Combates en Tiempo Real

### Mochila y Pokédex
- **Interfaz de Cliente**:
  - Filtrado y ordenamiento de criaturas capturadas.
  - Conteo e inventario de consumibles (Pokéballs, Pociones, Revivir).
  - Visualización y comparación de estadísticas base frente a los IVs calculados del Pokémon.

### Motor de Combate (WebSockets)
- **Área de Gimnasio**: Combates disponibles exclusivamente dentro del radio geográfico del gimnasio.
- **Sincronización Bidireccional**: Vía canales en tiempo real de Supabase (`supabase.channel`).
- **Arquitectura Híbrida de Concurrencia**:
  - **Cliente-a-Cliente (Broadcast)**: Eventos de interfaz, gestos y animaciones (ataque rápido, esquiva) para latencia percibida cercana a cero.
  - **Servidor Autoritativo (PostgreSQL / RPC)**: La reducción de la barra de salud (HP) y resolución de daño es validada y persistida por mutaciones directas en la base de datos, garantizando la integridad de los Puntos de Salud frente a desincronizaciones o conflictos de red.

---

## Desarrollo & Especificaciones (SDD)
El proyecto se rige bajo **Spec-Driven Development**. Consulta la carpeta [`.specs/`](file:///c:/Users/kenny/OneDrive/Documents/Cosas%20de%20movil%20que%20lo%20buguie%20todo/PokemonGoExam/PokemonGoExam/.specs) para acceder a los contratos técnicos detallados y especificaciones formales de cada módulo antes de cualquier implementación.
