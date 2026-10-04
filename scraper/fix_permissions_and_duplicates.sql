-- =====================================================================
-- POKÉMON GO UNISABANA - SCRIPT DE CORRECCIÓN (PERMISOS, DUPLICADOS Y MATRIZ)
-- Copia y pega este script completo en el SQL Editor de Supabase y pulsa RUN
-- =====================================================================

-- 1. LIMPIAR DUPLICADOS EN POKÉPARADAS Y GIMNASIOS
DELETE FROM public.pokestops a USING public.pokestops b 
WHERE a.ctid < b.ctid AND a.name = b.name;

DELETE FROM public.gymnasiums a USING public.gymnasiums b 
WHERE a.ctid < b.ctid AND a.name = b.name;

-- 2. ASEGURAR RESTRICCIÓN DE UNICIDAD PARA IMPEDIR DUPLICACIONES FUTURAS
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pokestops_name_unique') THEN
        ALTER TABLE public.pokestops ADD CONSTRAINT pokestops_name_unique UNIQUE (name);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gymnasiums_name_unique') THEN
        ALTER TABLE public.gymnasiums ADD CONSTRAINT gymnasiums_name_unique UNIQUE (name);
    END IF;
END $$;

-- 3. SINCRONIZAR SECUENCIA DE IDs DE MOVIMIENTOS
SELECT setval('moves_id_seq', COALESCE((SELECT MAX(id) FROM public.moves), 1));

-- 4. OTORGAR PRIVILEGIOS TOTALES A ROLES DE SUPABASE
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- 5. POLÍTICAS DE RLS PARA TABLAS MAESTRAS
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow Insert Effectiveness') THEN
        CREATE POLICY "Allow Insert Effectiveness" ON public.type_effectiveness FOR INSERT WITH CHECK (true);
        CREATE POLICY "Allow Update Effectiveness" ON public.type_effectiveness FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow Insert Pokemon Moves') THEN
        CREATE POLICY "Allow Insert Pokemon Moves" ON public.pokemon_moves FOR INSERT WITH CHECK (true);
        CREATE POLICY "Allow Update Pokemon Moves" ON public.pokemon_moves FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow Delete Pokestops') THEN
        CREATE POLICY "Allow Delete Pokestops" ON public.pokestops FOR DELETE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow Delete Gymnasiums') THEN
        CREATE POLICY "Allow Delete Gymnasiums" ON public.gymnasiums FOR DELETE USING (true);
    END IF;
END $$;

-- 6. POBLAR DIRECTAMENTE LA MATRIZ DE EFECTIVIDAD DE DAÑO (18 TIPOS)
-- Normal (1), Fire (2), Water (3), Grass (4), Electric (5), Ice (6), Fighting (7), Poison (8),
-- Ground (9), Flying (10), Psychic (11), Bug (12), Rock (13), Ghost (14), Dragon (15), Dark (16), Steel (17), Fairy (18)

INSERT INTO public.type_effectiveness (attacking_type_id, defending_type_id, multiplier) VALUES
-- Normal
(1, 13, 0.5), (1, 14, 0.0), (1, 17, 0.5),
-- Fire
(2, 2, 0.5), (2, 3, 0.5), (2, 4, 2.0), (2, 6, 2.0), (2, 12, 2.0), (2, 13, 0.5), (2, 15, 0.5), (2, 17, 2.0),
-- Water
(3, 2, 2.0), (3, 3, 0.5), (3, 4, 0.5), (3, 9, 2.0), (3, 13, 2.0), (3, 15, 0.5),
-- Grass
(4, 2, 0.5), (4, 3, 2.0), (4, 4, 0.5), (4, 8, 0.5), (4, 9, 2.0), (4, 10, 0.5), (4, 12, 0.5), (4, 13, 2.0), (4, 15, 0.5), (4, 17, 0.5),
-- Electric
(5, 3, 2.0), (5, 4, 0.5), (5, 5, 0.5), (5, 9, 0.0), (5, 10, 2.0), (5, 15, 0.5),
-- Ice
(6, 2, 0.5), (6, 3, 0.5), (6, 4, 2.0), (6, 6, 0.5), (6, 9, 2.0), (6, 10, 2.0), (6, 15, 2.0), (6, 17, 0.5),
-- Fighting
(7, 1, 2.0), (7, 6, 2.0), (7, 8, 0.5), (7, 10, 0.5), (7, 11, 0.5), (7, 12, 0.5), (7, 13, 2.0), (7, 14, 0.0), (7, 16, 2.0), (7, 17, 2.0), (7, 18, 0.5),
-- Poison
(8, 4, 2.0), (8, 8, 0.5), (8, 9, 0.5), (8, 13, 0.5), (8, 14, 0.5), (8, 17, 0.0), (8, 18, 2.0),
-- Ground
(9, 2, 2.0), (9, 5, 2.0), (9, 4, 0.5), (9, 8, 2.0), (9, 10, 0.0), (9, 12, 0.5), (9, 13, 2.0), (9, 17, 2.0),
-- Flying
(10, 4, 2.0), (10, 5, 0.5), (10, 7, 2.0), (10, 12, 2.0), (10, 13, 0.5), (10, 17, 0.5),
-- Psychic
(11, 7, 2.0), (11, 8, 2.0), (11, 11, 0.5), (11, 16, 0.0), (11, 17, 0.5),
-- Bug
(12, 2, 0.5), (12, 4, 2.0), (12, 7, 0.5), (12, 8, 0.5), (12, 10, 0.5), (12, 11, 2.0), (12, 14, 0.5), (12, 16, 2.0), (12, 17, 0.5), (12, 18, 0.5),
-- Rock
(13, 2, 2.0), (13, 6, 2.0), (13, 7, 0.5), (13, 9, 0.5), (13, 10, 2.0), (13, 12, 2.0), (13, 17, 0.5),
-- Ghost
(14, 1, 0.0), (14, 11, 2.0), (14, 14, 2.0), (14, 16, 0.5),
-- Dragon
(15, 15, 2.0), (15, 17, 0.5), (15, 18, 0.0),
-- Dark
(16, 7, 0.5), (16, 11, 2.0), (16, 14, 2.0), (16, 16, 0.5), (16, 18, 0.5),
-- Steel
(17, 2, 0.5), (17, 3, 0.5), (17, 5, 0.5), (17, 6, 2.0), (17, 13, 2.0), (17, 17, 0.5), (17, 18, 2.0),
-- Fairy
(18, 2, 0.5), (18, 7, 2.0), (18, 8, 0.5), (18, 15, 2.0), (18, 16, 2.0), (18, 17, 0.5)
ON CONFLICT (attacking_type_id, defending_type_id) DO UPDATE SET
    multiplier = EXCLUDED.multiplier;
