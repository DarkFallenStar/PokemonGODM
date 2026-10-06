import pg8000
import sys

def get_connection():
    conn = pg8000.connect(
        user='postgres.ugvoqswljfvwftoinyxt',
        password='uVQ8YciXhK5G1V2n',
        host='aws-0-us-east-1.pooler.supabase.com',
        port=6543,
        database='postgres'
    )
    conn.autocommit = True
    return conn

def create_stored_functions():
    conn = get_connection()
    cur = conn.cursor()

    print("Creando función SQL public.assign_gym_defender...")
    cur.execute("""
    CREATE OR REPLACE FUNCTION public.assign_gym_defender(
        p_gym_id UUID,
        p_pokemon_id INT,
        p_team VARCHAR(20) DEFAULT 'mystic',
        p_nickname VARCHAR(100) DEFAULT NULL
    )
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
        v_gym RECORD;
        v_base RECORD;
        v_fast_move_id INT;
        v_charged_move_id INT;
        v_fast_move_name VARCHAR(100);
        v_charged_move_name VARCHAR(100);
        v_iv_a INT := 14;
        v_iv_d INT := 14;
        v_iv_hp INT := 15;
        v_cp INT;
        v_max_hp INT;
        v_new_instance_id UUID;
        v_old_defender_id UUID;
        v_old_defender_user UUID;
        v_display_name VARCHAR(100);
    BEGIN
        -- 1. Validar existencia del Gimnasio
        SELECT * INTO v_gym FROM public.gymnasiums WHERE id = p_gym_id FOR UPDATE;
        IF v_gym.id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Gimnasio no encontrado con ID: ' || p_gym_id);
        END IF;

        -- 2. Validar existencia de la especie de Pokémon
        SELECT * INTO v_base FROM public.pokemon_base WHERE id = p_pokemon_id;
        IF v_base.id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Especie Pokémon no encontrada con ID: ' || p_pokemon_id);
        END IF;

        -- 3. Buscar movimientos canónicos de la especie
        SELECT pm.move_id, m.name INTO v_fast_move_id, v_fast_move_name
        FROM public.pokemon_moves pm
        JOIN public.moves m ON pm.move_id = m.id
        WHERE pm.pokemon_id = p_pokemon_id AND m.category = 'fast'
        ORDER BY m.power DESC
        LIMIT 1;

        IF v_fast_move_id IS NULL THEN
            -- Fallback a Tackle (id 1)
            v_fast_move_id := 1;
            v_fast_move_name := 'Tackle';
        END IF;

        SELECT pm.move_id, m.name INTO v_charged_move_id, v_charged_move_name
        FROM public.pokemon_moves pm
        JOIN public.moves m ON pm.move_id = m.id
        WHERE pm.pokemon_id = p_pokemon_id AND m.category = 'charged'
        ORDER BY m.power DESC
        LIMIT 1;

        IF v_charged_move_id IS NULL THEN
            -- Fallback a Body Slam (id 4)
            v_charged_move_id := 4;
            v_charged_move_name := 'Body Slam';
        END IF;

        -- 4. Calcular CP y HP oficial
        -- CP = floor(((baseAtk + ivAtk) * sqrt(baseDef + ivDef) * sqrt(baseHp + ivHp)) / 10)
        v_cp := GREATEST(10, FLOOR(
            (v_base.base_attack + v_iv_a) * 
            SQRT(v_base.base_defense + v_iv_d) * 
            SQRT(v_base.base_hp + v_iv_hp) / 10.0
        )::INT);

        -- Max HP = (base_hp * 2) + iv_hp + 50
        v_max_hp := (v_base.base_hp * 2) + v_iv_hp + 50;

        v_display_name := COALESCE(p_nickname, v_base.name || ' Guardián');

        -- 5. Insertar instancia guardián bajo el ID de sistema ('00000000-0000-0000-0000-000000000099')
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
            p_pokemon_id,
            v_cp,
            v_max_hp, -- 100% de salud al custodiar el gimnasio
            v_iv_a,
            v_iv_d,
            v_iv_hp,
            v_fast_move_id,
            v_charged_move_id,
            v_display_name,
            'ultraball',
            now()
        )
        RETURNING id INTO v_new_instance_id;

        -- 6. Actualizar el Gimnasio
        v_old_defender_id := v_gym.defending_instance_id;

        UPDATE public.gymnasiums
        SET current_team = p_team,
            defending_instance_id = v_new_instance_id,
            updated_at = now()
        WHERE id = p_gym_id;

        -- 7. Limpiar defensor anterior huérfano si era del sistema
        IF v_old_defender_id IS NOT NULL AND v_old_defender_id <> v_new_instance_id THEN
            SELECT user_id INTO v_old_defender_user
            FROM public.captured_instances
            WHERE id = v_old_defender_id;

            IF v_old_defender_user = '00000000-0000-0000-0000-000000000099' THEN
                DELETE FROM public.captured_instances WHERE id = v_old_defender_id;
            END IF;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'gym_id', p_gym_id,
            'gym_name', v_gym.name,
            'team', p_team,
            'defending_instance_id', v_new_instance_id,
            'pokemon_name', v_base.name,
            'nickname', v_display_name,
            'cp', v_cp,
            'max_hp', v_max_hp,
            'fast_move', v_fast_move_name,
            'charged_move', v_charged_move_name
        );
    END;
    $$;
    """)

    print("Creando función helper por nombre public.assign_gym_defender_by_name...")
    cur.execute("""
    CREATE OR REPLACE FUNCTION public.assign_gym_defender_by_name(
        p_gym_name VARCHAR(100),
        p_pokemon_identifier VARCHAR(100),
        p_team VARCHAR(20) DEFAULT 'mystic',
        p_nickname VARCHAR(100) DEFAULT NULL
    )
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
        v_gym_id UUID;
        v_pokemon_id INT;
    BEGIN
        -- Buscar ID de Gimnasio
        SELECT id INTO v_gym_id
        FROM public.gymnasiums
        WHERE name ILIKE '%' || p_gym_name || '%'
        ORDER BY CASE WHEN name = p_gym_name THEN 0 ELSE 1 END
        LIMIT 1;

        IF v_gym_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'No se encontró ningún gimnasio con el nombre: ' || p_gym_name);
        END IF;

        -- Buscar ID de Pokémon (por número o nombre)
        IF p_pokemon_identifier ~ '^[0-9]+$' THEN
            v_pokemon_id := p_pokemon_identifier::INT;
        ELSE
            SELECT id INTO v_pokemon_id
            FROM public.pokemon_base
            WHERE name ILIKE p_pokemon_identifier
            LIMIT 1;
        END IF;

        IF v_pokemon_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'No se encontró ningún Pokémon con identificador: ' || p_pokemon_identifier);
        END IF;

        RETURN public.assign_gym_defender(v_gym_id, v_pokemon_id, p_team, p_nickname);
    END;
    $$;
    """)

    print("Funciones SQL instaladas con éxito.")
    cur.close()
    conn.close()

if __name__ == "__main__":
    create_stored_functions()
