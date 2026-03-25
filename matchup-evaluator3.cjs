const fs = require('fs');
const path = require('path');
const { Generations, Pokemon, Move, Field, calculate } = require('@smogon/calc');
const { Dex } = require('@pkmn/dex');

const gen = Generations.get(9);
const dex = Dex.forGen(9);

/**
 * =========================
 * CONFIG
 * =========================
 */

const OUR_MON = {
  //name: 'Yveltal',
  types: ['Dark', 'Flying'],
  level: 100,
  ability: 'Overcoat',
  item: 'Heavy-Duty Boots',
  //nature: 'Impish',
  //Simulating base 100s, 
  name: 'Moltres Galar',
  nature: 'Jolly',
  evs: { hp: 164, atk: 600, def: 164, spa: 0, spd: 0, spe: 72 },
  //evs: { hp: 252, atk: 252, def: 252, spa: 0, spd: 0, spe: 4 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 2, spe: 31 },
  moves: ['Beak Blast', 'Crunch', 'Taunt'],

  teraType: undefined,
};

const THRESHOLDS = {
  safeRepeatedSwitchMaxPct: 33,
  safeSingleSwitchMaxPct: 50,
};

const GLOBAL_FIELD = {
  weather: undefined,
  terrain: undefined,
  isGravity: false,
  attackerSide: {
    spikes: 0,
    stealthRock: false,
    isReflect: false,
    isLightScreen: false,
    isProtected: false,
    isSeeded: false,
    isTailwind: false,
  },
  defenderSide: {
    spikes: 0,
    stealthRock: false,
    isReflect: false,
    isLightScreen: false,
    isProtected: false,
    isSeeded: false,
    isTailwind: false,
  },
};

const OPPONENTS = [
  { species: 'Ting-Lu', setName: 'Utility' },
  { species: 'Corviknight', setName: 'PhysDef' },
  { species: 'Landorus-Therian', setName: 'Defensive Pivot' },
  { species: 'Skarmory', setName: 'PhysDef' },
  { species: 'Gholdengo', setName: 'Nasty Plot' },
  { species: 'Dragonite', setName: 'Dragon Dance' },
  { species: 'Great Tusk', setName: 'Offensive Spinner' },
  { species: 'Zamazenta', setName: 'All-Out Attacker' },
  { species: 'Kingambit', setName: 'Swords Dance' },
  { species: 'Darkrai', setName: 'Nasty Plot' },
  { species: 'Zapdos', setName: 'OU Defensive' },
  { species: 'Gliscor', setName: 'Utility' },
  { species: 'Clefable', setName: 'PhysDef' },

  { species: 'Arghonaut', setName: 'PhysDef' },
  { species: 'Hemogoblin', setName: 'Offensive' },
  { species: 'Kyurem', setName: 'Specs' },
  { species: 'Ogerpon-Wellspring', setName: 'Offensive' },
  { species: 'Revenankh', setName: 'BulkySetup' },
  { species: 'Venomicon', setName: 'PhysDef' },
  { species: 'Cresceidon', setName: 'Utility' },

  { species: 'Equilibra', setName: 'SpDef' },
  { species: 'Garganacl', setName: 'SpDef' },
  { species: 'Mollux', setName: 'SpDef' },
  { species: 'Moltres', setName: 'PhysDef' },
  { species: 'Pecharunt', setName: 'PhysDef' },
  { species: 'Slowking-Galar', setName: 'SpDef' },
  { species: 'Snaelstrom', setName: 'BulkySetup' },

  { species: 'Alomomola', setName: 'PhysDef' },
  { species: 'Dragapult', setName: 'Mixed Attacker' },
  { species: 'Deoxys-Speed', setName: 'Mixed Attacker' },
  { species: 'Iron Moth', setName: 'Specs' },
  { species: 'Kitsunoh', setName: 'Utility' },
  { species: 'Tornadus-Therian', setName: 'Nasty Plot' },
  { species: 'Caribolt', setName: 'Swords Dance' },
  { species: 'Ceruledge', setName: 'Swords Dance' },
  { species: 'Chuggalong', setName: 'Setup Sweeper' },
  { species: 'Hatterene', setName: 'PhysDef' },
  { species: 'Heatran', setName: 'Offensive' },
  { species: 'Hydrapple', setName: 'Nasty Plot' },
  { species: 'Miasmaw', setName: 'Swords Dance' },
  { species: 'Ramnarok', setName: 'Assault Vest' },
  { species: 'Samurott-Hisui', setName: 'Offensive' },
  { species: 'Shox', setName: 'SpDef' },
  { species: 'Stratagem', setName: 'Power Herb' },
  { species: 'Walking Wake', setName: 'Specs' },
  { species: 'Weezing-Galar', setName: 'PhysDef' },

  { species: 'Chromera', setName: 'Calm Mind' },
{ species: 'Iron Crown', setName: 'Specs' },
{ species: 'Iron Valiant', setName: 'Mixed Attacker' },
{ species: 'Krilowatt', setName: 'Offensive' },
{ species: 'Latios', setName: 'Calm Mind' },
{ species: 'Malaconda', setName: 'Utility' },
{ species: 'Naviathan', setName: 'Dragon Dance' },
{ species: 'Ogerpon', setName: 'Offensive' },
{ species: 'Raging Bolt', setName: 'Calm Mind' },
{ species: 'Rillaboom', setName: 'Choice Band' },
{ species: 'Ursaluna', setName: 'Swords Dance' },
];
/**
 * =========================
 * LOAD SETS
 * =========================
 */

