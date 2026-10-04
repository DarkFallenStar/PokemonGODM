-- =====================================================================
-- MÓDULO 4: POKÉPARADAS, GIMNASIOS Y MOTOR DE SPAWNING DE CRIATURAS
-- =====================================================================

-- 1. Agregar columna is_test_zone a tablas existentes de POIs
ALTER TABLE public.pokestops ADD COLUMN IF NOT EXISTS is_test_zone BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.gymnasiums ADD COLUMN IF NOT EXISTS is_test_zone BOOLEAN NOT NULL DEFAULT false;

-- Marcar POIs de Cajicá como de prueba
UPDATE public.pokestops SET is_test_zone = true WHERE name ILIKE '%Cajicá%' OR name ILIKE '%Buena Suerte%';
UPDATE public.gymnasiums SET is_test_zone = true WHERE name ILIKE '%Cajicá%';

-- 2. Registro de Enfriamiento de Poképaradas por Entrenador (Cooldowns)
CREATE TABLE IF NOT EXISTS public.user_pokestop_cooldowns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    pokestop_id UUID NOT NULL REFERENCES public.pokestops(id) ON DELETE CASCADE,
    last_spun_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, pokestop_id)
);

CREATE INDEX IF NOT EXISTS idx_cooldowns_user_stop 
ON public.user_pokestop_cooldowns (user_id, pokestop_id);

-- 3. Tabla del Motor de Spawning de Criaturas Salvajes
CREATE TABLE IF NOT EXISTS public.active_spawns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pokemon_id INT NOT NULL REFERENCES public.pokemon_base(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    is_test_zone BOOLEAN NOT NULL DEFAULT false,
    spawned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    iv_attack INT NOT NULL CHECK (iv_attack BETWEEN 0 AND 15),
    iv_defense INT NOT NULL CHECK (iv_defense BETWEEN 0 AND 15),
    iv_hp INT NOT NULL CHECK (iv_hp BETWEEN 0 AND 15),
    cp INT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_active_spawns_coords 
ON public.active_spawns (latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_active_spawns_active 
ON public.active_spawns (is_active, expires_at);

-- 4. Habilitar y Configurar Row Level Security (RLS)
ALTER TABLE public.user_pokestop_cooldowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_spawns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Spawns activos legibles por todos" ON public.active_spawns;
CREATE POLICY "Spawns activos legibles por todos" 
ON public.active_spawns FOR SELECT USING (is_active = true AND expires_at > now());

DROP POLICY IF EXISTS "Spawns insertables y modificables" ON public.active_spawns;
CREATE POLICY "Spawns insertables y modificables" 
ON public.active_spawns FOR ALL USING (true);

DROP POLICY IF EXISTS "Cooldowns legibles por todos" ON public.user_pokestop_cooldowns;
CREATE POLICY "Cooldowns legibles por todos" 
ON public.user_pokestop_cooldowns FOR SELECT USING (true);

DROP POLICY IF EXISTS "Cooldowns modificables por todos" ON public.user_pokestop_cooldowns;
CREATE POLICY "Cooldowns modificables por todos" 
ON public.user_pokestop_cooldowns FOR ALL USING (true);

DROP POLICY IF EXISTS "Inventario accesible por todos" ON public.user_inventory;
CREATE POLICY "Inventario accesible por todos"
ON public.user_inventory FOR ALL USING (true);
