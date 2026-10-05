import sys
import json
import argparse
from pathlib import Path

# Configurar stdout a utf-8 para compatibilidad con Windows cp1252
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from .parser import scrape_gen1_pokemon
from .storage import ensure_bucket_exists, process_pokemon_media
from .seeder import seed_database

OUTPUT_JSON = Path(__file__).resolve().parent / "pokemon_gen1.json"

def main():
    parser = argparse.ArgumentParser(description="Pokémon GO UniSabana - Web Scraping & Seeding Pipeline")
    parser.add_argument("--limit", type=int, default=151, help="Número de Pokémon a extraer (default: 151)")
    parser.add_argument("--dry-run", action="store_true", help="Solo realiza scraping y guarda JSON local sin subir a Supabase")
    parser.add_argument("--skip-storage", action="store_true", help="Usa directamente las URLs externas sin subir archivos a Supabase Storage")
    args = parser.parse_args()

    print("=" * 70)
    print("  POKÉMON GO UNISABANA - PIPELINE DE EXTRACCIÓN Y SEEDING (ETAPA 2)")
    print("=" * 70)

    # 1. Extracción de Datos
    pokemon_list = scrape_gen1_pokemon(limit=args.limit)

    # Asignar URLs remotas por defecto a todos los Pokémon
    for p in pokemon_list:
        p.sprite_url = p.sprite_remote_url
        p.animation_url = p.animation_remote_url

    # 2. Procesamiento Opcional de Multimedia en Storage
    if not args.dry_run and not args.skip_storage:
        print("\n[*] Verificando bucket de Supabase Storage ('pokemon-sprites')...")
        ensure_bucket_exists()
        print("[*] Procesando y asociando URLs de sprites y animaciones en Storage...")
        for p in pokemon_list[:10]: # Probar en demo y mantener URLs si es exitoso
            s_url, a_url = process_pokemon_media(p.id, p.sprite_remote_url, p.animation_remote_url)
            p.sprite_url = s_url
            p.animation_url = a_url

    # 3. Exportación a JSON local (Backup / Auditoría)
    print(f"\n[*] Guardando respaldo JSON en: {OUTPUT_JSON}...")
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump([p.model_dump() for p in pokemon_list], f, indent=2, ensure_ascii=False)
    print(f"[OK] Respaldo guardado exitosamente ({len(pokemon_list)} registros).")

    # 4. Seeding en Supabase
    if not args.dry_run:
        seed_database(pokemon_list)
    else:
        print("\n[i] Modo --dry-run activado: No se realizaron mutaciones en Supabase.")

    print("\n" + "=" * 70)
    print("  [OK] PIPELINE DE ETAPA 2 FINALIZADO CON EXITO")
    print("=" * 70)

if __name__ == "__main__":
    main()