const SETS_PATH = path.join(__dirname, 'sets.json');
const SETDEX = JSON.parse(fs.readFileSync(SETS_PATH, 'utf8'));

/**
 * =========================
 * HELPERS
 * =========================
 */

function normalizeStats(stats = {}) {
  return {
    hp: stats.hp ?? 0,
    atk: stats.atk ?? 0,
    def: stats.def ?? 0,
    spa: stats.spa ?? 0,
    spd: stats.spd ?? 0,
    spe: stats.spe ?? 0,
  };
}

function normalizeIVs(ivs = {}) {
  return {
    hp: ivs.hp ?? 31,
    atk: ivs.atk ?? 31,
    def: ivs.def ?? 31,
    spa: ivs.spa ?? 31,
    spd: ivs.spd ?? 31,
    spe: ivs.spe ?? 31,
  };
}

function getSet(species, setName) {
  const speciesSets = SETDEX[species];
  if (!speciesSets) {
    throw new Error(`No sets found for species: ${species}`);
  }

  const set = speciesSets[setName];
  if (!set) {
    throw new Error(`No set "${setName}" found for species: ${species}`);
  }

  return {
    name: species,
    level: set.level ?? 100,
    ability: set.ability,
    item: set.item,
    nature: set.nature,
    evs: normalizeStats(set.evs),
    ivs: normalizeIVs(set.ivs),
    moves: set.moves || [],
    teraType: set.teraType,
  };
}

function makePokemon(spec) {
  return new Pokemon(gen, spec.name, {
    level: spec.level ?? 100,
    ability: spec.ability,
    item: spec.item,
    nature: spec.nature,
    evs: spec.evs,
    ivs: spec.ivs,
    boosts: spec.boosts,
    status: spec.status,
    teraType: spec.teraType,
  });
}

function makeField() {
  return new Field({
    weather: GLOBAL_FIELD.weather,
    terrain: GLOBAL_FIELD.terrain,
    isGravity: GLOBAL_FIELD.isGravity,
    attackerSide: { ...GLOBAL_FIELD.attackerSide },
    defenderSide: { ...GLOBAL_FIELD.defenderSide },
  });
}

function percentRange(result, defender) {
  const [min, max] = result.range();
  const hp = defender.rawStats.hp;
  return {
    minPct: (min / hp) * 100,
    maxPct: (max / hp) * 100,
    min,
    max,
  };
}

function speedOf(spec) {
  return makePokemon(spec).rawStats.spe;
}

function bestDamageIntoDefender(attackerSpec, defenderSpec, moveNames) {
  const attacker = makePokemon(attackerSpec);
  const defender = makePokemon(defenderSpec);

  let best = null;

  for (const moveName of moveNames) {
    try {
      const move = new Move(gen, moveName);
      const result = calculate(gen, attacker, defender, move, makeField());
      const pct = percentRange(result, defender);
      const row = {
        move: moveName,
        ...pct,
        desc: result.desc(),
      };
      if (!best || row.maxPct > best.maxPct) best = row;
    } catch (err) {
      // ignore
    }
  }

  return best;
}

