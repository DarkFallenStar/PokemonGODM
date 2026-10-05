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

# 1. Update execute_pokemon_capture function
stmt1 = """
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

    -- ELIMINAR EL SPAWN DE active_spawns PARA QUE NO QUEDE EN EL MAPA NI EN LA BD
    IF p_spawn_id IS NOT NULL THEN
        DELETE FROM public.active_spawns WHERE id = p_spawn_id;
    END IF;

    -- Descontar bola del inventario
    UPDATE public.user_inventory
    SET quantity = GREATEST(0, quantity - 1), updated_at = now()
    WHERE user_id = p_user_id AND item_type = p_ball_used;

    RETURN v_capture_id;
END;
$$;
"""

cur.execute(stmt1)
print("SUCCESS: execute_pokemon_capture updated to DELETE captured spawn.")

# 2. Procedure to purge expired or inactive spawns
stmt2 = """
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
"""
cur.execute(stmt2)
print("SUCCESS: purge_expired_spawns created.")

# 3. Grant execute permissions
cur.execute("GRANT EXECUTE ON FUNCTION public.purge_expired_spawns TO anon, authenticated, service_role;")
print("SUCCESS: Permissions granted on purge_expired_spawns.")

# 4. RLS delete permission for anon on active_spawns
stmt4 = """
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow Anon Delete Active Spawns') THEN
        CREATE POLICY "Allow Anon Delete Active Spawns" ON public.active_spawns FOR DELETE USING (true);
    END IF;
END $$;
"""
cur.execute(stmt4)
print("SUCCESS: RLS delete policy ensured.")

conn.close()
