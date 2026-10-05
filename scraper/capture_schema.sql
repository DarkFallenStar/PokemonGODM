-- =====================================================================
-- PÓKEMON GO UNISABANA - ESQUEMA Y PROCEDIMIENTOS DEL MODO CAPTURA (ETAPA 5)
-- =====================================================================

-- 1. DESACOPLAR DEPENDENCIA ESTRICTA DE auth.users PARA SOPORTE DE USUARIO DEMO
ALTER TABLE public.user_inventory 
    DROP CONSTRAINT IF EXISTS user_inventory_user_id_fkey;

ALTER TABLE public.captured_instances 
    DROP CONSTRAINT IF EXISTS captured_instances_user_id_fkey;

ALTER TABLE public.user_pokestop_cooldowns 
    DROP CONSTRAINT IF EXISTS user_pokestop_cooldowns_user_id_fkey;

-- 2. ASEGURAR COLUMNAS REQUERIDAS EN captured_instances
ALTER TABLE public.captured_instances 
    ADD COLUMN IF NOT EXISTS nickname VARCHAR(100),
    ADD COLUMN IF NOT EXISTS ball_used VARCHAR(50) DEFAULT 'pokeball';

-- 3. PERMISOS Y POLÍTICAS RLS ABIERTAS PARA PERMITIR OPERACIONES DE CAPTURA
GRANT ALL ON TABLE public.captured_instances TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.user_inventory TO anon, authenticated, service_role;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow Anon Insert Captured Instances') THEN
        CREATE POLICY "Allow Anon Insert Captured Instances" ON public.captured_instances FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow Anon Manage Inventory') THEN
        CREATE POLICY "Allow Anon Manage Inventory" ON public.user_inventory FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 4. POBLAR INVENTARIO INICIAL DEL USUARIO DEMO
INSERT INTO public.user_inventory (user_id, item_type, quantity, updated_at)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'pokeball', 50, now()),
    ('00000000-0000-0000-0000-000000000001', 'greatball', 25, now()),
    ('00000000-0000-0000-0000-000000000001', 'ultraball', 10, now()),
    ('00000000-0000-0000-0000-000000000001', 'potion', 15, now()),
    ('00000000-0000-0000-0000-000000000001', 'superpotion', 10, now()),
    ('00000000-0000-0000-0000-000000000001', 'revive', 5, now())
ON CONFLICT (user_id, item_type) 
DO UPDATE SET quantity = GREATEST(public.user_inventory.quantity, EXCLUDED.quantity), updated_at = now();

-- 5. FUNCIÓN TRANSACCIONAL DE CAPTURA
CREATE OR REPLACE FUNCTION public.execute_pokemon_capture(
    p_user_id UUID,
    p_spawn_id UUID,
    p_pokemon_id INT,
    p_cp INT,
    p_iv_attack INT,
    p_iv_defense INT,
    p_iv_hp INT,
    p_ball_used VARCHAR(50),
    p_nickname VARCHAR(100) DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_capture_id UUID;
    v_pokemon_name VARCHAR(100);
BEGIN
    -- Obtener nombre de la especie
    SELECT name INTO v_pokemon_name FROM public.pokemon_base WHERE id = p_pokemon_id;
    
    -- Insertar criatura capturada
    INSERT INTO public.captured_instances (
        user_id,
        pokemon_id,
        cp,
        current_hp,
        iv_attack,
        iv_defense,
        iv_hp,
        nickname,
        ball_used,
        captured_at
    )
    VALUES (
        p_user_id,
        p_pokemon_id,
        p_cp,
        GREATEST(10, p_cp / 10),
        p_iv_attack,
        p_iv_defense,
        p_iv_hp,
        COALESCE(p_nickname, v_pokemon_name),
        p_ball_used,
        now()
    )
    RETURNING id INTO v_capture_id;

    -- ELIMINAR DE FORMA DEFINITIVA el spawn de active_spawns para que no se acumulen
    IF p_spawn_id IS NOT NULL THEN
        DELETE FROM public.active_spawns 
        WHERE id = p_spawn_id;
    END IF;

    -- Descontar 1 bola utilizada del inventario si hay disponibilidad
    UPDATE public.user_inventory
    SET quantity = GREATEST(0, quantity - 1), updated_at = now()
    WHERE user_id = p_user_id AND item_type = p_ball_used;

    RETURN v_capture_id;
END;
$$;

-- 6. PROCEDIMIENTO PARA PURGAR SPAWNS CADUCADOS O INACTIVOS
CREATE OR REPLACE FUNCTION public.purge_expired_spawns()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INT;
BEGIN
    DELETE FROM public.active_spawns 
    WHERE expires_at < now() OR is_active = false;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_expired_spawns TO anon, authenticated, service_role;