function worstDamageIntoUs(foeSpec, ourSpec, foeMoves) {
  const foe = makePokemon(foeSpec);
  const us = makePokemon(ourSpec);

  let worst = null;

  for (const moveName of foeMoves) {
    try {
      const move = new Move(gen, moveName);
      const result = calculate(gen, foe, us, move, makeField());
      const pct = percentRange(result, us);
      const row = {
        move: moveName,
        ...pct,
        desc: result.desc(),
      };
      if (!worst || row.maxPct > worst.maxPct) worst = row;
    } catch (err) {
      // ignore
    }
  }

  return worst;
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function hasTaunt(spec) {
  return (spec.moves || []).includes('Taunt');
}

function hasKnock(spec) {
  return (spec.moves || []).includes('Knock Off');
}

function hasOpportunist(spec) {
  return spec.ability === 'Opportunist';
}

function worsenSwitchState(state) {
  if (state === 'Safe') return 'Soft';
  if (state === 'Soft') return 'No';
  return 'No';
}

function improveSwitchState(state) {
  if (state === 'No') return 'Soft';
  if (state === 'Soft') return 'Safe';
  return 'Safe';
}

/**
 * =========================
 * MOVE TRAITS VIA SHOWDOWN DATA
 * =========================
 */

function getMoveData(moveName) {
  const move = dex.moves.get(moveName);
  if (!move || !move.exists) return null;
  return move;
}

function getMoveTraits(moveName) {
  const move = getMoveData(moveName);
  if (!move) {
    return {
      exists: false,
      name: moveName,
      isStatusMove: false,
      isContact: false,
      hasSecondary: false,
      hasSecondaryStatusChance: false,
      secondaryStatusTypes: [],
      isPivot: false,
      pivotKind: null,
      isRecovery: false,
      recoveryKind: null,
      drainFraction: 0,
      isHazard: false,
      isSetup: false,
      boostsDefense: false,
      boostsSpD: false,
    };
  }

  const secondaryEffects = [];
  if (move.secondary) secondaryEffects.push(move.secondary);
  if (move.secondaries && move.secondaries.length) {
    secondaryEffects.push(...move.secondaries);
  }

  const secondaryStatusTypes = secondaryEffects
    .filter((s) => s && s.status)
    .map((s) => s.status);

  const flags = move.flags || {};
  const drainFraction = Array.isArray(move.drain) && move.drain.length === 2
    ? move.drain[0] / move.drain[1]
    : 0;

  const selfBoosts = move.boosts || {};
  const isSetup = move.category === 'Status' && Object.keys(selfBoosts).length > 0;
  const boostsDefense = (selfBoosts.def || 0) > 0;
  const boostsSpD = (selfBoosts.spd || 0) > 0;

  let isPivot = false;
  let pivotKind = null;
  if (move.name === 'U-turn' || move.name === 'Flip Turn') {
    isPivot = true;
    pivotKind = 'contact';
  } else if (move.name === 'Volt Switch' || move.name === 'Parting Shot' || move.name === 'Teleport') {
    isPivot = true;
    pivotKind = 'noncontact';
  }

  const isRecovery =
    ['Roost', 'Recover', 'Soft-Boiled', 'Slack Off', 'Milk Drink', 'Moonlight',
      'Morning Sun', 'Shore Up', 'Synthesis', 'Strength Sap', 'Heal Order',
      'Rest', 'Wish'].includes(move.name) || drainFraction > 0;

  const recoveryKind =
    drainFraction > 0 ? 'drain' :
      isRecovery ? 'status' : null;

  const isHazard = ['Stealth Rock', 'Spikes', 'Toxic Spikes', 'Sticky Web'].includes(move.name);

  return {
    exists: true,
    name: move.name,
    isStatusMove: move.category === 'Status',
    isContact: Boolean(flags.contact),
    hasSecondary: secondaryEffects.length > 0,
    hasSecondaryStatusChance: secondaryStatusTypes.length > 0,
    secondaryStatusTypes,
    isPivot,
    pivotKind,
    isRecovery,
    recoveryKind,
    drainFraction,
    isHazard,
    isSetup,
    boostsDefense,
    boostsSpD,
  };
}

/**
 * =========================
 * INTERACTION PROFILES
 * =========================
 */

function isBurnImmune(spec) {
  const ability = spec.ability;
  const species = dex.species.get(spec.name);
  const types = species.types || [];

  return (
    ability === 'Poison Heal' ||
    ability === 'Guts' ||
    ability === 'Purifying Salt' ||
    types.includes('Fire')
  );
}

function getRecoveryProfile(oppSpec, ourSpec) {
  const moves = oppSpec.moves || [];
  const traits = moves.map(getMoveTraits);

  const statusRecoveryMoves = traits
    .filter((t) => t.isRecovery && t.recoveryKind === 'status')
    .map((t) => t.name);

  const drainMoves = traits
    .filter((t) => t.isRecovery && t.recoveryKind === 'drain');

  let bestDrainRecovery = 0;
  let bestDrainMove = null;

  for (const trait of drainMoves) {
    const result = worstDamageIntoUs(oppSpec, ourSpec, [trait.name]);
    if (!result) continue;

    const recoveryPct = result.maxPct * trait.drainFraction;
    if (recoveryPct > bestDrainRecovery) {
      bestDrainRecovery = recoveryPct;
      bestDrainMove = trait.name;
    }
  }

  return {
    hasRecovery: statusRecoveryMoves.length > 0 || drainMoves.length > 0,
    hasStatusRecovery: statusRecoveryMoves.length > 0,
    hasDrainRecovery: drainMoves.length > 0,
    statusRecoveryMoves,
    drainMoves: drainMoves.map((t) => t.name),
    bestDrainMove,
    statusRecoveryPct: statusRecoveryMoves.length > 0 ? 50 : 0,
    drainRecoveryPct: bestDrainRecovery,
    bestRecoveryPct: Math.max(statusRecoveryMoves.length > 0 ? 50 : 0, bestDrainRecovery),
  };
}

function losesToRecovery(dealt, recoveryPct, useMaxDamage = true) {
  if (!dealt || recoveryPct <= 0) return false;
  const damagePct = useMaxDamage ? dealt.maxPct : dealt.minPct;
  return damagePct < recoveryPct;
}

function applyRecoveryLogic(weIntoThem, theyIntoUs, reasons, ourSpec, oppSpec, dealt) {
  const recovery = getRecoveryProfile(oppSpec, ourSpec);
  if (!recovery.hasRecovery) {
    return { weIntoThem, theyIntoUs, reasons, recovery };
  }

  const ourSpeed = speedOf(ourSpec);
  const oppSpeed = speedOf(oppSpec);
  const weAreFaster = ourSpeed > oppSpeed;
  const weHaveTaunt = hasTaunt(ourSpec);

  const statusRecoveryBlockedByTaunt =
    recovery.hasStatusRecovery && weHaveTaunt && weAreFaster;

  let effectiveRecoveryPct = recovery.bestRecoveryPct;

  if (statusRecoveryBlockedByTaunt) {
    effectiveRecoveryPct = recovery.drainRecoveryPct;
    reasons.push('faster Taunt blocks status recovery');
  }

  if (losesToRecovery(dealt, effectiveRecoveryPct, true)) {
    theyIntoUs = improveSwitchState(theyIntoUs);
    reasons.push('cannot outdamage recovery');
  }

  return { weIntoThem, theyIntoUs, reasons, recovery };
}

function getContactProfile(spec) {
  const moves = spec.moves || [];
  const traits = moves.map(getMoveTraits);

  const contactMoves = traits
    .filter((t) => t.isContact)
    .map((t) => t.name);

  return {
    hasContactMove: contactMoves.length > 0,
    contactMoves,
  };
}

function getPivotProfile(spec) {
  const moves = spec.moves || [];
  const traits = moves.map(getMoveTraits);

  const contactPivotMoves = traits
    .filter((t) => t.isPivot && t.pivotKind === 'contact')
    .map((t) => t.name);

  const nonContactPivotMoves = traits
    .filter((t) => t.isPivot && t.pivotKind === 'noncontact')
    .map((t) => t.name);

  return {
    hasPivot: contactPivotMoves.length > 0 || nonContactPivotMoves.length > 0,
    hasContactPivot: contactPivotMoves.length > 0,
    hasNonContactPivot: nonContactPivotMoves.length > 0,
    contactPivotMoves,
    nonContactPivotMoves,
  };
}

function applyPivotLogic(weIntoThem, theyIntoUs, reasons, ourSpec, oppSpec) {
  // Look at whether their contact moves are actually punishable,
  // rather than just whether they have pivoting.
  const contactProfile = getPunishableContactProfile(oppSpec, ourSpec, 0.5);

  // If they have no contact at all, this logic does nothing.
  if (!contactProfile.hasContactMove) {
    return { weIntoThem, theyIntoUs, reasons, contactProfile };
  }

  // If they are effectively burn-immune, Beak Blast punishment matters less.
  if (isBurnImmune(oppSpec)) {
    reasons.push('contact exists, but burn punishment is muted');
    return { weIntoThem, theyIntoUs, reasons, contactProfile };
  }

  // If they have contact lines that are meaningfully punishable,
  // then they are worse at coming into us / interacting into us.
  if (contactProfile.hasPunishableContactMove) {
    reasons.push('Beak Blast strongly punishes weaker contact lines');
    theyIntoUs = worsenSwitchState(theyIntoUs);
  } else {
    // They may have contact, but not the kind we expect Beak Blast
    // to punish in a way that changes the matchup state.
    reasons.push('contact moves exist, but they are not easily punishable');
  }

  return { weIntoThem, theyIntoUs, reasons, contactProfile };
}

function getStatusProfile(spec) {
  const moves = spec.moves || [];
  const traits = moves.map(getMoveTraits);

  const statusMoves = traits
    .filter((t) => t.isStatusMove)
    .map((t) => t.name);

  const secondaryStatusMoves = traits
    .filter((t) => t.hasSecondaryStatusChance)
    .map((t) => t.name);

  return {
    hasStatus: statusMoves.length > 0 || secondaryStatusMoves.length > 0,
    hasStatusMoves: statusMoves.length > 0,
    hasSecondaryStatusMoves: secondaryStatusMoves.length > 0,
    statusMoves,
    secondaryStatusMoves,
  };
}

function canFishForStatus(dealt, recoveryProfile) {
  const hasRecovery = recoveryProfile?.hasRecovery || false;
  const weDoNot2HKO = !dealt || dealt.minPct < 50;
  return hasRecovery || weDoNot2HKO;
}

function applyStatusLogic(
  weIntoThem,
  theyIntoUs,
  reasons,
  ourSpec,
  oppSpec,
  dealt,
  recoveryProfile
) {
  const status = getStatusProfile(oppSpec);
  if (!status.hasStatus) {
    return { weIntoThem, theyIntoUs, reasons, status };
  }

  const ourSpeed = speedOf(ourSpec);
  const oppSpeed = speedOf(oppSpec);
  const weAreFaster = ourSpeed > oppSpeed;
  const weHaveTaunt = hasTaunt(ourSpec);

  let worsened = false;

  if (status.hasStatusMoves) {
    if (weAreFaster && weHaveTaunt) {
      reasons.push('faster Taunt blocks status moves');
    } else {
      reasons.push('status moves threaten the interaction');
      weIntoThem = worsenSwitchState(weIntoThem);
      worsened = true;
    }
  }

  if (status.hasSecondaryStatusMoves) {
    if (canFishForStatus(dealt, recoveryProfile)) {
      reasons.push('Fishing for status possible');
      if (!worsened) {
        weIntoThem = worsenSwitchState(weIntoThem);
      }
    }
  }

  return { weIntoThem, theyIntoUs, reasons, status };
}

function getSetupProfile(spec) {
  const moves = spec.moves || [];
  const traits = moves.map(getMoveTraits);

  const defensiveSetupMoves = traits
    .filter((t) => t.isSetup && (t.boostsDefense || t.boostsSpD))
    .map((t) => t.name);

  const nonDefensiveSetupMoves = traits
    .filter((t) => t.isSetup && !(t.boostsDefense || t.boostsSpD))
    .map((t) => t.name);

  return {
    hasSetup: defensiveSetupMoves.length > 0 || nonDefensiveSetupMoves.length > 0,
    hasDefensiveSetup: defensiveSetupMoves.length > 0,
    hasNonDefensiveSetup: nonDefensiveSetupMoves.length > 0,
    defensiveSetupMoves,
    nonDefensiveSetupMoves,
  };
}

function applySetupLogic(weIntoThem, theyIntoUs, reasons, ourSpec, oppSpec) {
  const setup = getSetupProfile(oppSpec);
  if (!setup.hasSetup) {
    return { weIntoThem, theyIntoUs, reasons, setup };
  }

  if (hasOpportunist(ourSpec) && setup.hasDefensiveSetup) {
    reasons.push('Opportunist punishes defensive-boosting setup');
    theyIntoUs = worsenSwitchState(theyIntoUs);
  } else if (hasOpportunist(ourSpec) && setup.hasNonDefensiveSetup) {
    reasons.push('Opportunist can copy setup boosts');
    theyIntoUs = worsenSwitchState(theyIntoUs);
  }

  return { weIntoThem, theyIntoUs, reasons, setup };
}

function hasHazards(spec) {
  const moves = spec.moves || [];
  return moves.map(getMoveTraits).some((t) => t.isHazard);
}

const HIGH_VALUE_KNOCK_ITEMS = new Set([
  'Leftovers',
  'Heavy-Duty Boots',
]);

function isDefensiveRole(oppSpec, recoveryProfile, statusProfile, pivotProfile) {
  return (
    recoveryProfile.hasRecovery ||
    statusProfile.hasStatusMoves ||
    pivotProfile.hasPivot ||
    hasHazards(oppSpec)
  );
}

function isKnockOffBlocked(oppSpec) {
  return oppSpec.ability === 'Magic Guard' || oppSpec.ability === 'Sticky Hold';
}

function applyKnockLogic(
  weIntoThem,
  theyIntoUs,
  reasons,
  ourSpec,
  oppSpec,
  recoveryProfile,
  statusProfile,
  pivotProfile
) {
  // Only apply Knock Off logic if our mon actually has Knock Off.
  if (!hasKnock(ourSpec)) {
    return { weIntoThem, theyIntoUs, reasons };
  }

  // Do not apply Knock Off logic into abilities that invalidate the value.
  if (isKnockOffBlocked(oppSpec)) {
    reasons.push('Knock Off logic skipped due to Magic Guard or Sticky Hold');
    return { weIntoThem, theyIntoUs, reasons };
  }

  const item = oppSpec.item;
  const isHighValueItem = HIGH_VALUE_KNOCK_ITEMS.has(item);
  const defensive = isDefensiveRole(oppSpec, recoveryProfile, statusProfile, pivotProfile);

  if (isHighValueItem && defensive) {
    reasons.push('Knock Off strongly pressures item-reliant defensive sets');
    theyIntoUs = worsenSwitchState(theyIntoUs);
  } else {
    reasons.push('Knock Off is not that essential');
  }

  return { weIntoThem, theyIntoUs, reasons };
}

function applySpeedOHKOCheckBLLogic(
  weIntoThem,
  theyIntoUs,
  reasons,
  taken,
  ourSpec,
  oppSpec
) {
  if (!taken) return { weIntoThem, theyIntoUs, reasons };

  const ourSpeed = speedOf(ourSpec);
  const oppSpeed = speedOf(oppSpec);

  const theyAreFaster = oppSpeed > ourSpeed;
  const theyOHKOUs = taken.minPct >= 100;

  // Only convert true Pressure cases into Checks BL.
  if (
    weIntoThem === 'No' &&
    theyIntoUs === 'No' &&
    theyAreFaster &&
    theyOHKOUs
  ) {
    theyIntoUs = 'Soft';
    reasons.push('faster OHKO threat downgrades Pressure to Checks BL');
  }

  return { weIntoThem, theyIntoUs, reasons };
}



function getPunishableContactProfile(oppSpec, ourSpec, thresholdRatio = 0.5) {
  const moves = oppSpec.moves || [];
  const traits = moves.map(getMoveTraits);

  const damagingMoves = traits.filter((t) => {
    const move = getMoveData(t.name);
    return move && move.category !== 'Status';
  });

  const contactMoves = damagingMoves.filter((t) => t.isContact);

  if (!damagingMoves.length || !contactMoves.length) {
    return {
      hasContactMove: contactMoves.length > 0,
      hasPunishableContactMove: false,
      contactMoves: contactMoves.map((t) => t.name),
      punishableContactMoves: [],
      strongestMove: null,
    };
  }

  const allDamages = [];
  for (const trait of damagingMoves) {
    const result = worstDamageIntoUs(oppSpec, ourSpec, [trait.name]);
    if (!result) continue;

    allDamages.push({
      move: trait.name,
      maxPct: result.maxPct,
      minPct: result.minPct,
      isContact: trait.isContact,
    });
  }

  if (!allDamages.length) {
    return {
      hasContactMove: contactMoves.length > 0,
      hasPunishableContactMove: false,
      contactMoves: contactMoves.map((t) => t.name),
      punishableContactMoves: [],
      strongestMove: null,
    };
  }

  const strongest = allDamages.reduce((best, cur) => {
    return !best || cur.maxPct > best.maxPct ? cur : best;
  }, null);

  const punishableContactMoves = allDamages
    .filter((row) =>
      row.isContact &&
      strongest &&
      row.maxPct <= 100 * thresholdRatio
    )
    .map((row) => row.move);

  return {
    hasContactMove: contactMoves.length > 0,
    hasPunishableContactMove: punishableContactMoves.length > 0,
    contactMoves: contactMoves.map((t) => t.name),
    punishableContactMoves,
    strongestMove: strongest ? strongest.move : null,
  };
}

function getGuaranteedStatusMoveProfile(spec) {
  const moves = spec.moves || [];
  const directStatusMoves = [];

  for (const moveName of moves) {
    const move = getMoveData(moveName);
    if (!move || !move.exists) continue;

    if (move.category !== 'Status') continue;

    if (move.status) {
      directStatusMoves.push(move.name);
      continue;
    }

    const secondaries = [];
    if (move.secondary) secondaries.push(move.secondary);
    if (move.secondaries && move.secondaries.length) {
      secondaries.push(...move.secondaries);
    }

    const inflictsStatus = secondaries.some((s) => s && s.status);
    if (inflictsStatus) {
      directStatusMoves.push(move.name);
    }
  }

  return {
    hasGuaranteedStatusMove: directStatusMoves.length > 0,
    directStatusMoves,
  };
}

/**
 * =========================
 * SWITCH-IN AXES
 * =========================
 */

function getOurSwitchInState(
  taken,
  dealt,
  oppSpec,
  ourSpec,
  recoveryProfile,
  statusProfile,
  pivotProfile
) {
  if (!taken) return 'No';

  let state = 'No';
  const ourSpeed = speedOf(ourSpec);
  const oppSpeed = speedOf(oppSpec);

  if (taken.maxPct <= THRESHOLDS.safeRepeatedSwitchMaxPct && dealt.minPct >= taken.maxPct) {
    state = 'Safe';
  } else if (taken.maxPct <= THRESHOLDS.safeRepeatedSwitchMaxPct && dealt.minPct <= taken.maxPct) {
    state = 'Soft';
  } else if (taken.maxPct <= THRESHOLDS.safeSingleSwitchMaxPct && dealt.minPct >= taken.maxPct) {
    state = 'Soft';
  } else if (taken.maxPct <= THRESHOLDS.safeSingleSwitchMaxPct && dealt.minPct <= taken.maxPct) {
    state = 'No';
  } else {
    state = 'No';
  }

  if (state === 'Safe' && pivotProfile.hasNonContactPivot && oppSpeed > ourSpeed) {
    state = 'Soft';
  }

  if (state === 'Safe' && hasKnock(oppSpec)) {
    state = 'Soft';
  }

  const guaranteedStatusProfile = getGuaranteedStatusMoveProfile(oppSpec);

  if (state === 'Safe' && guaranteedStatusProfile.hasGuaranteedStatusMove) {
    state = 'Soft';
  }

  return state;
}

function getTheirSwitchInState(
  dealt,
  oppSpec,
  ourSpec,
  recoveryProfile,
  statusProfile,
  pivotProfile
) {
  if (!dealt) return 'Safe';

  let state = 'No';
  const losesToRecoveryNow = losesToRecovery(dealt, recoveryProfile.bestRecoveryPct, true);

  if (losesToRecoveryNow || dealt.minPct < 50) {
    state = 'Safe';
  } else {
    state = 'No';
  }

  const strongKnock =
  hasKnock(ourSpec) &&
  !isKnockOffBlocked(oppSpec) &&
  HIGH_VALUE_KNOCK_ITEMS.has(oppSpec.item) &&
  isDefensiveRole(oppSpec, recoveryProfile, statusProfile, pivotProfile);

  if (state === 'Safe' && strongKnock) {
    state = 'Soft';
  }

  const contactProfile = getPunishableContactProfile(oppSpec, ourSpec, 0.7);
  if (contactProfile.hasPunishableContactMove && !isBurnImmune(oppSpec)) {
    state = 'No';
  }

  return state;

}

/**
 * =========================
 * FINAL BUCKET
 * =========================
 */

function deriveBucket(weIntoThem, theyIntoUs) {
  if (weIntoThem === 'Safe' && theyIntoUs === 'No') return 'Switch-in';
  if (weIntoThem === 'Safe' && theyIntoUs === 'Soft') return 'Switch-in BL';
  if (weIntoThem === 'Safe' && theyIntoUs === 'Safe') return 'Depends';

  if (weIntoThem === 'Soft' && theyIntoUs === 'No') return 'Switch-in BL';
  if (weIntoThem === 'Soft' && theyIntoUs === 'Soft') return 'Depends';
  if (weIntoThem === 'Soft' && theyIntoUs === 'Safe') return 'Checks';

  if (weIntoThem === 'No' && theyIntoUs === 'Soft') return 'Checks BL';
  if (weIntoThem === 'No' && theyIntoUs === 'Safe') return 'Counters';
  if (weIntoThem === 'No' && theyIntoUs === 'No') return 'Pressures';

  return 'Checks';
}

/**
 * =========================
 * THREAT MOVE SELECTION
 * =========================
 */

function getRelevantThreatMoves(oppSpec, ourSpec) {
  const moves = oppSpec.moves || [];
  const damagingMoves = moves.filter((moveName) => {
    const move = getMoveData(moveName);
    return move && move.category !== 'Status';
  });

  return damagingMoves.length ? damagingMoves : moves;
}

function getRelevantOurMoves(ourSpec, oppSpec) {
  const moves = ourSpec.moves || [];
  const damagingMoves = moves.filter((moveName) => {
    const move = getMoveData(moveName);
    return move && move.category !== 'Status';
  });
  return damagingMoves.length ? damagingMoves : moves;
}

/**
 * =========================
 * DEBUG + EVALUATION
 * =========================
 */

function scoreMatchup(ourSpec, oppEntry) {
  const oppSpec = getSet(oppEntry.species, oppEntry.setName);
  const threatMoves = getRelevantThreatMoves(oppSpec, ourSpec);
  const ourMoves = getRelevantOurMoves(ourSpec, oppSpec);

  const dealt = bestDamageIntoDefender(ourSpec, oppSpec, ourMoves);
  const taken = worstDamageIntoUs(oppSpec, ourSpec, threatMoves);

  let debug = [];
  let reasons = [];

  debug.push(`Loaded set: ${oppEntry.species} / ${oppEntry.setName}`);
  debug.push(`Threat moves considered: ${threatMoves.join(', ')}`);
  debug.push(`Our moves considered: ${ourMoves.join(', ')}`);

  const recoveryProfile = getRecoveryProfile(oppSpec, ourSpec);
  debug.push(`Recovery profile: ${JSON.stringify(recoveryProfile)}`);

  const pivotProfile = getPivotProfile(oppSpec);
  debug.push(`Pivot profile: ${JSON.stringify(pivotProfile)}`);

  const statusProfile = getStatusProfile(oppSpec);
  debug.push(`Status profile: ${JSON.stringify(statusProfile)}`);

  const setupProfile = getSetupProfile(oppSpec);
  debug.push(`Setup profile: ${JSON.stringify(setupProfile)}`);

  const baseWeIntoThem = getOurSwitchInState(
    taken,
    dealt,
    oppSpec,
    ourSpec,
    recoveryProfile,
    statusProfile,
    pivotProfile
  );

  const baseTheyIntoUs = getTheirSwitchInState(
    dealt,
    oppSpec,
    ourSpec,
    recoveryProfile,
    statusProfile,
    pivotProfile
  );

  debug.push(`Switch-in axes before logic: weIntoThem=${baseWeIntoThem}, theyIntoUs=${baseTheyIntoUs}`);

  let weIntoThem = baseWeIntoThem;
  let theyIntoUs = baseTheyIntoUs;

  ({
    weIntoThem,
    theyIntoUs,
    reasons
  } = applyRecoveryLogic(weIntoThem, theyIntoUs, reasons, ourSpec, oppSpec, dealt));
  debug.push(`After recovery logic: weIntoThem=${weIntoThem}, theyIntoUs=${theyIntoUs}`);

  ({
    weIntoThem,
    theyIntoUs,
    reasons
  } = applyPivotLogic(weIntoThem, theyIntoUs, reasons, ourSpec, oppSpec));
  debug.push(`After pivot logic: weIntoThem=${weIntoThem}, theyIntoUs=${theyIntoUs}`);

  ({
    weIntoThem,
    theyIntoUs,
    reasons
  } = applyStatusLogic(weIntoThem, theyIntoUs, reasons, ourSpec, oppSpec, dealt, recoveryProfile));
  debug.push(`After status logic: weIntoThem=${weIntoThem}, theyIntoUs=${theyIntoUs}`);

  ({
    weIntoThem,
    theyIntoUs,
    reasons
  } = applySetupLogic(weIntoThem, theyIntoUs, reasons, ourSpec, oppSpec));
  debug.push(`After setup logic: weIntoThem=${weIntoThem}, theyIntoUs=${theyIntoUs}`);

  ({
    weIntoThem,
    theyIntoUs,
    reasons
  } = applyKnockLogic(
    weIntoThem,
    theyIntoUs,
    reasons,
    ourSpec,
    oppSpec,
    recoveryProfile,
    statusProfile,
    pivotProfile
  )) 
  ;
  debug.push(`After knock logic: weIntoThem=${weIntoThem}, theyIntoUs=${theyIntoUs}`);

  
  ({
    weIntoThem,
    theyIntoUs,
    reasons
  } = applySpeedOHKOCheckBLLogic(
    weIntoThem,
    theyIntoUs,
    reasons,
    taken,
    ourSpec,
    oppSpec
  ));
  debug.push(`After speed/OHKO logic: weIntoThem=${weIntoThem}, theyIntoUs=${theyIntoUs}`);

  const bucket = deriveBucket(weIntoThem, theyIntoUs);
  debug.push(`Derived bucket from adjusted axes: ${bucket}`);

  const ourSpeed = speedOf(ourSpec);
  const oppSpeed = speedOf(oppSpec);

  const summaryParts = [];
  if (dealt) {
    summaryParts.push(`our best hit: ${dealt.move} (${dealt.minPct.toFixed(1)}-${dealt.maxPct.toFixed(1)}%)`);
  }
  if (taken) {
    summaryParts.push(`worst hit into us: ${taken.move} (${taken.minPct.toFixed(1)}-${taken.maxPct.toFixed(1)}%)`);
  }

  summaryParts.push(
    ourSpeed > oppSpeed ? 'we are faster' :
      oppSpeed > ourSpeed ? 'they are faster' :
        'speed tie'
  );

  summaryParts.push(...reasons);

  return {
    opponent: `${oppEntry.species} (${oppEntry.setName})`,
    species: oppEntry.species,
    setName: oppEntry.setName,
    bucket,
    weIntoThem,
    theyIntoUs,
    dealt,
    taken,
    ourSpeed,
    oppSpeed,
    summary: summaryParts.join('; '),
    debug: debug.join(' || '),
  };
}

/**
 * =========================
 * CSV EXPORT
 * =========================
 */

function exportToCSV(results, filename = 'matchup_results.csv') {
  const lines = [];

  lines.push('CONFIG');
  lines.push('Key,Value');
  lines.push(`Our Mon,${csvEscape(OUR_MON.displayName || OUR_MON.name)}`);
  lines.push(`Calc Species Shell,${csvEscape(OUR_MON.name)}`);
  lines.push(`Ability,${csvEscape(OUR_MON.ability)}`);
  lines.push(`Item,${csvEscape(OUR_MON.item)}`);
  lines.push(`Nature,${csvEscape(OUR_MON.nature)}`);
  lines.push(`Moves,${csvEscape((OUR_MON.moves || []).join(', '))}`);
  lines.push(`EVs,${csvEscape(JSON.stringify(OUR_MON.evs))}`);
  lines.push(`IVs,${csvEscape(JSON.stringify(OUR_MON.ivs))}`);
  lines.push(`safeRepeatedSwitchMaxPct,${csvEscape(THRESHOLDS.safeRepeatedSwitchMaxPct)}`);
  lines.push(`safeSingleSwitchMaxPct,${csvEscape(THRESHOLDS.safeSingleSwitchMaxPct)}`);
  lines.push('');

  lines.push('ALL MATCHUPS');
  lines.push([
    'Opponent',
    'Bucket',
    'We Switch Into Them',
    'They Switch Into Us',
    'Our Best Move',
    'Our Damage Min %',
    'Our Damage Max %',
    'Their Best Move',
    'Damage Into Us Min %',
    'Damage Into Us Max %',
    'Our Speed',
    'Opp Speed',
    'Summary',
    'Debug',
  ].join(','));

  for (const r of results) {
    lines.push([
      csvEscape(r.opponent),
      csvEscape(r.bucket),
      csvEscape(r.weIntoThem),
      csvEscape(r.theyIntoUs),
      csvEscape(r.dealt?.move ?? ''),
      csvEscape(r.dealt ? r.dealt.minPct.toFixed(1) : ''),
      csvEscape(r.dealt ? r.dealt.maxPct.toFixed(1) : ''),
      csvEscape(r.taken?.move ?? ''),
      csvEscape(r.taken ? r.taken.minPct.toFixed(1) : ''),
      csvEscape(r.taken ? r.taken.maxPct.toFixed(1) : ''),
      csvEscape(r.ourSpeed),
      csvEscape(r.oppSpeed),
      csvEscape(r.summary),
      csvEscape(r.debug),
    ].join(','));
  }

  lines.push('');
  lines.push('BUCKET COUNTS');
  lines.push('Bucket,Count');

  const bucketOrder = ['Switch-in', 'Switch-in BL', 'Pressures', 'Checks', 'Counters'];
  for (const bucket of bucketOrder) {
    const count = results.filter(r => r.bucket === bucket).length;
    lines.push(`${csvEscape(bucket)},${count}`);
  }

  fs.writeFileSync(filename, lines.join('\n'), 'utf8');
}

/**
 * =========================
 * RUN
 * =========================
 */

function main() {
  const results = OPPONENTS.map((opp) => scoreMatchup(OUR_MON, opp));

  const bucketOrder = {
    'Switch-in': 0,
    'Switch-in BL': 1,
    'Pressures': 2,
    'Checks': 3,
    'Counters': 4,
    'Depends': 5,
    'Checks BL': 6,
  };

  results.sort((a, b) => {
    const delta = (bucketOrder[a.bucket] ?? 999) - (bucketOrder[b.bucket] ?? 999);
    if (delta !== 0) return delta;
    return (a.taken?.maxPct ?? 999) - (b.taken?.maxPct ?? 999);
  });

  exportToCSV(results, 'matchup_results.csv');

  console.log('Wrote matchup_results.csv');
  for (const r of results) {
  console.log(`\n=== ${r.opponent} ===`);
  console.log(`Bucket: ${r.bucket}`);
  console.log(`Axes: weIntoThem=${r.weIntoThem}, theyIntoUs=${r.theyIntoUs}`);
  console.log(`Debug: ${r.debug}`);
}
}

main();