import type { BallType, ThrowGrade } from '../types/capture';

export interface CatchProbabilityInput {
  baseCatchRate: number; // 0.03 a 0.50
  level?: number; // 1 a 20 (estimado de CP)
  cp?: number;
  ballType: BallType;
  throwGrade: ThrowGrade;
  isCurveBall?: boolean;
}

export interface ThrowEvaluation {
  grade: ThrowGrade;
  multiplier: number;
  label: string;
  bonusXp: number;
}

export const BALL_MULTIPLIERS: Record<BallType, number> = {
  pokeball: 1.0,
  greatball: 1.5,
  ultraball: 2.0,
};

export const THROW_GRADE_MULTIPLIERS: Record<ThrowGrade, number> = {
  normal: 1.0,
  nice: 1.15,
  great: 1.5,
  excellent: 1.85,
};

/**
 * Evalúa cuantitativamente la calidad del tiro según el radio del anillo concéntrico al momento del impacto.
 * @param impactDistancePx Distancia radial del impacto al centro del Hitbox
 * @param currentRingRadiusPx Radio instantáneo del anillo interior
 * @param maxRingRadiusPx Radio máximo del anillo exterior (fijo)
 */
export function evaluateThrowGrade(
  impactDistancePx: number,
  currentRingRadiusPx: number,
  maxRingRadiusPx: number
): ThrowEvaluation {
  // Si impacta fuera del círculo dinámico interior pero dentro del Hitbox exterior -> Normal
  if (impactDistancePx > currentRingRadiusPx) {
    return {
      grade: 'normal',
      multiplier: THROW_GRADE_MULTIPLIERS.normal,
      label: '',
      bonusXp: 0,
    };
  }

  // Radio normalizado de 0 a 1 respecto al tamaño máximo
  const ringRatio = currentRingRadiusPx / maxRingRadiusPx;

  if (ringRatio <= 0.35) {
    return {
      grade: 'excellent',
      multiplier: THROW_GRADE_MULTIPLIERS.excellent,
      label: '¡Excellent Throw!',
      bonusXp: 100,
    };
  }

  if (ringRatio <= 0.70) {
    return {
      grade: 'great',
      multiplier: THROW_GRADE_MULTIPLIERS.great,
      label: '¡Great Throw!',
      bonusXp: 50,
    };
  }

  return {
    grade: 'nice',
    multiplier: THROW_GRADE_MULTIPLIERS.nice,
    label: '¡Nice Throw!',
    bonusXp: 20,
  };
}

/**
 * Calcula el CPM (CP Multiplier) escalado a partir del nivel o CP de la criatura.
 */
export function getCpMultiplier(level: number = 10, cp: number = 100): number {
  const effectiveLevel = Math.max(1, Math.min(20, level || Math.ceil(cp / 60)));
  // Fórmula canónica aproximada de CPM para niveles 1-20
  return 0.094 * Math.sqrt(effectiveLevel);
}

/**
 * Calcula la probabilidad final de captura aplicando la ecuación exponencial multivariable.
 * P = 1 - (1 - BCR / (2 * CPM))^(M_ball * M_throw * M_curve)
 */
export function calculateCatchProbability(input: CatchProbabilityInput): number {
  const bcr = Math.max(0.02, Math.min(0.60, input.baseCatchRate || 0.40));
  const cpm = getCpMultiplier(input.level, input.cp);

  const baseFraction = Math.max(0.01, Math.min(0.95, bcr / (2 * cpm)));

  const ballMult = BALL_MULTIPLIERS[input.ballType] || 1.0;
  const throwMult = THROW_GRADE_MULTIPLIERS[input.throwGrade] || 1.0;
  const curveMult = input.isCurveBall ? 1.2 : 1.0;

  const totalExponent = ballMult * throwMult * curveMult;

  // Ecuación canónica de probabilidad compuesta
  const catchProbability = 1 - Math.pow(1 - baseFraction, totalExponent);

  return Math.max(0.05, Math.min(0.98, catchProbability));
}

/**
 * Determina el color cromático del anillo interactivo según la dificultad intrínseca de captura.
 */
export function getTargetRingColor(baseCatchRate: number, ballType: BallType = 'pokeball'): string {
  const prob = calculateCatchProbability({
    baseCatchRate,
    ballType,
    throwGrade: 'normal',
  });

  if (prob >= 0.55) {
    return '#22C55E'; // Verde: Captura muy accesible
  }
  if (prob >= 0.30) {
    return '#EAB308'; // Amarillo: Dificultad intermedia
  }
  return '#EF4444'; // Rojo: Criatura esquiva / baja probabilidad
}

export interface ShakeSimulationResult {
  isCaptured: boolean;
  shakesCompleted: number; // 0, 1, 2, 3
  hasFled: boolean;
}

/**
 * Ejecuta la simulación estocástica de los 4 cuartiles de probabilidad (3 sacudidas + bloqueo).
 */
export function simulateCaptureShakes(
  catchProbability: number,
  baseFleeRate: number = 0.08
): ShakeSimulationResult {
  // Probabilidad condicional por cada sacudida individual (raíz cuarta de la probabilidad total)
  const shakeProb = Math.pow(catchProbability, 0.25);

  let shakesCompleted = 0;
  for (let i = 0; i < 4; i++) {
    const roll = Math.random();
    if (roll < shakeProb) {
      if (i < 3) {
        shakesCompleted += 1;
      }
    } else {
      // Falló en esta sacudida: la bola se rompe y el Pokémon escapa
      const fleeRoll = Math.random();
      const hasFled = fleeRoll < baseFleeRate;
      return {
        isCaptured: false,
        shakesCompleted,
        hasFled,
      };
    }
  }

  // Superó los 4 chequeos estocásticos -> ¡Capturado con éxito!
  return {
    isCaptured: true,
    shakesCompleted: 3,
    hasFled: false,
  };
}
