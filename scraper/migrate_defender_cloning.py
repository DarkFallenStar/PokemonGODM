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

print("1. Actualizando finalize_gym_battle con sistema de clonación de defensores...")
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
AS $func$
DECLARE
    v_gym RECORD;
    v_source RECORD;
    v_max_hp INT;
    v_cloned_defender_id UUID;
    v_old_defender_id UUID;
    v_old_defender_user_id UUID;
BEGIN
    -- Bloqueo pesimista de fila para evitar condiciones de carrera (Race Condition Prevention)
    SELECT * INTO v_gym
    FROM public.gymnasiums
    WHERE id = p_gym_id
    FOR UPDATE;

    IF v_gym.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Gimnasio inexistente.');
    END IF;

    v_old_defender_id := v_gym.defending_instance_id;
    v_cloned_defender_id := v_gym.defending_instance_id;

    -- Si se proporciona una instancia origen del ganador, crear un clon guardián independiente al 100% de PS
    IF p_new_defending_instance_id IS NOT NULL THEN
        SELECT ci.*, pb.base_hp, pb.name AS base_name
        INTO v_source
        FROM public.captured_instances ci
        JOIN public.pokemon_base pb ON ci.pokemon_id = pb.id
        WHERE ci.id = p_new_defending_instance_id;

        IF v_source.id IS NOT NULL THEN
            -- Calcular salud máxima al 100% para el guardián del gimnasio
            v_max_hp := (COALESCE(v_source.base_hp, 50) * 2) + COALESCE(v_source.iv_hp, 10) + 50;

            -- Insertar clon guardián dedicado bajo el ID de sistema de guardianes ('00000000-0000-0000-0000-000000000099')
            -- Esto evita que aparezca duplicado en la Pokédex personal del jugador y no altera los PS de su criatura original
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
                '00000000-0000-0000-0000-000000000099',
                v_source.pokemon_id,
                v_source.cp,
                v_max_hp, -- 100% de PS al defender el gimnasio
                v_source.iv_attack,
                v_source.iv_defense,
                v_source.iv_hp,
                v_source.fast_move_id,
                v_source.charged_move_id,
                v_source.nickname,
                v_source.ball_used,
                now()
            )
            RETURNING id INTO v_cloned_defender_id;
        END IF;
    END IF;

    -- Actualizar equipo líder y defensor oficial del gimnasio
    UPDATE public.gymnasiums
    SET current_team = p_winner_team,
        defending_instance_id = v_cloned_defender_id,
        updated_at = now()
    WHERE id = p_gym_id;

    -- Limpieza: Si el defensor anterior era un clon de sistema ('00000000-0000-0000-0000-000000000099'), eliminarlo para no acumular huérfanos
    IF v_old_defender_id IS NOT NULL AND v_old_defender_id <> v_cloned_defender_id THEN
        SELECT user_id INTO v_old_defender_user_id
        FROM public.captured_instances
        WHERE id = v_old_defender_id;

        IF v_old_defender_user_id = '00000000-0000-0000-0000-000000000099' THEN
            DELETE FROM public.captured_instances WHERE id = v_old_defender_id;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'gym_id', p_gym_id,
        'new_team', p_winner_team,
        'defending_instance_id', v_cloned_defender_id,
        'message', '¡Gimnasio conquistado! Defensor guardián clonado al 100% de PS (tu Pokémon en la Pokédex conserva su salud real).'
    );
END;
$func$;
""")
print("finalize_gym_battle actualizado con éxito.")

# 2. Desacoplar defensores actuales de Cajicá y Arena Deportiva clonándolos bajo '00000000-0000-0000-0000-000000000099'
cur.execute("""
    SELECT g.id, g.name, ci.pokemon_id, ci.cp, ci.iv_attack, ci.iv_defense, ci.iv_hp, ci.fast_move_id, ci.charged_move_id, ci.nickname, ci.ball_used, pb.base_hp
    FROM public.gymnasiums g
    JOIN public.captured_instances ci ON g.defending_instance_id = ci.id
    JOIN public.pokemon_base pb ON ci.pokemon_id = pb.id
    WHERE ci.user_id = '00000000-0000-0000-0000-000000000001';
""")
coupled_gyms = cur.fetchall()
for cg in coupled_gyms:
    gym_id, gym_name, p_id, cp, iv_a, iv_d, iv_hp, f_move, c_move, nick, ball, b_hp = cg
    max_hp = (b_hp * 2) + iv_hp + 50
    cur.execute("""
        INSERT INTO public.captured_instances (
            user_id, pokemon_id, cp, current_hp, iv_attack, iv_defense, iv_hp, fast_move_id, charged_move_id, nickname, ball_used, captured_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000099', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now()
        ) RETURNING id;
    """, (p_id, cp, max_hp, iv_a, iv_d, iv_hp, f_move, c_move, nick, ball))
    cloned_id = cur.fetchone()[0]
    cur.execute("UPDATE public.gymnasiums SET defending_instance_id = %s WHERE id = %s;", (cloned_id, gym_id))
    print(f"Gimnasio desacoplado: {gym_name} -> nuevo clon guardián id {cloned_id} (100% PS: {max_hp})")

# 3. Restaurar la salud de Matcha en la Pokédex personal del usuario para que no esté debilitado
cur.execute("""
    UPDATE public.captured_instances
    SET current_hp = 80
    WHERE user_id = '00000000-0000-0000-0000-000000000001' AND nickname = 'Matcha';
""")
print("Salud de Matcha en la Pokédex personal restablecida a 80 PS.")

print("\nVerificando estado final de los gimnasios:")
cur.execute("""
    SELECT g.name, g.current_team, ci.user_id, ci.nickname, pb.name, ci.current_hp
    FROM public.gymnasiums g
    LEFT JOIN public.captured_instances ci ON g.defending_instance_id = ci.id
    LEFT JOIN public.pokemon_base pb ON ci.pokemon_id = pb.id;
""")
for r in cur.fetchall():
    print(r)

cur.close()
conn.close()
