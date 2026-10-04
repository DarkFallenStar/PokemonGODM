from typing import List, Dict
from .models import PokemonScrapedModel
from .storage import get_supabase_client

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

# Catálogo Base de Movimientos Gen 1 (Rápidos y Cargados)
SAMPLE_MOVES = [
    {"id": 1, "name": "Tackle", "type_id": 1, "category": "fast", "power": 5, "energy_delta": 5, "duration_ms": 500},
    {"id": 2, "name": "Vine Whip", "type_id": 4, "category": "fast", "power": 7, "energy_delta": 6, "duration_ms": 600},
    {"id": 3, "name": "Ember", "type_id": 2, "category": "fast", "power": 10, "energy_delta": 10, "duration_ms": 1000},
    {"id": 4, "name": "Water Gun", "type_id": 3, "category": "fast", "power": 5, "energy_delta": 5, "duration_ms": 500},
    {"id": 5, "name": "Thunder Shock", "type_id": 5, "category": "fast", "power": 5, "energy_delta": 8, "duration_ms": 600},
    {"id": 6, "name": "Solar Beam", "type_id": 4, "category": "charged", "power": 180, "energy_delta": -100, "duration_ms": 4900},
    {"id": 7, "name": "Flamethrower", "type_id": 2, "category": "charged", "power": 70, "energy_delta": -50, "duration_ms": 2200},
    {"id": 8, "name": "Hydro Pump", "type_id": 3, "category": "charged", "power": 130, "energy_delta": -100, "duration_ms": 3300},
    {"id": 9, "name": "Thunderbolt", "type_id": 5, "category": "charged", "power": 80, "energy_delta": -50, "duration_ms": 2500},
    {"id": 10, "name": "Hyper Beam", "type_id": 1, "category": "charged", "power": 150, "energy_delta": -100, "duration_ms": 3800},
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
    print("[1/5] Insertando catálogo de Tipos Elementales...")
    type_name_to_id = {}
    for t in POKEMON_TYPES:
        type_name_to_id[t["name"].lower()] = t["id"]
        try:
            client.table("types").upsert(t).execute()
        except Exception as e:
            print(f"  [!] Nota al insertar tipo {t['name']}: {e}")

    # 2. Seeding de Movimientos
    print("[2/5] Insertando catálogo de Movimientos...")
    for m in SAMPLE_MOVES:
        try:
            client.table("moves").upsert(m).execute()
        except Exception as e:
            print(f"  [!] Nota al insertar movimiento {m['name']}: {e}")

    # 3. Seeding de Pokémon Base
    print(f"[3/5] Insertando catálogo de los {len(pokemon_list)} Pokémon Base...")
    batch = []
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

    # 4. Seeding de Poképaradas UniSabana
    print("[4/5] Insertando Poképaradas del Campus UniSabana...")
    for stop in CAMPUS_POKESTOPS:
        try:
            client.table("pokestops").upsert(stop, on_conflict="name").execute()
        except Exception:
            # Fallback sin on_conflict
            try:
                client.table("pokestops").insert(stop).execute()
            except Exception as e:
                print(f"  [!] Nota Poképarada: {e}")

    # 5. Seeding de Gimnasios UniSabana
    print("[5/5] Insertando Gimnasios de Combate del Campus...")
    for gym in CAMPUS_GYMS:
        try:
            client.table("gymnasiums").upsert(gym, on_conflict="name").execute()
        except Exception:
            try:
                client.table("gymnasiums").insert(gym).execute()
            except Exception as e:
                print(f"  [!] Nota Gimnasio: {e}")

    print("[OK] Seeding relacional en Supabase completado exitosamente!")
    return True
