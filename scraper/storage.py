import io
import requests
from typing import Tuple, Optional
from supabase import create_client, Client
from .config import SUPABASE_URL, SUPABASE_KEY, BUCKET_NAME, HEADERS

_supabase_client: Optional[Client] = None

def get_supabase_client() -> Optional[Client]:
    global _supabase_client
    if _supabase_client is None and SUPABASE_URL and SUPABASE_KEY:
        try:
            _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        except Exception as e:
            print(f"[!] Error inicializando cliente Supabase: {e}")
            _supabase_client = None
    return _supabase_client

def ensure_bucket_exists():
    client = get_supabase_client()
    if not client:
        return
    try:
        # Intentar listar o crear bucket
        buckets = client.storage.list_buckets()
        bucket_names = [b.name for b in buckets]
        if BUCKET_NAME not in bucket_names:
            print(f"[*] Creando bucket de almacenamiento: '{BUCKET_NAME}'...")
            client.storage.create_bucket(BUCKET_NAME, options={"public": True})
            print(f"[OK] Bucket '{BUCKET_NAME}' creado exitosamente.")
    except Exception as e:
        print(f"[i] Nota sobre bucket Storage: {e}")

def upload_file_to_storage(url: str, path_in_bucket: str, mime_type: str) -> Optional[str]:
    """
    Descarga en memoria y sube a Supabase Storage.
    Retorna la URL pública de Supabase Storage si tiene éxito, o None si falla.
    """
    client = get_supabase_client()
    if not client:
        return None

    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        if resp.status_code != 200:
            return None

        file_bytes = resp.content
        # Subir archivo al bucket
        client.storage.from_(BUCKET_NAME).upload(
            path=path_in_bucket,
            file=file_bytes,
            file_options={"content-type": mime_type, "upsert": "true"}
        )
        # Obtener URL pública
        public_url = client.storage.from_(BUCKET_NAME).get_public_url(path_in_bucket)
        return public_url
    except Exception as e:
        # Si la API anon no tiene permisos de upload (requiere service_role), advertir y continuar
        return None

def process_pokemon_media(poke_id: int, static_remote_url: str, anim_remote_url: str) -> Tuple[str, str]:
    """
    Intenta subir los archivos al Storage de Supabase.
    Si falla el upload (por RLS o cuota), hace fallback a la URL pública directa para no interrumpir el flujo.
    """
    static_public_url = upload_file_to_storage(
        static_remote_url,
        f"static/{poke_id}.png",
        "image/png"
    )
    anim_public_url = upload_file_to_storage(
        anim_remote_url,
        f"animated/{poke_id}.gif",
        "image/gif"
    )

    final_static = static_public_url or static_remote_url
    final_anim = anim_public_url or anim_remote_url

    return final_static, final_anim
