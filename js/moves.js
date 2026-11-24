/* ============================================================
   Poses, moves and hitbox data.
   Pose coordinates are local to the pelvis: +x = forward (facing),
   +y = down. IK limbs are solved in the renderer.
   ============================================================ */

export const STAND = {
  hipY: 74, lean: 0.06, tilt: 0, rot: 0, offY: 0,
  handF: { x: 26, y: -52 }, handB: { x: 10, y: -44 },
  footF: { x: 22, y: 74 }, footB: { x: -24, y: 74 },
};

export const GUARD = {
  hipY: 71, lean: 0.015, tilt: 0.03, rot: 0, offY: 0,
  handF: { x: 24, y: -66 }, handB: { x: 6, y: -72 },
  footF: { x: 20, y: 71 }, footB: { x: -26, y: 71 },
};

export const CROUCH = {
  hipY: 43, lean: 0.24, tilt: 0.06, rot: 0, offY: 0,
  handF: { x: 22, y: -28 }, handB: { x: 6, y: -18 },
  footF: { x: 26, y: 43 }, footB: { x: -26, y: 43 },
};

export const CROUCH_GUARD = {
  hipY: 43, lean: 0.16, tilt: 0.05, rot: 0, offY: 0,
  handF: { x: 22, y: -50 }, handB: { x: 8, y: -44 },
  footF: { x: 26, y: 43 }, footB: { x: -26, y: 43 },
};

export const AIR = {
  hipY: 74, lean: 0.08, tilt: 0, rot: 0, offY: 0,
  handF: { x: 18, y: -50 }, handB: { x: 2, y: -40 },
  footF: { x: 20, y: 96 }, footB: { x: -14, y: 102 },
};

const BASE = { stand: STAND, crouch: CROUCH, air: AIR };

function frame(base, t, o) {
  return {
    t,
    hipY: o.hipY ?? base.hipY,
    lean: o.lean ?? base.lean,
    tilt: o.tilt ?? base.tilt,
    rot: o.rot ?? base.rot,
    offY: o.offY ?? base.offY ?? 0,
    handF: o.handF ?? base.handF,
    handB: o.handB ?? base.handB,
    footF: o.footF ?? base.footF,
    footB: o.footB ?? base.footB,
  };
}

function F(base, t, o) { return frame(base, t, o); }

/* ============================================================
   MOVES
   ============================================================ */
function def(o) {
  const total = o.startup + o.active + o.recover;
  return {
    chip: 0,
    hitstun: 0.24,
    blockstun: 0.16,
    kb: 140,
    low: false,
    overhead: false,
    knockdown: false,
    launch: false,
    maxHits: 1,
    hitInterval: 0,
    meterGain: 6,
    shake: 4,
    hitstop: 0.05,
    poseKind: 'stand',
    vx: 0,
    gravityLift: 0,
    ...o,
    total,
  };
}

