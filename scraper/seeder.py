from typing import List, Dict
from .models import PokemonScrapedModel
from .storage import get_supabase_client
from .type_chart import TYPE_EFFECTIVENESS_MAP
from .moves_data import GEN1_MOVES

# 18 Tipos Elementales Oficiales y su paleta cromática HEX
POKEMON_TYPES = [
    {"id": 1, "name": "Normal", "color_hex": "#A8A878"},
    {"id": 2, "name": "Fire", "color_hex": "#F08030"},
    {"id": 3, "name": "Water", "color_hex": "#6890F0"},
    {"id": 4, "name": "Grass", "color_hex": "#78C850"},
    {"id": 5, "name": "Electric", "color_hex": "#F8D030"},
    {"id": 6, "name": "Ice", "color_hex": "#98D8D8"},
    {"id": 7, "name": "Fighting", "color_hex": "#C03028"},
    {"id": 8, "name": "Poison", "color_hex": "#A040A0"},
    {"id": 9, "name": "Ground", "color_hex": "#E0C068"},
    {"id": 10, "name": "Flying", "color_hex": "#A890F0"},
    {"id": 11, "name": "Psychic", "color_hex": "#F85888"},
    {"id": 12, "name": "Bug", "color_hex": "#A8B820"},
    {"id": 13, "name": "Rock", "color_hex": "#B8A038"},
    {"id": 14, "name": "Ghost", "color_hex": "#705898"},
    {"id": 15, "name": "Dragon", "color_hex": "#7038F8"},
    {"id": 16, "name": "Dark", "color_hex": "#705848"},
    {"id": 17, "name": "Steel", "color_hex": "#B8B8D0"},
    {"id": 18, "name": "Fairy", "color_hex": "#EE99AC"},
]

# Hitos Emblemáticos del Campus UniSabana
CAMPUS_POKESTOPS = [
    {"name": "Biblioteca Octavio Arizmendi Posada", "latitude": 4.86082, "longitude": -74.03264, "interaction_radius_meters": 20, "cooldown_seconds": 300},
    {"name": "Edificio O - Bienestar Universitario", "latitude": 4.85880, "longitude": -74.03350, "interaction_radius_meters": 20, "cooldown_seconds": 300},
    {"name": "Plazoleta Central y Kioskos", "latitude": 4.86010, "longitude": -74.03300, "interaction_radius_meters": 20, "cooldown_seconds": 300},
    {"name": "Complejo Deportivo y Canchas Sintéticas", "latitude": 4.85750, "longitude": -74.03480, "interaction_radius_meters": 20, "cooldown_seconds": 300},
]

CAMPUS_GYMS = [
    {"name": "Gimnasio Ad Portas (Edificio Principal)", "latitude": 4.86280, "longitude": -74.03451, "interaction_radius_meters": 40, "current_team": "neutral"},
    {"name": "Gimnasio Arena Deportiva UniSabana", "latitude": 4.85720, "longitude": -74.03510, "interaction_radius_meters": 40, "current_team": "neutral"},
]

