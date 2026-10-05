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

print("=== 1. ACTUALIZAR execute_pokemon_capture CON ASIGNACIÓN DE MOVIMIENTOS ===")
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
    v_fast_move_id INT;
    v_charged_move_id INT;
BEGIN
    SELECT name, base_hp INTO v_pokemon_name, v_base_hp 
    FROM public.pokemon_base 
    WHERE id = p_pokemon_id;
    
    -- Salud Máxima: (Base HP * 2) + IV HP + 50
    v_max_hp := (COALESCE(v_base_hp, 50) * 2) + COALESCE(p_iv_hp, 10) + 50;
    
    -- Seleccionar movimiento rápido aleatorio propio de la especie
    SELECT m.id INTO v_fast_move_id
    FROM public.pokemon_moves pm
    JOIN public.moves m ON pm.move_id = m.id
    WHERE pm.pokemon_id = p_pokemon_id AND m.category = 'fast'
    ORDER BY random()
    LIMIT 1;

    -- Seleccionar movimiento cargado aleatorio propio de la especie
    SELECT m.id INTO v_charged_move_id
    FROM public.pokemon_moves pm
    JOIN public.moves m ON pm.move_id = m.id
    WHERE pm.pokemon_id = p_pokemon_id AND m.category = 'charged'
    ORDER BY random()
    LIMIT 1;

    -- Fallbacks si la especie no tuviese mapeo explícito
    IF v_fast_move_id IS NULL THEN
        v_fast_move_id := 1; -- Tackle
    END IF;
    IF v_charged_move_id IS NULL THEN
        v_charged_move_id := 4; -- Body Slam
    END IF;

    INSERT INTO public.captured_instances (
        user_id,
        pokemon_id,
        cp,
        current_hp,
        iv_attack,
        iv_defense,
        iv_hp,
        fast_move_id,
        charged_move_id,
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
        v_fast_move_id,
        v_charged_move_id,
        COALESCE(p_nickname, v_pokemon_name),
        p_ball_used,
        now()
    )
    RETURNING id INTO v_capture_id;

    -- REGISTRAR INTERACCIÓN PERSONAL
    IF p_spawn_id IS NOT NULL THEN
        INSERT INTO public.user_spawn_interactions (user_id, spawn_id, status, interacted_at)
        VALUES (p_user_id, p_spawn_id, 'captured', now())
        ON CONFLICT (user_id, spawn_id) 
        DO UPDATE SET status = 'captured', interacted_at = now();
    END IF;

    RETURN v_capture_id;
END;
$$;
""")
print("execute_pokemon_capture actualizado con éxito.")

print("\n=== 2. ACTUALIZAR finalize_gym_battle PARA CURAR AL 100% AL DEFENSOR ===")
cur.execute("""
CREATE OR REPLACE FUNCTION public.finalize_gym_battle(
    p_gym_id UUID,
    p_winner_user_id UUID,
    p_winner_team VARCHAR(20),
    p_new_defending_instance_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_gym RECORD;
BEGIN
    -- Bloqueo pesimista de fila para evitar condiciones de carrera (Race Condition Prevention)
    SELECT * INTO v_gym
    FROM public.gymnasiums
    WHERE id = p_gym_id
    FOR UPDATE;

    IF v_gym.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Gimnasio inexistente.');
    END IF;

    -- Actualizar equipo líder y defensor oficial del gimnasio
    UPDATE public.gymnasiums
    SET current_team = p_winner_team,
        defending_instance_id = COALESCE(p_new_defending_instance_id, defending_instance_id),
        updated_at = now()
    WHERE id = p_gym_id;

    -- Restaurar al 100% la salud del nuevo defensor en captured_instances
    IF p_new_defending_instance_id IS NOT NULL THEN
        UPDATE public.captured_instances ci
        SET current_hp = (pb.base_hp * 2) + COALESCE(ci.iv_hp, 10) + 50
        FROM public.pokemon_base pb
        WHERE ci.id = p_new_defending_instance_id AND ci.pokemon_id = pb.id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'gym_id', p_gym_id,
        'new_team', p_winner_team,
        'defending_instance_id', COALESCE(p_new_defending_instance_id, v_gym.defending_instance_id),
        'message', '¡Gimnasio conquistado y nuevo defensor curado al 100%!'
    );
END;
$$;
""")
print("finalize_gym_battle actualizado con éxito.")

print("\n=== 3. ASIGNAR MOVIMIENTOS REALES A TODAS LAS INSTANCIAS EXISTENTES ===")
cur.execute("""
    SELECT ci.id, ci.pokemon_id, pb.name
    FROM public.captured_instances ci
    JOIN public.pokemon_base pb ON ci.pokemon_id = pb.id;
""")
instances = cur.fetchall()
for inst in instances:
    inst_id, p_id, p_name = inst
    # Obtener movimiento rápido aleatorio
    cur.execute("""
        SELECT m.id, m.name FROM public.pokemon_moves pm
        JOIN public.moves m ON pm.move_id = m.id
        WHERE pm.pokemon_id = %s AND m.category = 'fast'
        ORDER BY random() LIMIT 1;
    """, (p_id,))
    f_move = cur.fetchone()
    f_id = f_move[0] if f_move else 1
    f_name = f_move[1] if f_move else 'Tackle'

    # Obtener movimiento cargado aleatorio
    cur.execute("""
        SELECT m.id, m.name FROM public.pokemon_moves pm
        JOIN public.moves m ON pm.move_id = m.id
        WHERE pm.pokemon_id = %s AND m.category = 'charged'
        ORDER BY random() LIMIT 1;
    """, (p_id,))
    c_move = cur.fetchone()
    c_id = c_move[0] if c_move else 4
    c_name = c_move[1] if c_move else 'Body Slam'

    cur.execute("""
        UPDATE public.captured_instances
        SET fast_move_id = %s, charged_move_id = %s
        WHERE id = %s;
    """, (f_id, c_id, inst_id))
    print(f"  - {p_name} ({inst_id}): Rápido=[{f_name} (#{f_id})], Cargado=[{c_name} (#{c_id})]")

print("\n=== 4. VERIFICAR QUE EL DEFENSOR DE CADA GIMNASIO ESTÉ AL 100% DE VIDA ===")
cur.execute("""
    UPDATE public.captured_instances ci
    SET current_hp = (pb.base_hp * 2) + COALESCE(ci.iv_hp, 10) + 50
    FROM public.pokemon_base pb, public.gymnasiums g
    WHERE g.defending_instance_id = ci.id AND ci.pokemon_id = pb.id;
""")
print("Defensores de gimnasios restaurados al 100% de PS.")
