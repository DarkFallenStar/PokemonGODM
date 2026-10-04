# Especificación Técnica (SDD): Etapa 2 - Pipeline de Extracción (Web Scraping) y Seeding en Supabase

**Estado**: Implementado  
**Fecha**: 2026-10-04  
**Autor**: Antigravity (Senior Data & Mobile Architect) & User  
**Versión**: 1.0.0  
**Proyecto**: Pokémon GO UniSabana (Módulo 1 del Examen Práctico)  

---

## 1. Alcance y Objetivos (Scope & Objectives)

### 1.1. Restricción Crítica del Examen
> **"Queda terminantemente prohibido el consumo de APIs públicas preconstruidas (como PokéAPI o endpoints de terceros). Todo el catálogo de datos del universo Pokémon debe ser construido desde cero por el equipo mediante scripts de extracción de datos (Web Scraping) e insertado en una base de datos relacional administrada en Supabase."**

### 1.2. Objetivos Principales
1. **Web Scraper Modular en Python**:
   - Extraer de forma estructurada los 151 Pokémon de la Generación 1 directamente desde [PokemonDB](https://pokemondb.net/pokedex/all) utilizando `requests` + `BeautifulSoup4`.
   - Extraer: Número Pokédex (#1 a #151), Nombre, Tipos elementales, Estadísticas base (HP, Ataque, Defensa, Sp. Atk, Sp. Def, Speed), Puntos de Combate máximos calculados (CP), Ratio de Captura Base (*Base Catch Rate*), Movimientos (rápidos y cargados) y **enlaces a sprites de vista frontal y animaciones oficiales (GIFs de combate)**.
2. **Matriz de Multiplicadores de Daño**:
   - Extraer o modelar la tabla de efectividad de tipos elementales (18 tipos: Acero, Agua, Bicho, Dragón, Eléctrico, Fantasma, Fuego, Hada, Hielo, Lucha, Normal, Planta, Psíquico, Roca, Siniestro, Tierra, Veneno, Volador) para resolver combates en el Módulo 5.
3. **Pipeline de Almacenamiento de Sprites y Animaciones (Supabase Storage)**:
   - Descargar los sprites PNG y los **GIFs animados (Showdown/Gen 5 style)** en tiempo de extracción y subirlos directamente a un Bucket público en Supabase Storage (`pokemon-sprites/static/` y `pokemon-sprites/animated/`).
   - Guardar en la base de datos la URL pública generada por Supabase Storage para ambas modalidades (`sprite_url` y `animation_url`), garantizando que la aplicación móvil **nunca falle por bloqueos de hotlinking o caídas de servidores externos durante la sustentación**.
4. **Modelo Relacional PostgreSQL en Tercera Forma Normal (3FN)**:
   - Tablas requeridas por el enunciado: `pokemon_base` (con `sprite_url` y `animation_url`), `user_inventory`, `captured_instances` (con soporte para IVs de 0 a 15 y cálculo de CP individual), `pokestops` y `gymnasiums`.
5. **Seeding de Hitos Geográficos del Campus UniSabana (Módulo 3)**:
   - Poblar durante el seeding las coordenadas GPS reales de los 5 puntos emblemáticos del campus: Biblioteca Octavio Arizmendi Posada, Edificio Ad Portas, Edificio O (Bienestar), Plazoleta Central/Kioskos y Complejo Deportivo/Canchas Sintéticas.
6. **Row Level Security (RLS) Estricto**:
   - Políticas PostgreSQL para aislar los inventarios y capturas entre usuarios según `auth.uid()`.

---

## 2. Auditoría Topológica y Contexto de Memoria

### 2.1. Estado de Herramientas Existentes
- **Python Virtualenv**: [`scraper/venv`](file:///c:/Users/kenny/OneDrive/Documents/Cosas%20de%20movil%20que%20lo%20buguie%20todo/PokemonGoExam/PokemonGoExam/scraper/venv) cuenta con `beautifulsoup4` (4.15.0), `requests` (2.34.2), `supabase` (2.32.0), `pydantic` (2.13.5) y `httpx`.
- **Variables de Entorno**: [`.env`](file:///c:/Users/kenny/OneDrive/Documents/Cosas%20de%20movil%20que%20lo%20buguie%20todo/PokemonGoExam/PokemonGoExam/.env) contiene `EXPO_PUBLIC_SUPABASE_URL` y la clave de acceso.
- **Cliente TypeScript Móvil**: [`src/services/supabase.ts`](file:///c:/Users/kenny/OneDrive/Documents/Cosas%20de%20movil%20que%20lo%20buguie%20todo/PokemonGoExam/PokemonGoExam/src/services/supabase.ts) ya está listo para consumir las tablas de Supabase una vez pobladas.

---

## 3. Modelo Relacional en PostgreSQL (Tercera Forma Normal - 3FN)

El diseño cumple con 3FN al eliminar dependencias transitivas (por ejemplo, tipos elementales y movimientos viven en tablas independientes relacionadas mediante claves foráneas).

```
                      +---------------+
                      |     types     |
                      +---------------+
                       ^             ^
      type_primary_id  |             |  type_secondary_id
                       |             |
                +-----------------------+           +----------------------+
                |     pokemon_base      |---------> |    pokemon_moves     |
                +-----------------------+           +----------------------+
                       ^                                       |
                       | pokemon_id                            | move_id
                       |                                       v
            +-----------------------+               +----------------------+
            |  captured_instances   |               |        moves         |
            +-----------------------+               +----------------------+
              | user_id
              v
       (auth.users)
              ^
              | user_id
            +-----------------------+
            |    user_inventory     |
            +-----------------------+

            +-----------------------+       +----------------------+
            |       pokestops       |       |      gymnasiums      |
            +-----------------------+       +----------------------+
```

### 3.1. Definición de Tablas (DDL SQL)

```sql
-- 1. Tabla de Tipos Elementales
CREATE TABLE IF NOT EXISTS public.types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(20) UNIQUE NOT NULL,
    color_hex VARCHAR(7) NOT NULL
);

-- 2. Matriz de Multiplicadores de Daño (Efectividad)
CREATE TABLE IF NOT EXISTS public.type_effectiveness (
    attacking_type_id INT REFERENCES public.types(id) ON DELETE CASCADE,
    defending_type_id INT REFERENCES public.types(id) ON DELETE CASCADE,
    multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.00, -- 0.00 (Inmune), 0.50 (No muy eficaz), 1.00 (Normal), 2.00 (Súper eficaz)
    PRIMARY KEY (attacking_type_id, defending_type_id)
);

-- 3. Catálogo Maestro de Movimientos
CREATE TABLE IF NOT EXISTS public.moves (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    type_id INT REFERENCES public.types(id),
    category VARCHAR(10) CHECK (category IN ('fast', 'charged')),
    power INT DEFAULT 0,
    energy_delta INT DEFAULT 0, -- Energía ganada (fast) o gastada (charged)
    duration_ms INT DEFAULT 1000
);

-- 4. Catálogo Maestro de los 151 Pokémon (pokemon_base)
CREATE TABLE IF NOT EXISTS public.pokemon_base (
    id INT PRIMARY KEY, -- Número oficial en la Pokédex (1 al 151)
    name VARCHAR(50) NOT NULL,
    type_primary_id INT NOT NULL REFERENCES public.types(id),
    type_secondary_id INT REFERENCES public.types(id),
    base_hp INT NOT NULL,
    base_attack INT NOT NULL,
    base_defense INT NOT NULL,
    base_sp_attack INT NOT NULL,
    base_sp_defense INT NOT NULL,
    base_speed INT NOT NULL,
    base_cp INT NOT NULL,
    base_catch_rate NUMERIC(4,3) NOT NULL DEFAULT 0.200, -- Probabilidad base de captura (0.0 a 1.0)
    sprite_url TEXT NOT NULL,          -- PNG estático oficial (Supabase Storage)
    sprite_shiny_url TEXT,
    animation_url TEXT,               -- GIF animado oficial (Showdown/Gen 5 en Supabase Storage)
    animation_shiny_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Relación N:M Pokémon - Movimientos Disponibles
CREATE TABLE IF NOT EXISTS public.pokemon_moves (
    pokemon_id INT REFERENCES public.pokemon_base(id) ON DELETE CASCADE,
    move_id INT REFERENCES public.moves(id) ON DELETE CASCADE,
    PRIMARY KEY (pokemon_id, move_id)
);

-- 6. Inventario del Usuario (user_inventory)
CREATE TABLE IF NOT EXISTS public.user_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_type VARCHAR(30) NOT NULL CHECK (item_type IN ('pokeball', 'greatball', 'ultraball', 'potion', 'superpotion', 'revive')),
    quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, item_type)
);

-- 7. Instancias de Pokémon Capturados (captured_instances)
CREATE TABLE IF NOT EXISTS public.captured_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pokemon_id INT NOT NULL REFERENCES public.pokemon_base(id),
    iv_attack INT NOT NULL CHECK (iv_attack BETWEEN 0 AND 15),
    iv_defense INT NOT NULL CHECK (iv_defense BETWEEN 0 AND 15),
    iv_hp INT NOT NULL CHECK (iv_hp BETWEEN 0 AND 15),
    cp INT NOT NULL, -- Calculado con base_stats + IVs
    current_hp INT NOT NULL,
    fast_move_id INT REFERENCES public.moves(id),
    charged_move_id INT REFERENCES public.moves(id),
    captured_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Poképaradas Fijas del Campus UniSabana (pokestops)
CREATE TABLE IF NOT EXISTS public.pokestops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    interaction_radius_meters INT DEFAULT 20,
    cooldown_seconds INT DEFAULT 300 -- 5 minutos
);

-- 9. Gimnasios de Combate del Campus UniSabana (gymnasiums)
CREATE TABLE IF NOT EXISTS public.gymnasiums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    interaction_radius_meters INT DEFAULT 40,
    current_team VARCHAR(20) DEFAULT 'neutral' CHECK (current_team IN ('mystic', 'valor', 'instinct', 'neutral')),
    defending_instance_id UUID REFERENCES public.captured_instances(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Seeding de Puntos de Interés Emblemáticos (Campus UniSabana)
INSERT INTO public.pokestops (name, latitude, longitude, interaction_radius_meters, cooldown_seconds) VALUES
('Biblioteca Octavio Arizmendi Posada', 4.86082, -74.03264, 20, 300),
('Edificio O - Bienestar Universitario', 4.85880, -74.03350, 20, 300),
('Plazoleta Central y Kioskos', 4.86010, -74.03300, 20, 300),
('Complejo Deportivo y Canchas Sintéticas', 4.85750, -74.03480, 20, 300)
ON CONFLICT DO NOTHING;

INSERT INTO public.gymnasiums (name, latitude, longitude, interaction_radius_meters, current_team) VALUES
('Gimnasio Ad Portas (Edificio Principal)', 4.86280, -74.03451, 40, 'neutral'),
('Gimnasio Arena Deportiva UniSabana', 4.85720, -74.03510, 40, 'neutral')
ON CONFLICT DO NOTHING;
```

### 3.2. Políticas de Seguridad a Nivel de Filas (Row Level Security - RLS)

```sql
-- Activar RLS en todas las tablas
ALTER TABLE public.types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.type_effectiveness ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pokemon_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pokemon_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captured_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pokestops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gymnasiums ENABLE ROW LEVEL SECURITY;

-- Lectura pública para catálogos maestros y puntos de interés
CREATE POLICY "Catálogos públicos legibles por todos" 
ON public.pokemon_base FOR SELECT USING (true);

CREATE POLICY "Tipos públicos legibles" 
ON public.types FOR SELECT USING (true);

CREATE POLICY "Efectividad pública legible" 
ON public.type_effectiveness FOR SELECT USING (true);

CREATE POLICY "Movimientos públicos legibles" 
ON public.moves FOR SELECT USING (true);

CREATE POLICY "Poképaradas visibles para todos" 
ON public.pokestops FOR SELECT USING (true);

CREATE POLICY "Gimnasios visibles para todos" 
ON public.gymnasiums FOR SELECT USING (true);

-- Aislamiento estricto de usuario: Inventario
CREATE POLICY "Usuarios solo pueden ver su propio inventario"
ON public.user_inventory FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuarios solo pueden modificar su propio inventario"
ON public.user_inventory FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden insertar items a su propio inventario"
ON public.user_inventory FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Aislamiento estricto de usuario: Capturas
CREATE POLICY "Usuarios solo pueden ver sus propios Pokémon capturados"
ON public.captured_instances FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden registrar nuevas capturas propias"
ON public.captured_instances FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden actualizar sus propios Pokémon capturados"
ON public.captured_instances FOR UPDATE USING (auth.uid() = user_id);
```

---

## 4. Algoritmo de Cálculo de Puntos de Combate (CP Formula)

Durante la extracción y en la generación de capturas, los Puntos de Combate (CP) se calculan mediante la fórmula estandarizada de Pokémon GO:

$$\text{Total Attack} = \text{Base Attack} + \text{IV}_{\text{Attack}}$$
$$\text{Total Defense} = \text{Base Defense} + \text{IV}_{\text{Defense}}$$
$$\text{Total Stamina} = \text{Base HP} + \text{IV}_{\text{HP}}$$

$$\text{CP} = \max\left(10, \left\lfloor \frac{\text{Total Attack} \times \sqrt{\text{Total Defense}} \times \sqrt{\text{Total Stamina}}}{10} \right\rfloor\right)$$

- Para `pokemon_base.base_cp`: Se asumen IVs = 0 para representar el poder basal mínimo de la especie.
- Para `captured_instances.cp`: Se calculan dinámicamente con los IVs aleatorios (entre 0 y 15) generados en el instante de la captura.

---

## 5. Arquitectura del Pipeline de Scraping en Python (`scraper/`)

### 5.1. Estructura de Módulos
```
scraper/
├── venv/                       # Entorno virtual existente
├── config.py                   # Carga de credenciales y URL de Supabase desde .env
├── models.py                   # Modelos de datos Pydantic para validación estricta
├── parser.py                   # Lógica de scraping con BeautifulSoup sobre PokemonDB
├── storage.py                  # Descarga en memoria y subida al bucket Supabase Storage
├── seeder.py                   # Inserción relacional en lotes en PostgreSQL
├── schema.sql                  # Script DDL completo de tablas y RLS
└── main.py                     # Entrypoint CLI con logging y barra de progreso
```

### 5.2. Flujo de Extracción y Transformación (ETL)
1. **Extracción**: Petición HTTP con User-Agent estándar a `https://pokemondb.net/pokedex/all`.
2. **Filtrado**: Iterar exclusivamente sobre los IDs del 1 al 151 (Kanto Gen 1).
3. **Parseo Detallado**:
   - Extraer Tipos, HP, Atk, Def, Sp.Atk, Sp.Def, Speed.
   - Extraer URL de la imagen estática oficial (`https://img.pokemondb.net/sprites/home/normal/<name>.png`).
   - Extraer URL del GIF animado de batalla (`https://img.pokemondb.net/sprites/black-white/anim/normal/<name>.gif` o Showdown anims).
4. **Almacenamiento de Sprites y Animaciones en Supabase Storage**:
   - Descarga en memoria de bytes del PNG y GIF.
   - Subida a `pokemon-sprites/static/<id>.png` y `pokemon-sprites/animated/<id>.gif` en Supabase Storage.
   - Retorno y asignación de las URLs públicas persistentes para `sprite_url` y `animation_url`.
5. **Cálculo de Stats Derivadas**:
   - `base_cp` calculado con la fórmula matemática oficial.
   - Ratio de captura base asignado por especie (ej. Legendarios = 0.03, Iniciales = 0.20, Comunes = 0.50).
6. **Inserción Relacional y Seeding de Campus (Seeding)**:
   - Inserción ordenada respetando integridad referencial:
     `types` -> `moves` -> `pokemon_base` -> `pokemon_moves`.
   - Seeding geográfico inicial de los **5 hitos del Campus UniSabana**:
     - `pokestops`: Biblioteca Octavio Arizmendi, Edificio O, Plazoleta Central, Complejo Deportivo.
     - `gymnasiums`: Edificio Ad Portas, Arena Deportiva UniSabana.

---

## 6. Criterios de Aceptación (Gherkin Syntax)

### Escenario 1: Extracción Completa de la Primera Generación
- **Given** que el script `python scraper/main.py` se ejecuta con conexión a Internet.
- **When** concluye la fase de scraping.
- **Then** se obtienen exactamente 151 registros válidos, del #1 (Bulbasaur) al #151 (Mew), sin duplicados ni campos nulos en stats base.

### Escenario 2: Persistencia de Sprites en Supabase Storage
- **Given** que el bucket `pokemon-sprites` existe en Supabase Storage con acceso de lectura pública.
- **When** se procesa cada Pokémon.
- **Then** el sprite PNG es cargado en Supabase y la columna `sprite_url` en `pokemon_base` contiene un enlace directo al dominio de Supabase del proyecto (`https://ugvoqswljfvwftoinyxt.supabase.co/storage/v1/object/public/...`).

### Escenario 3: Integridad Referencial y RLS en Base de Datos
- **Given** el esquema relacional desplegado en PostgreSQL.
- **When** una petición anónima intenta consultar `pokemon_base`.
- **Then** la consulta retorna los 151 registros con sus tipos asociados; pero si intenta insertar o modificar en `user_inventory` sin un JWT válido, la base de datos rechaza la operación por violación de RLS.

---

## 7. Plan de Archivos a Crear y Ejecutar

| Acción | Archivo | Responsabilidad |
|---|---|---|
| **Crear** | `scraper/schema.sql` | DDL de creación de tablas, índices y políticas RLS en PostgreSQL |
| **Crear** | `scraper/config.py` | Configuración y carga de variables de Supabase |
| **Crear** | `scraper/models.py` | Esquemas Pydantic para tipado del Pokémon, Movimiento y Tipo |
| **Crear** | `scraper/parser.py` | Scraper BeautifulSoup4 sobre PokemonDB |
| **Crear** | `scraper/storage.py` | Gestor de descarga y subida a Supabase Storage |
| **Crear** | `scraper/seeder.py` | Servicio de inserción de datos en PostgreSQL |
| **Crear** | `scraper/main.py` | Orquestador principal CLI |
| **Crear** | `src/types/pokemon.ts` | Contratos TypeScript equivalentes en el frontend móvil |
| **Crear** | `docs/README_MODULO_2.md` | Documentación pedagógica de sustentación con 3 preguntas clave |

---

## 8. Verificación y Sincronización
- Ejecución de pruebas del script con `python scraper/main.py --dry-run` y ejecución real.
- Verificación de consultas en Supabase vía API / SQL.
- Tipado en frontend con `npx tsc --noEmit`.
- Re-indexación del grafo en `codebase-memory`.
