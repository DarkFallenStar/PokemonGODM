import pg8000

conn = pg8000.connect(
    user='postgres.ugvoqswljfvwftoinyxt',
    password='uVQ8YciXhK5G1V2n',
    host='aws-0-us-east-1.pooler.supabase.com',
    port=6543,
    database='postgres'
)
conn.autocommit = True
cur = conn.cursor()

# 1. Crear tabla de interacciones personales de usuario con spawns
stmt1 = """
CREATE TABLE IF NOT EXISTS public.user_spawn_interactions (
    user_id UUID NOT NULL,
    spawn_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('captured', 'fled')),
    interacted_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, spawn_id)
);
ALTER TABLE public.user_spawn_interactions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.user_spawn_interactions TO anon, authenticated, service_role;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow All user_spawn_interactions') THEN
        CREATE POLICY "Allow All user_spawn_interactions" ON public.user_spawn_interactions FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
"""
cur.execute(stmt1)
print("SUCCESS: user_spawn_interactions table created with RLS.")

# 2. Actualizar execute_pokemon_capture: NO BORRA active_spawns, registra en user_spawn_interactions
stmt2 = """
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
    SELECT name INTO v_pokemon_name FROM public.pokemon_base WHERE id = p_pokemon_id;
    
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

    -- REGISTRAR INTERACCIÓN PERSONAL (para que a este usuario no le aparezca más en el mapa)
    -- El spawn en active_spawns SE CONSERVA para otros jugadores hasta que venza su TTL de 15 min
    IF p_spawn_id IS NOT NULL THEN
        INSERT INTO public.user_spawn_interactions (user_id, spawn_id, status, interacted_at)
        VALUES (p_user_id, p_spawn_id, 'captured', now())
        ON CONFLICT (user_id, spawn_id) 
        DO UPDATE SET status = 'captured', interacted_at = now();
    END IF;

    -- Descontar bola del inventario
    UPDATE public.user_inventory
    SET quantity = GREATEST(0, quantity - 1), updated_at = now()
    WHERE user_id = p_user_id AND item_type = p_ball_used;

    RETURN v_capture_id;
END;
$$;
"""
cur.execute(stmt2)
print("SUCCESS: execute_pokemon_capture updated to multi-player shared model.")

# 3. Función para registrar huida personal
stmt3 = """
CREATE OR REPLACE FUNCTION public.record_spawn_fled(
    p_user_id UUID,
    p_spawn_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF p_spawn_id IS NOT NULL THEN
        INSERT INTO public.user_spawn_interactions (user_id, spawn_id, status, interacted_at)
        VALUES (p_user_id, p_spawn_id, 'fled', now())
        ON CONFLICT (user_id, spawn_id) 
        DO UPDATE SET status = 'fled', interacted_at = now();
    END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_spawn_fled TO anon, authenticated, service_role;
"""
cur.execute(stmt3)
print("SUCCESS: record_spawn_fled created.")

# 4. Recolector de basura: purga de active_spawns solo cuando expira el TTL (expires_at < now())
stmt4 = """
CREATE OR REPLACE FUNCTION public.purge_expired_spawns()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INT;
BEGIN
    -- Eliminar spawns cuyo tiempo de vida (TTL) ya expiró
    DELETE FROM public.active_spawns 
    WHERE expires_at < now();
    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Limpiar interacciones huérfanas de spawns que ya no existen
    DELETE FROM public.user_spawn_interactions
    WHERE spawn_id NOT IN (SELECT id FROM public.active_spawns);

    RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.purge_expired_spawns TO anon, authenticated, service_role;
"""
cur.execute(stmt4)
print("SUCCESS: purge_expired_spawns updated with orphan cleanup.")

conn.close()