export const MOVES = {
  jab: def({
    id: 'jab', label: 'JAB', startup: 0.05, active: 0.06, recover: 0.11,
    damage: 34, hitstun: 0.2, blockstun: 0.12, kb: 120, meterGain: 5,
    hitbox: { x: 24, y: 96, w: 48, h: 38 }, shake: 3, hitstop: 0.045,
    sfx: 'light',
    anim: [
      F(STAND, 0, {}),
      F(STAND, 0.04, { hipY: 73, lean: 0.01, handF: { x: 14, y: -50 }, handB: { x: 12, y: -48 } }),
      F(STAND, 0.08, {
        lean: 0.16, handF: { x: 64, y: -55 }, handB: { x: 6, y: -44 },
        footF: { x: 28, y: 74 }, footB: { x: -27, y: 74 },
      }),
      F(STAND, 0.15, { lean: 0.13, handF: { x: 58, y: -54 } }),
      F(STAND, 0.22, {}),
    ],
  }),

  heavy: def({
    id: 'heavy', label: 'HEAVY', startup: 0.13, active: 0.07, recover: 0.27,
    damage: 84, hitstun: 0.34, blockstun: 0.21, kb: 330, meterGain: 9,
    hitbox: { x: 22, y: 82, w: 62, h: 52 }, shake: 8, hitstop: 0.085,
    sfx: 'heavy',
    anim: [
      F(STAND, 0, {}),
      F(STAND, 0.12, {
        hipY: 70, lean: -0.14, handF: { x: 2, y: -42 }, handB: { x: 22, y: -52 },
        footF: { x: 18, y: 70 }, footB: { x: -28, y: 70 },
      }),
      F(STAND, 0.18, {
        hipY: 74, lean: 0.27, handF: { x: 80, y: -50 }, handB: { x: -8, y: -30 },
        footF: { x: 36, y: 70 }, footB: { x: -30, y: 74 },
      }),
      F(STAND, 0.29, { lean: 0.23, handF: { x: 72, y: -50 }, handB: { x: -4, y: -32 } }),
      F(STAND, 0.47, {}),
    ],
  }),

  kick: def({
    id: 'kick', label: 'ROUNDHOUSE', startup: 0.11, active: 0.09, recover: 0.24,
    damage: 66, hitstun: 0.28, blockstun: 0.18, kb: 250, meterGain: 7,
    hitbox: { x: 28, y: 76, w: 60, h: 56 }, shake: 6, hitstop: 0.07,
    sfx: 'heavy',
    anim: [
      F(STAND, 0, {}),
      F(STAND, 0.1, {
        hipY: 72, lean: -0.04, footF: { x: 34, y: 40 }, footB: { x: -22, y: 72 },
        handF: { x: 24, y: -44 }, handB: { x: 2, y: -34 },
      }),
      F(STAND, 0.18, {
        hipY: 74, lean: -0.16, footF: { x: 78, y: -34 }, footB: { x: -18, y: 74 },
        handF: { x: -12, y: -34 }, handB: { x: 22, y: -20 },
      }),
      F(STAND, 0.3, { hipY: 73, lean: -0.13, footF: { x: 72, y: -30 } }),
      F(STAND, 0.44, {}),
    ],
  }),

  crouchJab: def({
    id: 'crouchJab', label: 'LOW JAB', startup: 0.04, active: 0.05, recover: 0.15,
    damage: 26, low: true, hitstun: 0.2, blockstun: 0.12, kb: 90, meterGain: 4,
    poseKind: 'crouch', hitbox: { x: 22, y: 34, w: 50, h: 42 }, shake: 3, hitstop: 0.04,
    sfx: 'light',
    anim: [
      F(CROUCH, 0, {}),
      F(CROUCH, 0.03, { lean: 0.3, handF: { x: 10, y: -18 }, handB: { x: 16, y: -16 } }),
      F(CROUCH, 0.08, { lean: 0.38, handF: { x: 58, y: -8 }, handB: { x: 2, y: -12 } }),
      F(CROUCH, 0.14, { lean: 0.34, handF: { x: 52, y: -8 } }),
      F(CROUCH, 0.24, {}),
    ],
  }),

  sweep: def({
    id: 'sweep', label: 'SWEEP', startup: 0.14, active: 0.09, recover: 0.27,
    damage: 62, low: true, knockdown: true, hitstun: 0.5, blockstun: 0.2, kb: 230,
    meterGain: 8, poseKind: 'crouch', hitbox: { x: 20, y: 0, w: 72, h: 40 },
    shake: 7, hitstop: 0.08, sfx: 'heavy',
    anim: [
      F(CROUCH, 0, {}),
      F(CROUCH, 0.13, {
        hipY: 46, lean: 0.1, footF: { x: 22, y: 46 }, handF: { x: 16, y: -16 },
        handB: { x: -6, y: -10 },
      }),
      F(CROUCH, 0.21, {
        hipY: 38, lean: 0.42, footF: { x: 84, y: 42 }, footB: { x: -30, y: 40 },
        handF: { x: 34, y: -6 }, handB: { x: -16, y: 4 },
      }),
      F(CROUCH, 0.34, { hipY: 38, lean: 0.38, footF: { x: 80, y: 42 } }),
      F(CROUCH, 0.5, {}),
    ],
  }),

  airPunch: def({
    id: 'airPunch', label: 'AIR JAB', startup: 0.05, active: 0.08, recover: 0.17,
    damage: 44, overhead: true, hitstun: 0.28, blockstun: 0.16, kb: 180,
    meterGain: 6, poseKind: 'air', hitbox: { x: 18, y: 60, w: 50, h: 52 },
    shake: 5, hitstop: 0.05, sfx: 'light',
    anim: [
      F(AIR, 0, {}),
      F(AIR, 0.04, { lean: -0.05, handF: { x: 8, y: -44 }, handB: { x: 4, y: -36 } }),
      F(AIR, 0.11, {
        lean: 0.24, handF: { x: 60, y: -52 }, handB: { x: 0, y: -34 },
        footF: { x: 24, y: 92 }, footB: { x: -18, y: 100 },
      }),
      F(AIR, 0.19, { lean: 0.2, handF: { x: 54, y: -50 } }),
      F(AIR, 0.3, {}),
    ],
  }),

  airKick: def({
    id: 'airKick', label: 'AIR KICK', startup: 0.06, active: 0.1, recover: 0.18,
    damage: 58, overhead: true, hitstun: 0.3, blockstun: 0.18, kb: 210,
    meterGain: 7, poseKind: 'air', hitbox: { x: 20, y: 34, w: 58, h: 54 },
    shake: 6, hitstop: 0.065, sfx: 'heavy',
    anim: [
      F(AIR, 0, {}),
      F(AIR, 0.05, { hipY: 76, footF: { x: 28, y: 82 }, footB: { x: -20, y: 96 }, lean: -0.06 }),
      F(AIR, 0.14, {
        lean: 0.06, footF: { x: 74, y: 56 }, footB: { x: -22, y: 92 },
        handF: { x: 6, y: -54 }, handB: { x: -20, y: -30 },
      }),
      F(AIR, 0.24, { footF: { x: 68, y: 60 } }),
      F(AIR, 0.34, {}),
    ],
  }),

  fireball: def({
    id: 'fireball', label: 'SUNFIRE', startup: 0.21, active: 0.06, recover: 0.29,
    damage: 0, meterGain: 12, sfx: 'fireball', special: true, hitstop: 0,
    projectile: {
      speed: 720, height: 100, radius: 23, damage: 106, chip: 12,
      hitstun: 0.32, blockstun: 0.24, kb: 300, shake: 7,
    },
    anim: [
      F(STAND, 0, {}),
      F(STAND, 0.1, {
        hipY: 70, lean: -0.08, handF: { x: 2, y: -26 }, handB: { x: -12, y: -20 },
        footF: { x: 18, y: 70 }, footB: { x: -28, y: 70 },
      }),
      F(STAND, 0.23, {
        hipY: 73, lean: 0.24, handF: { x: 60, y: -34 }, handB: { x: 50, y: -30 },
        footF: { x: 30, y: 72 }, footB: { x: -28, y: 74 },
      }),
      F(STAND, 0.38, { lean: 0.2, handF: { x: 56, y: -34 }, handB: { x: 46, y: -30 } }),
      F(STAND, 0.56, {}),
    ],
  }),

  dp: def({
    id: 'dp', label: 'RISING FIST', startup: 0.07, active: 0.2, recover: 0.39,
    damage: 138, hitstun: 0.5, blockstun: 0.22, kb: 140, launch: true, knockdown: true,
    meterGain: 14, special: true, invuln: 0.24, shake: 10, hitstop: 0.11,
    hitbox: { x: 2, y: 76, w: 50, h: 96 }, sfx: 'uppercut',
    liftY: 780, vx: 150,
    anim: [
      F(STAND, 0, {}),
      F(STAND, 0.07, {
        hipY: 54, lean: 0.2, handF: { x: 12, y: -18 }, handB: { x: 10, y: -30 },
        footF: { x: 22, y: 54 }, footB: { x: -26, y: 54 },
      }),
      F(STAND, 0.16, {
        hipY: 82, lean: -0.24, handF: { x: 30, y: -118 }, handB: { x: -10, y: -26 },
        footF: { x: 20, y: 86 }, footB: { x: -16, y: 104 },
      }),
      F(STAND, 0.29, {
        hipY: 84, lean: -0.3, handF: { x: 22, y: -128 }, handB: { x: -18, y: -20 },
        footF: { x: 16, y: 90 }, footB: { x: -14, y: 108 },
      }),
      F(STAND, 0.46, {
        hipY: 76, lean: -0.1, handF: { x: 26, y: -84 }, handB: { x: -4, y: -32 },
        footF: { x: 18, y: 80 }, footB: { x: -20, y: 92 },
      }),
      F(STAND, 0.66, {}),
    ],
  }),

  spin: def({
    id: 'spin', label: 'HURRICANE', startup: 0.1, active: 0.48, recover: 0.32,
    damage: 40, hitstun: 0.26, blockstun: 0.18, kb: 160, maxHits: 3, hitInterval: 0.14,
    meterGain: 12, special: true, knockdown: true, liftY: 430, vx: 280,
    shake: 5, hitstop: 0.045, hitbox: { x: -10, y: 36, w: 78, h: 72 },
    sfx: 'spin',
    anim: [
      F(STAND, 0, {}),
      F(STAND, 0.1, {
        hipY: 70, lean: 0.05, rot: 0, footF: { x: 40, y: 40 }, footB: { x: -10, y: 66 },
        handF: { x: -6, y: -30 }, handB: { x: -22, y: -22 },
      }),
      F(STAND, 0.2, {
        hipY: 72, lean: 0, rot: -Math.PI * 0.8, footF: { x: 72, y: 6 }, footB: { x: -6, y: 62 },
        handF: { x: -18, y: -14 }, handB: { x: -28, y: -6 },
      }),
      F(STAND, 0.36, {
        hipY: 72, lean: 0, rot: -Math.PI * 1.6, footF: { x: 74, y: 2 }, footB: { x: -4, y: 60 },
      }),
      F(STAND, 0.52, {
        hipY: 72, lean: 0, rot: -Math.PI * 2.4, footF: { x: 70, y: 8 }, footB: { x: -8, y: 62 },
      }),
      F(STAND, 0.62, {
        hipY: 70, lean: 0.06, rot: -Math.PI * 2.9, footF: { x: 40, y: 44 }, footB: { x: -16, y: 70 },
      }),
      F(STAND, 0.9, { rot: -Math.PI * 3, hipY: 74 }),
    ],
  }),
};

