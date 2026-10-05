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

print("1. Creando tabla user_profiles...")
cur.execute("""
CREATE TABLE IF NOT EXISTS public.user_profiles (
    user_id UUID PRIMARY KEY,
    team VARCHAR(20) NOT NULL DEFAULT 'mystic' CHECK (team IN ('mystic', 'valor', 'instinct')),
    trainer_name VARCHAR(50) DEFAULT 'Entrenador UniSabana',
    updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT ALL ON TABLE public.user_profiles TO anon, authenticated, service_role;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_profiles' AND policyname = 'Allow All Access to user_profiles'
    ) THEN
        CREATE POLICY "Allow All Access to user_profiles" ON public.user_profiles FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

INSERT INTO public.user_profiles (user_id, team, trainer_name)
VALUES ('00000000-0000-0000-0000-000000000001', 'mystic', 'Entrenador UniSabana')
ON CONFLICT (user_id) DO NOTHING;
""")
print("SUCCESS: user_profiles creada y sembrada.")

print("\n2. Actualizando execute_pokemon_capture para asignar Salud al 100%...")
cur.execute("""
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
    v_base_hp INT;
    v_max_hp INT;
BEGIN
    SELECT name, base_hp INTO v_pokemon_name, v_base_hp 
    FROM public.pokemon_base 
    WHERE id = p_pokemon_id;
    
    -- Salud Máxima: (Base HP * 2) + IV HP + 50
    v_max_hp := (COALESCE(v_base_hp, 50) * 2) + COALESCE(p_iv_hp, 10) + 50;
    
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
        v_max_hp, -- Salud al 100% al capturar
        p_iv_attack,
        p_iv_defense,
        p_iv_hp,
        COALESCE(p_nickname, v_pokemon_name),
        p_ball_used,
        now()
    )
    RETURNING id INTO v_capture_id;

    -- REGISTRAR INTERACCIÓN PERSONAL (para que a este usuario no le aparezca más en el mapa)
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
""")
print("SUCCESS: execute_pokemon_capture actualizada.")

print("\n3. Creando RPC transfer_pokemon_instance (Transferir al Profesor)...")
cur.execute("""
CREATE OR REPLACE FUNCTION public.transfer_pokemon_instance(
    p_user_id UUID,
    p_instance_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_gym_name VARCHAR(100);
    v_deleted_count INT;
BEGIN
    -- 1. Validar si la criatura está actualmente defendiendo un gimnasio
    SELECT name INTO v_gym_name
    FROM public.gymnasiums
    WHERE defending_instance_id = p_instance_id;

    IF v_gym_name IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No puedes transferir a este Pokémon porque está defendiendo el ' || v_gym_name || '.'
        );
    END IF;

    -- 2. Eliminar atómicamente de captured_instances
    DELETE FROM public.captured_instances
    WHERE id = p_instance_id AND user_id = p_user_id;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    IF v_deleted_count = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Criatura no encontrada o no pertenece a tu cuenta.'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Pokémon transferido al Profesor con éxito.'
    );
END;
$$;
""")
print("SUCCESS: transfer_pokemon_instance creada.")

print("\n4. Restaurando salud al 100% de criaturas existentes en captured_instances...")
cur.execute("""
UPDATE public.captured_instances c
SET current_hp = (b.base_hp * 2) + c.iv_hp + 50
FROM public.pokemon_base b
WHERE b.id = c.pokemon_id;
""")
print("SUCCESS: Instancias existentes restauradas a salud completa.")

cur.close()
conn.close()
print("\nTODAS LAS MIGRACIONES SQL COMPLETADAS CON ÉXITO.")
