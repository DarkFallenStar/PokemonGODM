# Catálogo representativo de Movimientos Gen 1 (Rápidos y Cargados)
GEN1_MOVES = [
    # Normal
    {"id": 1, "name": "Tackle", "type_id": 1, "category": "fast", "power": 5, "energy_delta": 5, "duration_ms": 500},
    {"id": 2, "name": "Quick Attack", "type_id": 1, "category": "fast", "power": 8, "energy_delta": 10, "duration_ms": 800},
    {"id": 3, "name": "Hyper Beam", "type_id": 1, "category": "charged", "power": 150, "energy_delta": -100, "duration_ms": 3800},
    {"id": 4, "name": "Body Slam", "type_id": 1, "category": "charged", "power": 50, "energy_delta": -33, "duration_ms": 1900},
    # Fire
    {"id": 5, "name": "Ember", "type_id": 2, "category": "fast", "power": 10, "energy_delta": 10, "duration_ms": 1000},
    {"id": 6, "name": "Fire Spin", "type_id": 2, "category": "fast", "power": 14, "energy_delta": 10, "duration_ms": 1100},
    {"id": 7, "name": "Flamethrower", "type_id": 2, "category": "charged", "power": 70, "energy_delta": -50, "duration_ms": 2200},
    {"id": 8, "name": "Fire Blast", "type_id": 2, "category": "charged", "power": 140, "energy_delta": -100, "duration_ms": 4200},
    # Water
    {"id": 9, "name": "Water Gun", "type_id": 3, "category": "fast", "power": 5, "energy_delta": 5, "duration_ms": 500},
    {"id": 10, "name": "Bubble", "type_id": 3, "category": "fast", "power": 12, "energy_delta": 14, "duration_ms": 1200},
    {"id": 11, "name": "Hydro Pump", "type_id": 3, "category": "charged", "power": 130, "energy_delta": -100, "duration_ms": 3300},
    {"id": 12, "name": "Aqua Tail", "type_id": 3, "category": "charged", "power": 50, "energy_delta": -33, "duration_ms": 1900},
    # Grass
    {"id": 13, "name": "Vine Whip", "type_id": 4, "category": "fast", "power": 7, "energy_delta": 6, "duration_ms": 600},
    {"id": 14, "name": "Razor Leaf", "type_id": 4, "category": "fast", "power": 13, "energy_delta": 7, "duration_ms": 1000},
    {"id": 15, "name": "Solar Beam", "type_id": 4, "category": "charged", "power": 180, "energy_delta": -100, "duration_ms": 4900},
    {"id": 16, "name": "Power Whip", "type_id": 4, "category": "charged", "power": 90, "energy_delta": -50, "duration_ms": 2600},
    # Electric
    {"id": 17, "name": "Thunder Shock", "type_id": 5, "category": "fast", "power": 5, "energy_delta": 8, "duration_ms": 600},
    {"id": 18, "name": "Spark", "type_id": 5, "category": "fast", "power": 6, "energy_delta": 9, "duration_ms": 700},
    {"id": 19, "name": "Thunderbolt", "type_id": 5, "category": "charged", "power": 80, "energy_delta": -50, "duration_ms": 2500},
    {"id": 20, "name": "Thunder", "type_id": 5, "category": "charged", "power": 100, "energy_delta": -100, "duration_ms": 2400},
    # Ice
    {"id": 21, "name": "Ice Shard", "type_id": 6, "category": "fast", "power": 12, "energy_delta": 12, "duration_ms": 1200},
    {"id": 22, "name": "Blizzard", "type_id": 6, "category": "charged", "power": 130, "energy_delta": -100, "duration_ms": 3100},
    {"id": 23, "name": "Ice Beam", "type_id": 6, "category": "charged", "power": 90, "energy_delta": -50, "duration_ms": 3300},
    # Fighting
    {"id": 24, "name": "Karate Chop", "type_id": 7, "category": "fast", "power": 8, "energy_delta": 10, "duration_ms": 800},
    {"id": 25, "name": "Close Combat", "type_id": 7, "category": "charged", "power": 100, "energy_delta": -100, "duration_ms": 2300},
    # Poison
    {"id": 26, "name": "Poison Jab", "type_id": 8, "category": "fast", "power": 10, "energy_delta": 7, "duration_ms": 800},
    {"id": 27, "name": "Sludge Bomb", "type_id": 8, "category": "charged", "power": 80, "energy_delta": -50, "duration_ms": 2300},
    # Ground
    {"id": 28, "name": "Mud-Slap", "type_id": 9, "category": "fast", "power": 18, "energy_delta": 12, "duration_ms": 1400},
    {"id": 29, "name": "Earthquake", "type_id": 9, "category": "charged", "power": 140, "energy_delta": -100, "duration_ms": 3600},
    # Flying
    {"id": 30, "name": "Wing Attack", "type_id": 10, "category": "fast", "power": 8, "energy_delta": 9, "duration_ms": 800},
    {"id": 31, "name": "Air Slash", "type_id": 10, "category": "fast", "power": 14, "energy_delta": 10, "duration_ms": 1200},
    # Psychic
    {"id": 32, "name": "Confusion", "type_id": 11, "category": "fast", "power": 20, "energy_delta": 15, "duration_ms": 1600},
    {"id": 33, "name": "Psychic", "type_id": 11, "category": "charged", "power": 90, "energy_delta": -50, "duration_ms": 2800},
    # Bug
    {"id": 34, "name": "Bug Bite", "type_id": 12, "category": "fast", "power": 5, "energy_delta": 6, "duration_ms": 500},
    {"id": 35, "name": "X-Scissor", "type_id": 12, "category": "charged", "power": 45, "energy_delta": -33, "duration_ms": 1600},
    # Rock
    {"id": 36, "name": "Rock Throw", "type_id": 13, "category": "fast", "power": 12, "energy_delta": 7, "duration_ms": 900},
    {"id": 37, "name": "Rock Slide", "type_id": 13, "category": "charged", "power": 80, "energy_delta": -50, "duration_ms": 2700},
    # Ghost
    {"id": 38, "name": "Shadow Claw", "type_id": 14, "category": "fast", "power": 9, "energy_delta": 6, "duration_ms": 700},
    {"id": 39, "name": "Shadow Ball", "type_id": 14, "category": "charged", "power": 100, "energy_delta": -50, "duration_ms": 3000},
    # Dragon
    {"id": 40, "name": "Dragon Breath", "type_id": 15, "category": "fast", "power": 6, "energy_delta": 4, "duration_ms": 500},
    {"id": 41, "name": "Dragon Claw", "type_id": 15, "category": "charged", "power": 50, "energy_delta": -33, "duration_ms": 1700},
]
