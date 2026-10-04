import os
from pathlib import Path

# Raíz del proyecto
ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT_DIR / ".env"

def load_env():
    env_vars = {}
    if ENV_PATH.exists():
        with open(ENV_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    env_vars[key.strip()] = val.strip()
    return env_vars

_env = load_env()

SUPABASE_URL = _env.get("EXPO_PUBLIC_SUPABASE_URL") or os.environ.get("EXPO_PUBLIC_SUPABASE_URL", "")
# Preferir service_role si existe para operaciones de backend/seeding; fallback a anon_key
SUPABASE_KEY = (
    _env.get("SUPABASE_SERVICE_ROLE_KEY") 
    or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") 
    or _env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY") 
    or os.environ.get("EXPO_PUBLIC_SUPABASE_ANON_KEY", "")
)
MAPBOX_TOKEN = _env.get("RNMAPBOX_MAPS_DOWNLOAD_TOKEN", "")

BUCKET_NAME = "pokemon-sprites"
POKEMON_DB_BASE_URL = "https://pokemondb.net"
POKEDEX_URL = "https://pokemondb.net/pokedex/all"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
}
