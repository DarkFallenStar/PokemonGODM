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

# 1. Asegurar que captured_instances asigne movimientos rápidos y cargados si están nulos
update_moves_sql = """
DO $$
DECLARE
    r RECORD;
    v_fast_id INT;
    v_charged_id INT;
BEGIN
    FOR r IN SELECT id, pokemon_id FROM public.captured_instances WHERE fast_move_id IS NULL OR charged_move_id IS NULL LOOP
        -- Seleccionar un movimiento rápido y uno cargado
        SELECT m.id INTO v_fast_id 
        FROM public.pokemon_moves pm
        JOIN public.moves m ON m.id = pm.move_id
        WHERE pm.pokemon_id = r.pokemon_id AND m.category = 'fast'
        LIMIT 1;

        SELECT m.id INTO v_charged_id 
        FROM public.pokemon_moves pm
        JOIN public.moves m ON m.id = pm.move_id
        WHERE pm.pokemon_id = r.pokemon_id AND m.category = 'charged'
        LIMIT 1;

        -- Fallback a Tackle (1) y Body Slam (4) si no tiene asignado
        IF v_fast_id IS NULL THEN v_fast_id := 1; END IF;
        IF v_charged_id IS NULL THEN v_charged_id := 4; END IF;

        UPDATE public.captured_instances 
        SET fast_move_id = v_fast_id, charged_move_id = v_charged_id
        WHERE id = r.id;
    END LOOP;
END $$;
"""
cur.execute(update_moves_sql)
print("SUCCESS: Default moves populated for captured_instances.")

# 2. RPC apply_item_to_pokemon
apply_item_sql = """
CREATE OR REPLACE FUNCTION public.apply_item_to_pokemon(
    p_user_id UUID,
    p_instance_id UUID,
    p_item_type VARCHAR(30)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_qty INT;
    v_cur_hp INT;
    v_base_hp INT;
    v_iv_hp INT;
    v_max_hp INT;
    v_new_hp INT;
BEGIN
    -- 1. Validar existencia y stock suficiente del consumible
    SELECT quantity INTO v_qty
    FROM public.user_inventory
    WHERE user_id = p_user_id AND item_type = p_item_type;

    IF v_qty IS NULL OR v_qty <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Stock insuficiente del objeto seleccionado.');
    END IF;

    -- 2. Obtener datos de la criatura y calcular Max HP
    SELECT c.current_hp, b.base_hp, c.iv_hp
    INTO v_cur_hp, v_base_hp, v_iv_hp
    FROM public.captured_instances c
    JOIN public.pokemon_base b ON b.id = c.pokemon_id
    WHERE c.id = p_instance_id AND c.user_id = p_user_id;

    IF v_cur_hp IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Criatura no encontrada o no pertenece al usuario.');
    END IF;

    -- HP Máximo estándar derivado
    v_max_hp := (v_base_hp * 2) + v_iv_hp + 50;

    -- 3. Aplicar reglas de medicina según el tipo de objeto
    IF p_item_type = 'potion' THEN
        IF v_cur_hp <= 0 THEN
            RETURN jsonb_build_object('success', false, 'error', 'La criatura está debilitada. Usa un Revivir primero.');
        END IF;
        IF v_cur_hp >= v_max_hp THEN
            RETURN jsonb_build_object('success', false, 'error', 'La criatura ya se encuentra con salud completa.');
        END IF;
        v_new_hp := LEAST(v_max_hp, v_cur_hp + 20);

    ELSIF p_item_type = 'superpotion' THEN
        IF v_cur_hp <= 0 THEN
            RETURN jsonb_build_object('success', false, 'error', 'La criatura está debilitada. Usa un Revivir primero.');
        END IF;
        IF v_cur_hp >= v_max_hp THEN
            RETURN jsonb_build_object('success', false, 'error', 'La criatura ya se encuentra con salud completa.');
        END IF;
        v_new_hp := LEAST(v_max_hp, v_cur_hp + 50);

    ELSIF p_item_type = 'revive' THEN
        IF v_cur_hp > 0 THEN
            RETURN jsonb_build_object('success', false, 'error', 'El Revivir solo se puede aplicar a criaturas debilitadas (0 HP).');
        END IF;
        v_new_hp := GREATEST(10, FLOOR(v_max_hp * 0.50)::INT);

    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'El objeto indicado no es un consumible médico.');
    END IF;

    -- 4. Actualizar salud de la criatura
    UPDATE public.captured_instances
    SET current_hp = v_new_hp
    WHERE id = p_instance_id;

    -- 5. Deducir consumible del inventario
    UPDATE public.user_inventory
    SET quantity = quantity - 1, updated_at = now()
    WHERE user_id = p_user_id AND item_type = p_item_type;

    RETURN jsonb_build_object(
        'success', true,
        'new_hp', v_new_hp,
        'max_hp', v_max_hp,
        'remaining_quantity', v_qty - 1
    );
END;
$$;
"""
cur.execute(apply_item_sql)
print("SUCCESS: apply_item_to_pokemon RPC created.")

# 3. RPC finalize_gym_battle
finalize_gym_sql = """
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
    -- Bloqueo de fila para evitar condiciones de carrera en conquistas concurrentes
    SELECT * INTO v_gym
    FROM public.gymnasiums
    WHERE id = p_gym_id
    FOR UPDATE;

    IF v_gym.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Gimnasio inexistente.');
    END IF;

    -- Actualizar equipo líder y defensor oficial
    UPDATE public.gymnasiums
    SET current_team = p_winner_team,
        defending_instance_id = COALESCE(p_new_defending_instance_id, defending_instance_id),
        updated_at = now()
    WHERE id = p_gym_id;

    RETURN jsonb_build_object(
        'success', true,
        'gym_id', p_gym_id,
        'new_team', p_winner_team,
        'message', '¡Gimnasio conquistado exitosamente!'
    );
END;
$$;
"""
cur.execute(finalize_gym_sql)
print("SUCCESS: finalize_gym_battle RPC created.")

cur.close()
conn.close()