def seed_database(pokemon_list: List[PokemonScrapedModel]) -> bool:
    client = get_supabase_client()
    if not client:
        print("[!] No se pudo conectar a Supabase. Se omitirá el seeding remoto.")
        return False

    print("\n[*] Iniciando Seeding Relacional en Supabase (3FN)...")

    # 1. Seeding de Tipos
    print("[1/6] Insertando catálogo de Tipos Elementales...")
    type_name_to_id = {}
    for t in POKEMON_TYPES:
        type_name_to_id[t["name"].lower()] = t["id"]
        try:
            client.table("types").upsert(t).execute()
        except Exception as e:
            print(f"  [!] Nota al insertar tipo {t['name']}: {e}")

    # 2. Seeding de Matriz de Efectividad (type_effectiveness)
    print("[2/6] Insertando Matriz de Efectividad de Daño (type_effectiveness)...")
    effectiveness_rows = []
    for atk_name, def_dict in TYPE_EFFECTIVENESS_MAP.items():
        atk_id = type_name_to_id.get(atk_name.lower())
        if not atk_id:
            continue
        for def_name, mult in def_dict.items():
            def_id = type_name_to_id.get(def_name.lower())
            if not def_id:
                continue
            effectiveness_rows.append({
                "attacking_type_id": atk_id,
                "defending_type_id": def_id,
                "multiplier": mult
            })

    # Insertar en lotes
    for i in range(0, len(effectiveness_rows), 50):
        chunk = effectiveness_rows[i:i+50]
        try:
            client.table("type_effectiveness").upsert(chunk).execute()
        except Exception as e:
            print(f"  [!] Error al insertar lote de efectividad: {e}")
    print(f"  [OK] {len(effectiveness_rows)} relaciones de daño insertadas.")

    # 3. Seeding de Movimientos
    print(f"[3/6] Insertando catálogo completo de Movimientos ({len(GEN1_MOVES)} movimientos)...")
    for m in GEN1_MOVES:
        move_data = {
            "name": m["name"],
            "type_id": m["type_id"],
            "category": m["category"],
            "power": m["power"],
            "energy_delta": m["energy_delta"],
            "duration_ms": m["duration_ms"]
        }
        try:
            client.table("moves").upsert(move_data, on_conflict="name").execute()
        except Exception as e:
            print(f"  [!] Nota al insertar movimiento {m['name']}: {e}")

    # 4. Seeding de Pokémon Base
    print(f"[4/6] Insertando catálogo de los {len(pokemon_list)} Pokémon Base...")
    batch = []

    # Consultar los IDs reales de los movimientos generados en la base de datos
    moves_res = client.table("moves").select("id, type_id").execute()
    db_moves = moves_res.data or []
    type_to_moves = {}
    for m in db_moves:
        type_to_moves.setdefault(m["type_id"], []).append(m["id"])

    # Fallback si Tackle no existe, usar el primer ID de movimiento disponible
    default_move_id = db_moves[0]["id"] if db_moves else 1

    pokemon_moves_batch = []
    for p in pokemon_list:
        p_primary_id = type_name_to_id.get(p.type_primary.lower(), 1)
        p_secondary_id = type_name_to_id.get(p.type_secondary.lower()) if p.type_secondary else None

        record = {
            "id": p.id,
            "name": p.name,
            "type_primary_id": p_primary_id,
            "type_secondary_id": p_secondary_id,
            "base_hp": p.hp,
            "base_attack": p.attack,
            "base_defense": p.defense,
            "base_sp_attack": p.sp_attack,
            "base_sp_defense": p.sp_defense,
            "base_speed": p.speed,
            "base_cp": p.base_cp,
            "base_catch_rate": p.base_catch_rate,
            "sprite_url": p.sprite_url or p.sprite_remote_url,
            "animation_url": p.animation_url or p.animation_remote_url,
        }
        batch.append(record)

        # Asociar movimientos compatibles según tipo (N:M pokemon_moves)
        compatible_moves = list(type_to_moves.get(p_primary_id, []))
        if p_secondary_id:
            compatible_moves.extend(type_to_moves.get(p_secondary_id, []))
        if not compatible_moves:
            compatible_moves.append(default_move_id)

        for m_id in compatible_moves:
            pokemon_moves_batch.append({"pokemon_id": p.id, "move_id": m_id})

        if len(batch) >= 25:
            try:
                client.table("pokemon_base").upsert(batch).execute()
            except Exception as e:
                print(f"  [!] Error al insertar lote de Pokémon: {e}")
            batch = []

    if batch:
        try:
            client.table("pokemon_base").upsert(batch).execute()
        except Exception as e:
            print(f"  [!] Error al insertar lote final: {e}")

    # Insertar pokemon_moves
    print(f"  [*] Asociando {len(pokemon_moves_batch)} relaciones en pokemon_moves...")
    inserted_moves_count = 0
    for i in range(0, len(pokemon_moves_batch), 100):
        chunk = pokemon_moves_batch[i:i+100]
        try:
            client.table("pokemon_moves").upsert(chunk).execute()
            inserted_moves_count += len(chunk)
        except Exception as e:
            print(f"  [!] Error al insertar lote en pokemon_moves: {e}")
    print(f"  [OK] {inserted_moves_count} asociaciones insertadas en pokemon_moves.")

    # 5. Seeding de Poképaradas UniSabana (Sin duplicar)
    print("[5/6] Sincronizando Poképaradas del Campus UniSabana...")
    # Intentar eliminar existentes por nombre para evitar duplicación
    for stop in CAMPUS_POKESTOPS:
        try:
            client.table("pokestops").delete().eq("name", stop["name"]).execute()
            client.table("pokestops").insert(stop).execute()
        except Exception as e:
            print(f"  [!] Nota Poképarada: {e}")

    # 6. Seeding de Gimnasios UniSabana (Sin duplicar)
    print("[6/6] Sincronizando Gimnasios de Combate del Campus...")
    for gym in CAMPUS_GYMS:
        try:
            client.table("gymnasiums").delete().eq("name", gym["name"]).execute()
            client.table("gymnasiums").insert(gym).execute()
        except Exception as e:
            print(f"  [!] Nota Gimnasio: {e}")

    print("[OK] Seeding relacional en Supabase completado exitosamente!")
    return True
