/**
 * Helper para resolución de sprites y animaciones oficiales de Pokémon.
 * 
 * Cumplimiento Estricto del Enunciado (Módulo 2):
 * - Queda terminantemente prohibido el uso de APIs preconstruidas (ej. PokéAPI).
 * - Todos los recursos provienen exclusivamente del catálogo extraído mediante
 *   Web Scraping y persistido en la base de datos Supabase (pokemon_base).
 * - Sprites estáticos: Extraídos de PokemonDB (sprite_url).
 * - Animaciones de combate: Extraídas de Pokémon Showdown (animation_url).
 */

export interface PokemonAssetInfo {
  id?: number | null;
  name?: string | null;
  sprite_url?: string | null;
  animation_url?: string | null;
}

/**
 * Convierte el nombre del Pokémon al formato slug utilizado por el scraper de PokemonDB y Showdown.
 */
function getPokemonSlug(name?: string | null): string {
  if (!name) return 'bulbasaur';
  return name
    .toLowerCase()
    .trim()
    .replace(/♀/g, '-f')
    .replace(/♂/g, '-m')
    .replace(/['.:]/g, '')
    .replace(/\s+/g, '-');
}

/**
 * Resuelve la URL de la animación de combate (GIF animado de Showdown)
 * a partir de los datos almacenados en Supabase.
 * Corrige automáticamente cualquier desfase en el path (/sprites/gen5/ -> /sprites/ani/).
 */
export function getPokemonAnimatedUrl(
  pokemon?: PokemonAssetInfo | null
): string {
  // 1. Si Supabase ya provee la URL de animación, normalizar el path de Showdown
  if (pokemon?.animation_url) {
    if (pokemon.animation_url.includes('/sprites/gen5/')) {
      return pokemon.animation_url.replace('/sprites/gen5/', '/sprites/ani/');
    }
    return pokemon.animation_url;
  }

  // 2. Construir la URL de animación de Showdown a partir del nombre extraído por el scraper
  const slug = getPokemonSlug(pokemon?.name);
  return `https://play.pokemonshowdown.com/sprites/ani/${slug}.gif`;
}

/**
 * Resuelve la URL del sprite estático oficial extraído de PokemonDB
 * a partir de los datos almacenados en Supabase.
 */
export function getPokemonStaticUrl(
  pokemon?: PokemonAssetInfo | null
): string {
  if (pokemon?.sprite_url) {
    return pokemon.sprite_url;
  }

  // Fallback generado con el patrón exacto del Web Scraper (PokemonDB)
  const slug = getPokemonSlug(pokemon?.name);
  return `https://img.pokemondb.net/sprites/home/normal/${slug}.png`;
}