/* Hitstun / knockdown / victory poses are generated by the fighter. */
export function poseForMove(move, time) {
  const anim = move.anim;
  if (!anim || anim.length === 0) return BASE[move.poseKind] || STAND;
  if (time <= anim[0].t) return anim[0];
  if (time >= anim[anim.length - 1].t) return anim[anim.length - 1];
  for (let i = 0; i < anim.length - 1; i++) {
    const a = anim[i];
    const b = anim[i + 1];
    if (time >= a.t && time <= b.t) {
      const span = b.t - a.t || 1;
      const u = (time - a.t) / span;
      const e = u * u * (3 - 2 * u);
      return {
        hipY: a.hipY + (b.hipY - a.hipY) * e,
        lean: a.lean + (b.lean - a.lean) * e,
        tilt: a.tilt + (b.tilt - a.tilt) * e,
        rot: a.rot + (b.rot - a.rot) * e,
        offY: (a.offY || 0) + ((b.offY || 0) - (a.offY || 0)) * e,
        handF: {
          x: a.handF.x + (b.handF.x - a.handF.x) * e,
          y: a.handF.y + (b.handF.y - a.handF.y) * e,
        },
        handB: {
          x: a.handB.x + (b.handB.x - a.handB.x) * e,
          y: a.handB.y + (b.handB.y - a.handB.y) * e,
        },
        footF: {
          x: a.footF.x + (b.footF.x - a.footF.x) * e,
          y: a.footF.y + (b.footF.y - a.footF.y) * e,
        },
        footB: {
          x: a.footB.x + (b.footB.x - a.footB.x) * e,
          y: a.footB.y + (b.footB.y - a.footB.y) * e,
        },
      };
    }
  }
  return anim[anim.length - 1];
}

export const EX_MULT = { damage: 1.55, chip: 2, speed: 1.25, radius: 1.5, kb: 1.25 };
