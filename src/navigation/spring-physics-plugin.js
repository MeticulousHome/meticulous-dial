// @ts-check

/**
 * Physics-based spring animation.
 *
 * Ported from webkit C implementation to mimic Figma springs:
 * https://svn.webkit.org/repository/webkit/trunk/Source/WebCore/platform/graphics/SpringSolver.h
 *
 * @typedef {{ mass: number, stiffness: number, damping: number, initialVelocity?: number }} SpringConfig
 *
 * @param {number} t - timeline position, 0 to 1
 * @param {SpringConfig} config
 */
const spring = (t, { mass, stiffness, damping, initialVelocity = 0 }) => {
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const wd = w0 * Math.sqrt(1 - zeta * zeta);
  const A = 1;
  const B =
    zeta < 1 ? (zeta * w0 + -initialVelocity) / wd : -initialVelocity + w0;

  if (zeta < 1) {
    // Under-damped
    t =
      Math.exp(-t * zeta * w0) * (A * Math.cos(wd * t) + B * Math.sin(wd * t));
  } else {
    // Critically damped (ignoring over-damped case for now).
    t = (A + B * t) * Math.exp(-t * w0);
  }
  // Map range from [1..0] to [0..1].
  return 1 - t;
};

const presets = {
  default: {
    mass: 1,
    stiffness: 100,
    damping: 10
  }
};

const springPhysicsPlugin = {
  /**
   * @typedef {{ value: number, unit?: unknown }} LessValue
   * @param {any} less
   * @param {unknown} _pluginManager
   * @param {{ add: (name: string, implementation: (...args: LessValue[]) => any) => void }} functions
   */
  install: function (less, _pluginManager, functions) {
    functions.add('spring', (t, from = { value: 0 }, to = { value: 1 }) =>
      less.dimension(
        spring(t.value / 100, presets.default) * (to.value - from.value) +
          from.value,
        to.unit || from.unit
      )
    );
  }
};

module.exports = springPhysicsPlugin;
