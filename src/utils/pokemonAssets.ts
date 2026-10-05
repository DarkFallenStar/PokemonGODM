/**
 * Helper centralizado para Sprites y Animaciones de Pokémon.
 * REGLA ESTRICTA DE LA RÚBRICA Y USUARIO:
 * 1. Prohibido el uso de APIs externas (PokeAPI, etc.).
 * 2. Todos los assets provienen exclusivamente del web scraper de PokemonDB.
 * 3. Se usan los sprites animados oficiales de la Generación 5 (Black/White):
 *    https://img.pokemondb.net/sprites/black-white/anim/normal/{slug}.gif
 * 4. Fallback estático exclusivo de PokemonDB:
 *    https://img.pokemondb.net/sprites/home/normal/{slug}.png
 */

// Mapeo exhaustivo ID -> Slug para los 151 Pokémon de la Generación 1 (Kanto)
export const GEN1_SLUGS: Record<number, string> = {
  1: 'bulbasaur',
  2: 'ivysaur',
  3: 'venusaur',
  4: 'charmander',
  5: 'charmeleon',
  6: 'charizard',
  7: 'squirtle',
  8: 'wartortle',
  9: 'blastoise',
  10: 'caterpie',
  11: 'metapod',
  12: 'butterfree',
  13: 'weedle',
  14: 'kakuna',
  15: 'beedrill',
  16: 'pidgey',
  17: 'pidgeotto',
  18: 'pidgeot',
  19: 'rattata',
  20: 'raticate',
  21: 'spearow',
  22: 'fearow',
  23: 'ekans',
  24: 'arbok',
  25: 'pikachu',
  26: 'raichu',
  27: 'sandshrew',
  28: 'sandslash',
  29: 'nidoran-f',
  30: 'nidorina',
  31: 'nidoqueen',
  32: 'nidoran-m',
  33: 'nidorino',
  34: 'nidoking',
  35: 'clefairy',
  36: 'clefable',
  37: 'vulpix',
  38: 'ninetales',
  39: 'jigglypuff',
  40: 'wigglytuff',
  41: 'zubat',
  42: 'golbat',
  43: 'oddish',
  44: 'gloom',
  45: 'vileplume',
  46: 'paras',
  47: 'parasect',
  48: 'venonat',
  49: 'venomoth',
  50: 'diglett',
  51: 'dugtrio',
  52: 'meowth',
  53: 'persian',
  54: 'psyduck',
  55: 'golduck',
  56: 'mankey',
  57: 'primeape',
  58: 'growlithe',
  59: 'arcanine',
  60: 'poliwag',
  61: 'poliwhirl',
  62: 'poliwrath',
  63: 'abra',
  64: 'kadabra',
  65: 'alakazam',
  66: 'machop',
  67: 'machoke',
  68: 'machamp',
  69: 'bellsprout',
  70: 'weepinbell',
  71: 'victreebel',
  72: 'tentacool',
  73: 'tentacruel',
  74: 'geodude',
  75: 'graveler',
  76: 'golem',
  77: 'ponyta',
  78: 'rapidash',
  79: 'slowpoke',
  80: 'slowbro',
  81: 'magnemite',
  82: 'magneton',
  83: 'farfetchd',
  84: 'doduo',
  85: 'dodrio',
  86: 'seel',
  87: 'dewgong',
  88: 'grimer',
  89: 'muk',
  90: 'shellder',
  91: 'cloyster',
  92: 'gastly',
  93: 'haunter',
  94: 'gengar',
  95: 'onix',
  96: 'drowzee',
  97: 'hypno',
  98: 'krabby',
  99: 'kingler',
  100: 'voltorb',
  101: 'electrode',
  102: 'exeggcute',
  103: 'exeggutor',
  104: 'cubone',
  105: 'marowak',
  106: 'hitmonlee',
  107: 'hitmonchan',
  108: 'lickitung',
  109: 'koffing',
  110: 'weezing',
  111: 'rhyhorn',
  112: 'rhydon',
  113: 'chansey',
  114: 'tangela',
  115: 'kangaskhan',
  116: 'horsea',
  117: 'seadra',
  118: 'goldeen',
  119: 'seaking',
  120: 'staryu',
  121: 'starmie',
  122: 'mr-mime',
  123: 'scyther',
  124: 'jynx',
  125: 'electabuzz',
  126: 'magmar',
  127: 'pinsir',
  128: 'tauros',
  129: 'magikarp',
  130: 'gyarados',
  131: 'lapras',
  132: 'ditto',
  133: 'eevee',
  134: 'vaporeon',
  135: 'jolteon',
  136: 'flareon',
  137: 'porygon',
  138: 'omanyte',
  139: 'omastar',
  140: 'kabuto',
  141: 'kabutops',
  142: 'aerodactyl',
  143: 'snorlax',
  144: 'articuno',
  145: 'zapdos',
  146: 'moltres',
  147: 'dratini',
  148: 'dragonair',
  149: 'dragonite',
  150: 'mewtwo',
  151: 'mew',
};

