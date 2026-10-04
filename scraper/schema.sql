-- =====================================================================
-- POKÉMON GO UNISABANA - ESQUEMA RELACIONAL (POSTGRESQL / SUPABASE 3FN)
-- =====================================================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------
-- 1. TABLA: Tipos Elementales (types)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(20) UNIQUE NOT NULL,
    color_hex VARCHAR(7) NOT NULL
);

-- ---------------------------------------------------------------------
-- 2. TABLA: Matriz de Efectividad de Daño (type_effectiveness)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.type_effectiveness (
    attacking_type_id INT REFERENCES public.types(id) ON DELETE CASCADE,
    defending_type_id INT REFERENCES public.types(id) ON DELETE CASCADE,
    multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.00,
    PRIMARY KEY (attacking_type_id, defending_type_id)
);

-- ---------------------------------------------------------------------
-- 3. TABLA: Catálogo de Movimientos (moves)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.moves (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    type_id INT REFERENCES public.types(id),
    category VARCHAR(10) CHECK (category IN ('fast', 'charged')),
    power INT DEFAULT 0,
    energy_delta INT DEFAULT 0,
    duration_ms INT DEFAULT 1000
);

-- ---------------------------------------------------------------------
-- 4. TABLA: Catálogo Maestro de Criaturas (pokemon_base)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pokemon_base (
    id INT PRIMARY KEY, -- # Pokédex (1 al 151)
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
    base_catch_rate NUMERIC(4,3) NOT NULL DEFAULT 0.200,
    sprite_url TEXT NOT NULL,
    sprite_shiny_url TEXT,
    animation_url TEXT,
    animation_shiny_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 5. TABLA: Relación N:M Pokémon - Movimientos (pokemon_moves)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pokemon_moves (
    pokemon_id INT REFERENCES public.pokemon_base(id) ON DELETE CASCADE,
    move_id INT REFERENCES public.moves(id) ON DELETE CASCADE,
    PRIMARY KEY (pokemon_id, move_id)
);

-- ---------------------------------------------------------------------
-- 6. TABLA: Inventario de Usuario (user_inventory)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_type VARCHAR(30) NOT NULL CHECK (item_type IN ('pokeball', 'greatball', 'ultraball', 'potion', 'superpotion', 'revive')),
    quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, item_type)
);

-- ---------------------------------------------------------------------
-- 7. TABLA: Instancias de Criaturas Capturadas (captured_instances)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.captured_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pokemon_id INT NOT NULL REFERENCES public.pokemon_base(id),
    iv_attack INT NOT NULL CHECK (iv_attack BETWEEN 0 AND 15),
    iv_defense INT NOT NULL CHECK (iv_defense BETWEEN 0 AND 15),
    iv_hp INT NOT NULL CHECK (iv_hp BETWEEN 0 AND 15),
    cp INT NOT NULL,
    current_hp INT NOT NULL,
    fast_move_id INT REFERENCES public.moves(id),
    charged_move_id INT REFERENCES public.moves(id),
    captured_at TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 8. TABLA: Poképaradas Fijas (pokestops)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pokestops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    interaction_radius_meters INT DEFAULT 20,
    cooldown_seconds INT DEFAULT 300
);

-- ---------------------------------------------------------------------
-- 9. TABLA: Gimnasios de Combate (gymnasiums)
-- ---------------------------------------------------------------------
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

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================

ALTER TABLE public.types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.type_effectiveness ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pokemon_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pokemon_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captured_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pokestops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gymnasiums ENABLE ROW LEVEL SECURITY;

