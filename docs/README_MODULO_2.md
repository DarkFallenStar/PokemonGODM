# Guía de Sustentación Técnica: Etapa 2 - Web Scraping y Seeding en Supabase

**Proyecto**: Pokémon GO UniSabana  
**Módulo**: Etapa 2 (Módulo 1 del PDF: Extracción de Datos sin APIs de terceros y Modelo Relacional 3FN)  
**Tecnologías**: Python 3, BeautifulSoup4, Requests, Pydantic, PostgreSQL (Supabase), Row Level Security (RLS)  

---

## 1. ¿Qué se implementó a nivel de código?

1. **Pipeline de Extracción Automatizada (`scraper/parser.py`)**:
   - Extracción directa desde [PokemonDB](https://pokemondb.net/pokedex/all) mediante `requests` y `BeautifulSoup4`.
   - Filtrado estricto para los 151 Pokémon de la Generación 1 (Kanto, #1 Bulbasaur a #151 Mew), discriminando formas alternas o Megaevoluciones.
   - Extracción de atributos completos: Estadísticas base (HP, Ataque, Defensa, Sp. Atk, Sp. Def, Speed), tipos primario y secundario, y cálculo del Combat Power base (`base_cp`).
   - Extracción de enlaces de sprites estáticos oficiales y **GIFs animados de batalla (Showdown/Gen 5)**.

2. **Validación Estricta de Esquemas (`scraper/models.py`)**:
   - Modelado de datos con **Pydantic** (`PokemonScrapedModel`, `PokemonTypeModel`, `MoveModel`), asegurando integridad de tipos y validación de rangos numéricos antes de persistir.

3. **Esquema Relacional en Tercera Forma Normal (`scraper/schema.sql`)**:
   - Tablas normalizadas en PostgreSQL:
     - `types`: Catálogo maestro de los 18 tipos elementales y sus códigos cromáticos HEX.
     - `type_effectiveness`: Matriz de multiplicadores de daño (0.0, 0.5, 1.0, 2.0).
     - `moves`: Catálogo de movimientos rápidos y cargados.
     - `pokemon_base`: Los 151 Pokémon con claves foráneas hacia sus tipos, URLs de sprites y animaciones.
     - `pokemon_moves`: Tabla asociativa N:M entre criaturas y movimientos.
     - `user_inventory`: Items por entrenador con restricción única `(user_id, item_type)`.
     - `captured_instances`: Instancias capturadas con IVs aleatorios (0 a 15), HP actual y CP calculado.
     - `pokestops` y `gymnasiums`: Hitos geolocalizados del Campus Universidad de La Sabana.

4. **Políticas de Seguridad en Base de Datos (Row Level Security - RLS)**:
   - Catálogos (`pokemon_base`, `types`, `moves`, `pokestops`, `gymnasiums`) abiertos a lectura pública para permitir que la app móvil consuma la información.
   - Aislamiento estricto en `user_inventory` y `captured_instances`: solo el usuario autenticado (`auth.uid() = user_id`) puede ver, insertar o modificar sus propios registros.

5. **Contratos TypeScript para la App Móvil (`src/types/pokemon.ts`)**:
   - Mapeo 1:1 de las entidades de la base de datos a interfaces de TypeScript listas para la Mochila y la Pokédex.

---

## 2. Fundamentos Técnicos y Algoritmos Complejos

### A. Justificación de Tercera Forma Normal (3FN)
- **1FN**: Cada celda almacena un valor atómico (los tipos no se guardan como cadenas concatenadas `"Planta, Veneno"`, sino mediante relaciones de clave foránea `type_primary_id` y `type_secondary_id`).
- **2FN**: Cumple 1FN y todos los atributos no clave dependen funcionalmente de la clave primaria completa (evitando dependencias parciales en tablas asociativas como `pokemon_moves`).
- **3FN**: No existen dependencias transitivas; los atributos de un tipo elemental (como su color HEX) o de un movimiento (como su poder y duración) residen en sus propias tablas maestras y no se repiten en `pokemon_base`.

### B. Algoritmo Matemático de Puntos de Combate (CP Formula)
El cálculo de CP implementado en `PokemonScrapedModel.calculate_cp` y en la base de datos replica la ecuación matemática oficial de Pokémon GO:

$$\text{CP} = \max\left(10, \left\lfloor \frac{(\text{Base Atk} + \text{IV}_{\text{Atk}}) \times \sqrt{\text{Base Def} + \text{IV}_{\text{Def}}} \times \sqrt{\text{Base HP} + \text{IV}_{\text{HP}}}}{10} \right\rfloor\right)$$

- Para `pokemon_base`, los IVs son 0 para reflejar el CP base de la especie.
- Para cada instancia capturada (`captured_instances`), el motor asigna tres enteros independientes $\text{IV} \in [0, 15]$, generando variación estadística real entre ejemplares de la misma especie.

---

## 3. Preguntas de Sustentación Técnica (100% de Calificación)

### Pregunta 1:
> *"El enunciado prohíbe taxativamente usar PokéAPI u otras APIs públicas. ¿Cómo garantizaste que tu pipeline de Web Scraping sea idempotente y no sature o sea bloqueado por el servidor de origen?"*

**Respuesta Ideal:**
> *"Diseñamos un pipeline de extracción con **BeautifulSoup4** que realiza una única solicitud HTTP con User-Agent estándar para obtener el índice semántico de Gen 1 de PokemonDB. Para garantizar idempotencia y evitar re-ejecuciones innecesarias que comprometan la IP por rate-limiting, el script genera un archivo de persistencia local estructurado (`pokemon_gen1.json`). Esto permite que el seeding en PostgreSQL pueda repetirse en cualquier momento sin volver a tocar los servidores web externos, cumpliendo a cabalidad con la restricción de datos propios sin riesgo de penalizaciones de red."*

---

### Pregunta 2:
> *"¿Por qué es indispensable separar las tablas `pokemon_base` de `captured_instances` y qué anomalías de base de datos se previenen con esta separación?"*

**Respuesta Ideal:**
> *"Esta separación es la aplicación directa de la **Tercera Forma Normal (3FN)**. `pokemon_base` representa el catálogo inmutable de la especie (sus estadísticas base universales, nombres y tipos), mientras que `captured_instances` representa la entidad transaccional mutable de un jugador (sus IVs aleatorios de 0 a 15, nivel, CP individual y HP actual). Si mezcláramos ambas entidades, incurriríamos en **anomalías de redundancia** (duplicar stats base por cada captura de un mismo Pokémon) y **anomalías de actualización** (un cambio en la descripción o tipo de un Pokémon requeriría modificar miles de filas de jugadores en lugar de un único registro maestro)."*

---

### Pregunta 3:
> *"¿Cómo evitas que un usuario modifique el payload HTTP para asignarse 999 Pokéballs o robar Pokémon capturados por otro usuario?"*

**Respuesta Ideal:**
> *"La seguridad no se delega en el frontend móvil, sino en la capa de datos mediante **Row Level Security (RLS)** en PostgreSQL. Para las tablas `user_inventory` y `captured_instances`, definimos políticas que evalúan la función del contexto criptográfico `auth.uid()`. PostgreSQL descarta a nivel de kernel cualquier sentencia `UPDATE`, `INSERT` o `DELETE` donde el `user_id` enviado no coincida con el identificador del token JWT firmado por Supabase Auth, haciendo matemáticamente imposible la inyección de items o la usurpación de capturas de terceros."*

---

## 4. Instrucciones de Ejecución y Despliegue

### Paso 1: Crear las tablas y políticas en Supabase
1. Abre tu panel de control de Supabase: [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Ve al **SQL Editor** del proyecto `ugvoqswljfvwftoinyxt`.
3. Copia y pega el contenido completo de [`scraper/schema.sql`](file:///c:/Users/kenny/OneDrive/Documents/Cosas%20de%20movil%20que%20lo%20buguie%20todo/PokemonGoExam/PokemonGoExam/scraper/schema.sql) y pulsa **Run**.
   - Esto creará las 9 tablas relacionales, índices, políticas RLS y los puntos emblemáticos del campus UniSabana.

### Paso 2: Ejecutar el Scraping y Seeding en Supabase
Desde la terminal del proyecto en tu PC:
```bash
# Ejecutar el scraper e insertar los 151 Pokémon en Supabase
.\scraper\venv\Scripts\python.exe -m scraper.main
```

### Paso 3: Verificar los datos
- En el panel de Supabase (**Table Editor**):
  - Verifica que `pokemon_base` contenga **151 registros** con sus tipos y stats.
  - Verifica que `pokestops` contenga las 4 Poképaradas del campus UniSabana.
  - Verifica que `gymnasiums` contenga los 2 Gimnasios (Ad Portas y Arena Deportiva).