/**
 * Normaliza cualquier nombre de Pokémon al slug estándar de PokemonDB.
 */
export function getPokemonDbSlug(name?: string | null, id?: number | null): string {
  if (id && GEN1_SLUGS[id]) {
    return GEN1_SLUGS[id];
  }

  if (!name) {
    return 'bulbasaur';
  }

  let cleaned = name.toLowerCase();
  cleaned = cleaned.replace(/♀/g, '-f');
  cleaned = cleaned.replace(/♂/g, '-m');
  cleaned = cleaned.replace(/[\.':]/g, '');
  cleaned = cleaned.replace(/[^a-z0-9]+/g, '-');
  return cleaned.replace(/^-+|-+$/g, '');
}

/**
 * Genera la URL del Sprite Animado de Generación 5 (Black/White) de PokemonDB.
 * Son los únicos sprites oficiales de PokemonDB que cuentan con animación GIF.
 */
export function getPokemonDbAnimatedSprite(name?: string | null, id?: number | null): string {
  const slug = getPokemonDbSlug(name, id);
  return `https://img.pokemondb.net/sprites/black-white/anim/normal/${slug}.gif`;
}

/**
 * Genera la URL del Sprite Estático oficial de PokemonDB (HOME render).
 */
export function getPokemonDbStaticSprite(name?: string | null, id?: number | null): string {
  const slug = getPokemonDbSlug(name, id);
  return `https://img.pokemondb.net/sprites/home/normal/${slug}.png`;
}

/**
 * Obtiene la jerarquía estricta de URLs de sprites cumpliendo las directivas:
 * 1. Prioridad: GIF animado Gen 5 de PokemonDB
 * 2. Fallback: Sprite estático PNG de PokemonDB
 * 3. Cero llamadas a APIs externas.
 */
export function getPokemonSpriteSources(pokemon?: {
  id?: number | null;
  name?: string | null;
  animation_url?: string | null;
  sprite_url?: string | null;
} | null) {
  const slug = getPokemonDbSlug(pokemon?.name, pokemon?.id);

  // Asegurar que si viene una URL de animación, no apunte a servicios desaprobados
  let animatedUrl = pokemon?.animation_url;
  if (!animatedUrl || !animatedUrl.includes('pokemondb.net')) {
    animatedUrl = `https://img.pokemondb.net/sprites/black-white/anim/normal/${slug}.gif`;
  }

  let staticUrl = pokemon?.sprite_url;
  if (!staticUrl || !staticUrl.includes('pokemondb.net')) {
    staticUrl = `https://img.pokemondb.net/sprites/home/normal/${slug}.png`;
  }

  return {
    primaryUrl: animatedUrl,
    fallbackUrl: staticUrl,
    slug,
  };
}
