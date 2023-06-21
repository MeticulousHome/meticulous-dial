// @ts-check

/**
 * Physics-based spring animation.
 *
 * Ported from webkit C implementation to mimic Figma springs:
 * https://svn.webkit.org/repository/webkit/trunk/Source/WebCore/platform/graphics/SpringSolver.h
 * *
 * @param {number} t - timeline position, 0 to 1
 * @param {number} mass
 * @param {number} stiffness
 * @param {number} damping
 * @param {number?} initialVelocity
 */
const spring = (t, mass, stiffness, damping, initialVelocity = 0) => {
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

const springPhysicsPlugin = {
  /**
   * @typedef {{ value: number, unit?: { backupUnit?: string } }} LessValue
   * @param {any} less
   * @param {unknown} _pluginManager
   * @param {{ add: (name: string, implementation: (...args: LessValue[]) => any) => void }} functions
   */
  install: function (less, _pluginManager, functions) {
    functions.add(
      'spring',
      (
        t,
        from = { value: 0 },
        to = { value: 1 },
        mass = { value: 1 },
        stiffness = { value: 100 },
        damping = { value: 10 }
      ) =>
        less.dimension(
          spring(t.value / 100, mass.value, stiffness.value, damping.value) *
            (to.value - from.value) +
            from.value,
          to.unit?.backupUnit || from.unit?.backupUnit
        )
    );
  }
};

module.exports = springPhysicsPlugin;
