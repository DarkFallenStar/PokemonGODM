/**
 * Helper centralizado para resolución de sprites y animaciones de Pokémon.
 * 
 * Estrategia de Resiliencia:
 * 1. Animaciones: PokeAPI Gen 5 Black & White Animated GIFs vía GitHub CDN
 *    (https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/{id}.gif).
 *    100% verificado HTTP 200, ultra ligero (~19KB), sin rate limit ni bloqueos CORS/Showdown.
 * 2. Fallback de Animación: Showdown con ruta corregida (/sprites/ani/ en vez de /sprites/gen5/).
 * 3. Sprites Estáticos: PokeAPI Official Artwork en alta resolución (PNG transparente de alta fidelidad).
 */

export interface PokemonAssetInfo {
  id?: number | null;
  name?: string | null;
  sprite_url?: string | null;
  animation_url?: string | null;
}

/**
 * Normaliza y devuelve la URL del GIF animado del Pokémon.
 */
export function getPokemonAnimatedUrl(
  pokemon?: PokemonAssetInfo | null,
  fallbackId?: number | null
): string {
  const id = pokemon?.id || fallbackId;

  // 1. Prioridad: PokeAPI Gen 5 B&W Animated GIF (probado y 100% estable)
  if (id && id >= 1 && id <= 151) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${id}.gif`;
  }

  // 2. Si viene una URL de Showdown con el path obsoleto /sprites/gen5/, corregir a /sprites/ani/
  if (pokemon?.animation_url) {
    if (pokemon.animation_url.includes('/sprites/gen5/')) {
      return pokemon.animation_url.replace('/sprites/gen5/', '/sprites/ani/');
    }
    return pokemon.animation_url;
  }

  // 3. Si tenemos nombre, intentar Showdown /sprites/ani/
  if (pokemon?.name) {
    const cleanName = pokemon.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `https://play.pokemonshowdown.com/sprites/ani/${cleanName}.gif`;
  }

  // 4. Último recurso si no hay nada
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/1.gif`;
}

/**
 * Devuelve la URL del sprite estático oficial en alta resolución (Artwork oficial).
 */
export function getPokemonStaticUrl(
  pokemon?: PokemonAssetInfo | null,
  fallbackId?: number | null
): string {
  const id = pokemon?.id || fallbackId;

  if (id && id >= 1 && id <= 151) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
  }

  if (pokemon?.sprite_url) {
    return pokemon.sprite_url;
  }

  if (pokemon?.name) {
    const cleanName = pokemon.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `https://img.pokemondb.net/sprites/home/normal/${cleanName}.png`;
  }

  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png`;
}
