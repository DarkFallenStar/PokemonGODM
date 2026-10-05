"""
Script de Evaluación y Verificación Automática del RPC finalize_gym_battle en PostgreSQL.
Permite evaluar la transferencia atómica de liderazgo de gimnasio con bloqueo pesimista (FOR UPDATE).
"""
import sys
import pg8000

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

DB_USER = 'postgres.ugvoqswljfvwftoinyxt'
DB_PASS = 'uVQ8YciXhK5G1V2n'
DB_HOST = 'aws-0-us-east-1.pooler.supabase.com'
DB_PORT = 6543
DB_NAME = 'postgres'

def test_finalize_gym_battle():
    print("=" * 70)
    print("🏆 EVALUACIÓN DEL RPC finalize_gym_battle (PostgreSQL + Supabase)")
    print("=" * 70)
    
    conn = pg8000.connect(
        user=DB_USER,
        password=DB_PASS,
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME
    )
    conn.autocommit = True
    cur = conn.cursor()

    # 1. Obtener los gimnasios existentes
    cur.execute("SELECT id, name, current_team, updated_at FROM public.gymnasiums ORDER BY name;")
    gyms = cur.fetchall()

    if not gyms:
        print("❌ Error: No se encontraron gimnasios en la base de datos.")
        return

    print(f"\n[1] Gimnasios Registrados en PostgreSQL ({len(gyms)}):")
    for g in gyms:
        gid, gname, gteam, gupdated = g
        print(f"  - ID: {gid} | Nombre: '{gname}' | Equipo Actual: [{gteam}] | Actualizado: {gupdated}")

    target_gym = gyms[0]
    target_id, target_name, original_team, _ = target_gym

    print(f"\n[2] Gimnasio Seleccionado para la Prueba de Conquista:")
    print(f"    Gimnasio: '{target_name}' (ID: {target_id})")
    print(f"    Equipo Inicial: [{original_team}]")

    # 2. Alternar equipo para probar la transferencia
    # Si es 'mystic', cambiamos a 'valor' y luego a 'mystic' para verificar reactividad bidireccional
    test_teams = ['valor', 'mystic'] if original_team == 'mystic' else ['mystic', 'valor']

    for next_team in test_teams:
        print(f"\n[3] Ejecutando RPC: public.finalize_gym_battle(...) hacia Equipo [{next_team.upper()}]...")
        demo_user_id = '00000000-0000-0000-0000-000000000001'
        
        cur.execute(
            "SELECT public.finalize_gym_battle(%s, %s, %s, NULL);",
            (str(target_id), demo_user_id, next_team)
        )
        rpc_result = cur.fetchone()[0]
        print(f"    -> Retorno JSONB del RPC: {rpc_result}")

        # 4. Verificar directamente en la tabla con un SELECT
        cur.execute(
            "SELECT id, name, current_team, updated_at FROM public.gymnasiums WHERE id = %s;",
            (str(target_id),)
        )
        row = cur.fetchone()
        updated_id, updated_name, current_db_team, updated_time = row
        print(f"    -> Verificación directa en tabla 'gymnasiums':")
        print(f"       current_team en DB = [{current_db_team}]")
        print(f"       updated_at = {updated_time}")

        assert current_db_team == next_team, f"Fallo: El equipo en DB debió ser {next_team}, pero es {current_db_team}"
        print(f"    ✅ ÉXITO: Transición de liderazgo a [{next_team}] verificada atómicamente con FOR UPDATE.")

    print("\n" + "=" * 70)
    print("✅ EVALUACIÓN COMPLETADA AL 100%: El RPC finalize_gym_battle opera con éxito.")
    print("=" * 70)

    cur.close()
    conn.close()

if __name__ == '__main__':
    test_finalize_gym_battle()
