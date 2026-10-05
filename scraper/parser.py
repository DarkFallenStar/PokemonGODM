import re
import requests
from bs4 import BeautifulSoup
from typing import List, Dict, Tuple
from .config import POKEDEX_URL, HEADERS
from .models import PokemonScrapedModel

# Diccionario estándar de ratios de captura base (Gen 1)
# Si no está explícito en la tabla principal, aplicamos los ratios de Pokémon GO oficial
CATCH_RATES = {
    "legendary": 0.03,  # Articuno, Zapdos, Moltres, Mewtwo, Mew
    "starter": 0.20,    # Bulbasaur, Charmander, Squirtle, Pikachu
    "rare": 0.15,       # Snorlax, Lapras, Dragonite, Gyarados
    "uncommon": 0.30,   # Pidgeotto, Golbat, etc.
    "common": 0.50      # Pidgey, Rattata, Caterpie, Weedle
}

LEGENDARY_IDS = {144, 145, 146, 150, 151}
STARTER_FAMILY_IDS = {1, 2, 3, 4, 5, 6, 7, 8, 9, 25, 26}
RARE_IDS = {130, 131, 143, 147, 148, 149}

def get_base_catch_rate(poke_id: int) -> float:
    if poke_id in LEGENDARY_IDS:
        return CATCH_RATES["legendary"]
    if poke_id in STARTER_FAMILY_IDS:
        return CATCH_RATES["starter"]
    if poke_id in RARE_IDS:
        return CATCH_RATES["rare"]
    return 0.40

def slugify(name: str) -> str:
    cleaned = name.lower()
    cleaned = re.sub(r"[♀]", "-f", cleaned)
    cleaned = re.sub(r"[♂]", "-m", cleaned)
    cleaned = re.sub(r"[\.':]", "", cleaned)
    cleaned = re.sub(r"[^a-z0-9]+", "-", cleaned)
    return cleaned.strip("-")

def scrape_gen1_pokemon(limit: int = 151) -> List[PokemonScrapedModel]:
    print(f"[*] Conectando a {POKEDEX_URL}...")
    response = requests.get(POKEDEX_URL, headers=HEADERS, timeout=20)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    table = soup.find("table", {"id": "pokedex"})
    if not table:
        raise ValueError("No se encontró la tabla id='pokedex' en PokemonDB.")

    rows = table.find("tbody").find_all("tr")
    pokemon_list: List[PokemonScrapedModel] = []
    seen_ids = set()

    for row in rows:
        cols = row.find_all("td")
        if not cols or len(cols) < 10:
            continue

        id_text = cols[0].text.strip()
        num_match = re.search(r"\d+", id_text)
        if not num_match:
            continue
        poke_id = int(num_match.group(0))

        # Restricción Generación 1: IDs del 1 al 151
        if poke_id > limit:
            break
        if poke_id in seen_ids:
            continue  # Saltar formas alternas (Mega, Alola, Galarian)

        name_col = cols[1]
        name_link = name_col.find("a")
        if not name_link:
            continue
        name = name_link.text.strip()

        # Tipos
        types_col = cols[2]
        type_links = types_col.find_all("a")
        type_primary = type_links[0].text.strip().capitalize() if len(type_links) > 0 else "Normal"
        type_secondary = type_links[1].text.strip().capitalize() if len(type_links) > 1 else None

        # Stats base: HP, Atk, Def, SpAtk, SpDef, Speed
        hp = int(cols[4].text.strip())
        attack = int(cols[5].text.strip())
        defense = int(cols[6].text.strip())
        sp_attack = int(cols[7].text.strip())
        sp_defense = int(cols[8].text.strip())
        speed = int(cols[9].text.strip())

        slug = slugify(name)

        # Enlaces de Sprites Estáticos y Animaciones
        # Fuente 1: PokemonDB sprites directos
        # Fuente 2: Pokemon Showdown Animated GIFs (estándar de la industria)
        static_url = f"https://img.pokemondb.net/sprites/home/normal/{slug}.png"
        animated_url = f"https://play.pokemonshowdown.com/sprites/ani/{slug}.gif"

        poke = PokemonScrapedModel(
            id=poke_id,
            name=name,
            type_primary=type_primary,
            type_secondary=type_secondary,
            hp=hp,
            attack=attack,
            defense=defense,
            sp_attack=sp_attack,
            sp_defense=sp_defense,
            speed=speed,
            base_catch_rate=get_base_catch_rate(poke_id),
            sprite_remote_url=static_url,
            animation_remote_url=animated_url
        )
        poke.base_cp = poke.calculate_cp()

        pokemon_list.append(poke)
        seen_ids.add(poke_id)

    print(f"[OK] Se extrajeron exitosamente {len(pokemon_list)} Pokemon de la Generacion 1.")
    return pokemon_list