-- Otorgar privilegios a roles de Supabase (anon, authenticated, service_role)
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- Catálogos públicos legibles por usuarios anónimos y autenticados
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Read Types') THEN
        CREATE POLICY "Public Read Types" ON public.types FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow Insert Types') THEN
        CREATE POLICY "Allow Insert Types" ON public.types FOR INSERT WITH CHECK (true);
        CREATE POLICY "Allow Update Types" ON public.types FOR UPDATE USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Read Effectiveness') THEN
        CREATE POLICY "Public Read Effectiveness" ON public.type_effectiveness FOR SELECT USING (true);
        CREATE POLICY "Allow Insert Effectiveness" ON public.type_effectiveness FOR INSERT WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Read Moves') THEN
        CREATE POLICY "Public Read Moves" ON public.moves FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow Insert Moves') THEN
        CREATE POLICY "Allow Insert Moves" ON public.moves FOR INSERT WITH CHECK (true);
        CREATE POLICY "Allow Update Moves" ON public.moves FOR UPDATE USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Read Pokemon Base') THEN
        CREATE POLICY "Public Read Pokemon Base" ON public.pokemon_base FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow Insert Pokemon Base') THEN
        CREATE POLICY "Allow Insert Pokemon Base" ON public.pokemon_base FOR INSERT WITH CHECK (true);
        CREATE POLICY "Allow Update Pokemon Base" ON public.pokemon_base FOR UPDATE USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Read Pokemon Moves') THEN
        CREATE POLICY "Public Read Pokemon Moves" ON public.pokemon_moves FOR SELECT USING (true);
        CREATE POLICY "Allow Insert Pokemon Moves" ON public.pokemon_moves FOR INSERT WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Read Pokestops') THEN
        CREATE POLICY "Public Read Pokestops" ON public.pokestops FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow Insert Pokestops') THEN
        CREATE POLICY "Allow Insert Pokestops" ON public.pokestops FOR INSERT WITH CHECK (true);
        CREATE POLICY "Allow Update Pokestops" ON public.pokestops FOR UPDATE USING (true);
        CREATE POLICY "Allow Delete Pokestops" ON public.pokestops FOR DELETE USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Read Gymnasiums') THEN
        CREATE POLICY "Public Read Gymnasiums" ON public.gymnasiums FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow Insert Gymnasiums') THEN
        CREATE POLICY "Allow Insert Gymnasiums" ON public.gymnasiums FOR INSERT WITH CHECK (true);
        CREATE POLICY "Allow Update Gymnasiums" ON public.gymnasiums FOR UPDATE USING (true);
        CREATE POLICY "Allow Delete Gymnasiums" ON public.gymnasiums FOR DELETE USING (true);
    END IF;
END $$;

-- Aislamiento de Usuario para Inventario
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'User Inventory Select') THEN
        CREATE POLICY "User Inventory Select" ON public.user_inventory FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'User Inventory Insert') THEN
        CREATE POLICY "User Inventory Insert" ON public.user_inventory FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'User Inventory Update') THEN
        CREATE POLICY "User Inventory Update" ON public.user_inventory FOR UPDATE USING (auth.uid() = user_id);
    END IF;
END $$;

-- Aislamiento de Usuario para Capturas
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'User Captured Instances Select') THEN
        CREATE POLICY "User Captured Instances Select" ON public.captured_instances FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'User Captured Instances Insert') THEN
        CREATE POLICY "User Captured Instances Insert" ON public.captured_instances FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'User Captured Instances Update') THEN
        CREATE POLICY "User Captured Instances Update" ON public.captured_instances FOR UPDATE USING (auth.uid() = user_id);
    END IF;
END $$;

-- =====================================================================
-- LIMPIEZA DE DUPLICADOS Y RESTRICCIÓN DE UNICIDAD (CAMPUS UNISABANA)
-- =====================================================================

DELETE FROM public.pokestops a USING public.pokestops b 
WHERE a.ctid < b.ctid AND a.name = b.name;

DELETE FROM public.gymnasiums a USING public.gymnasiums b 
WHERE a.ctid < b.ctid AND a.name = b.name;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pokestops_name_unique') THEN
        ALTER TABLE public.pokestops ADD CONSTRAINT pokestops_name_unique UNIQUE (name);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gymnasiums_name_unique') THEN
        ALTER TABLE public.gymnasiums ADD CONSTRAINT gymnasiums_name_unique UNIQUE (name);
    END IF;
END $$;

-- =====================================================================
-- SEEDING INICIAL: PUNTOS DE INTERÉS DEL CAMPUS UNISABANA
-- =====================================================================

INSERT INTO public.pokestops (name, latitude, longitude, interaction_radius_meters, cooldown_seconds) VALUES
('Biblioteca Octavio Arizmendi Posada', 4.86082, -74.03264, 20, 300),
('Edificio O - Bienestar Universitario', 4.85880, -74.03350, 20, 300),
('Plazoleta Central y Kioskos', 4.86010, -74.03300, 20, 300),
('Complejo Deportivo y Canchas Sintéticas', 4.85750, -74.03480, 20, 300)
ON CONFLICT (name) DO UPDATE SET
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude;

INSERT INTO public.gymnasiums (name, latitude, longitude, interaction_radius_meters, current_team) VALUES
('Gimnasio Ad Portas (Edificio Principal)', 4.86280, -74.03451, 40, 'neutral'),
('Gimnasio Arena Deportiva UniSabana', 4.85720, -74.03510, 40, 'neutral')
ON CONFLICT (name) DO UPDATE SET
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude;
