"""
Herramienta de Gestión de Defensores de Gimnasios (PokemonGO UniSabana)
Permite asignar defensores canónicos al 100% de PS a cualquier gimnasio nuevo o existente.
Uso directo:
    python scraper/assign_gym_defender.py --gym "Mesón" --pokemon "Snorlax" --team "mystic" --nickname "Snorlax del Mesón"
    python scraper/assign_gym_defender.py --list
"""

import argparse
import io
import json
import sys
import pg8000

# Asegurar codificación UTF-8 en consola de Windows
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

DB_CONFIG = {
    'user': 'postgres.ugvoqswljfvwftoinyxt',
    'password': 'uVQ8YciXhK5G1V2n',
    'host': 'aws-0-us-east-1.pooler.supabase.com',
    'port': 6543,
    'database': 'postgres'
}

def get_connection():
    conn = pg8000.connect(**DB_CONFIG)
    conn.autocommit = True
    return conn

def list_gyms():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT 
            g.id,
            g.name,
            g.current_team,
            g.latitude,
            g.longitude,
            g.is_test_zone,
            ci.nickname,
            pb.name AS species_name,
            ci.cp,
            ci.current_hp
        FROM public.gymnasiums g
        LEFT JOIN public.captured_instances ci ON g.defending_instance_id = ci.id
        LEFT JOIN public.pokemon_base pb ON ci.pokemon_id = pb.id
        ORDER BY g.name;
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    print("\n" + "=" * 90)
    print(" ESTADO DE GIMNASIOS EN SUPABASE ".center(90, "="))
    print("=" * 90)
    print(f"{'Nombre Gimnasio':<32} | {'Equipo':<8} | {'Defensor Actual':<24} | {'CP':<6} | {'PS':<6} | {'Zona'}")
    print("-" * 90)
    
    for r in rows:
        gid, name, team, lat, lon, is_tz, nick, species, cp, hp = r
        zone = "Cajica" if is_tz else "UniSabana"
        if species:
            def_str = f"{nick or species} ({species})"
            cp_str = str(cp or "-")
            hp_str = str(hp or "-")
        else:
            def_str = "[!] SIN DEFENSOR"
            cp_str = "-"
            hp_str = "-"
            
        print(f"{name:<32} | {team:<8} | {def_str:<24} | {cp_str:<6} | {hp_str:<6} | {zone}")
    print("=" * 90 + "\n")
    return rows

def assign_defender(gym_identifier, pokemon_identifier, team='mystic', nickname=None):
    conn = get_connection()
    cur = conn.cursor()

    print(f"-> Asignando {pokemon_identifier} al gimnasio '{gym_identifier}' (Equipo: {team})...")

    cur.execute("""
        SELECT public.assign_gym_defender_by_name(%s, %s, %s, %s);
    """, (gym_identifier, pokemon_identifier, team, nickname))

    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row or not row[0]:
        print("[ERROR] La funcion de Supabase no retorno ningun resultado.")
        return False

    result = row[0]
    if isinstance(result, str):
        result = json.loads(result)

    if not result.get('success'):
        print(f"[ERROR] Al asignar defensor: {result.get('error')}")
        return False

    print("\n" + "=== DEFENSOR ASIGNADO CON EXITO ===".center(60, "="))
    print(f"  Gimnasio       : {result.get('gym_name')}")
    print(f"  Equipo         : {result.get('team').upper()}")
    print(f"  Pokemon        : {result.get('pokemon_name')}")
    print(f"  Apodo / Rotulo : {result.get('nickname')}")
    print(f"  Puntos Combate : {result.get('cp')} CP")
    print(f"  Salud Maxima   : {result.get('max_hp')} PS (100% Curado)")
    print(f"  Ataque Rapido  : {result.get('fast_move')}")
    print(f"  Ataque Cargado : {result.get('charged_move')}")
    print(f"  Instance ID    : {result.get('defending_instance_id')}")
    print("=" * 60)
    print("TIP: Pulsa el boton 'Actualizar' en el mapa de la app para ver los cambios reflejados al instante.\n")
    return True

def main():
    parser = argparse.ArgumentParser(description="Asignar defensor a gimnasios de Pokemon GO UniSabana")
    parser.add_argument("--list", action="store_true", help="Listar todos los gimnasios y su estado actual")
    parser.add_argument("--gym", type=str, help="Nombre o fragmento del nombre del gimnasio (ej. 'Meson', 'Ad Portas')")
    parser.add_argument("--pokemon", type=str, help="Nombre o numero del Pokemon defensor (ej. 'Snorlax', '143', 'Lapras')")
    parser.add_argument("--team", type=str, default="mystic", choices=["mystic", "valor", "instinct", "neutral"], help="Equipo lider del gimnasio")
    parser.add_argument("--nickname", type=str, default=None, help="Apodo opcional para el defensor (ej. 'Guardian del Meson')")

    args = parser.parse_args()

    if args.list:
        list_gyms()
        return

    if args.gym and args.pokemon:
        assign_defender(args.gym, args.pokemon, args.team, args.nickname)
        return

    # Si se ejecuta sin parametros, mostrar listado y modo guiado
    gyms = list_gyms()
    empty_gyms = [g for g in gyms if g[6] is None and g[7] is None]

    if empty_gyms:
        target = empty_gyms[0]
        print(f"[TARGET] Gimnasio sin defensor detectado: '{target[1]}'")
        assign_defender(target[1], "Snorlax", "mystic", f"Snorlax del {target[1]}")
    else:
        print("Uso recomendado por linea de comandos:")
        print('  python scraper/assign_gym_defender.py --gym "Meson" --pokemon "Snorlax" --team "mystic"')
        print("  python scraper/assign_gym_defender.py --list")

if __name__ == "__main__":
    main()
