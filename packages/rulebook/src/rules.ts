// DOC-1 … DOC-8 — the deterministic, goal-aware diagnostic rules.
//
// Each rule is a pure `check(engineOutputs, thresholds) → Finding | null`. Every
// statement follows the coach-not-judge voice from UX_PRESENTATION §9 ("you can
// recover X here", never "your build is bad"), and every finding's `evidence`
// carries the exact numbers the check used so the UI can render them inline and
// the LLM narrator can never introduce a value that isn't here.
import { capSeverity, ratioSeverity, SEVERITY_RANK, worstSeverity } from './severity.js';
import type {
  DoctorThresholds,
  EngineOutputs,
  Finding,
  ResistState,
  Rule,
  Severity,
} from './types.js';

const ELEMENTS = ['fire', 'cold', 'lightning'] as const;
type Element = (typeof ELEMENTS)[number];

function round(n: number): number {
  return Math.round(n);
}

// ---------------------------------------------------------------------------
// DOC-1 — Elemental resists under/overcapped
// ---------------------------------------------------------------------------
function undercapSeverity(gap: number, total: number): Severity {
  if (total < 0) return 'critical';
  if (gap <= 0) return 'pass';
  if (gap <= 5) return 'minor';
  if (gap <= 15) return 'major';
  return 'critical';
}

const DOC_1: Rule = {
  id: 'DOC-1',
  category: 'Defense',
  check(o, t): Finding {
    const evidence: Record<string, number> = {};
    const underSeverities: Severity[] = [];
    let worstUnderEl: Element | null = null;
    let worstUnderGap = 0;
    let overcapWasteTotal = 0;
    let worstOverEl: Element | null = null;
    let worstOverSurplus = 0;

    for (const el of ELEMENTS) {
      const r: ResistState = o.resists[el];
      const cap = r.max || t.resistFloor;
      const gap = cap - r.total; // >0 = undercapped
      const surplus = r.total - cap; // >0 = overcapped
      evidence[`${el}Resist`] = round(r.total);
      evidence[`${el}Cap`] = round(cap);
      const sev = undercapSeverity(gap, r.total);
      underSeverities.push(sev);
      if (gap > worstUnderGap) {
        worstUnderGap = gap;
        worstUnderEl = el;
      }
      if (surplus > t.resistOvercapWaste) {
        overcapWasteTotal += surplus;
        if (surplus > worstOverSurplus) {
          worstOverSurplus = surplus;
          worstOverEl = el;
        }
      }
    }

    const underSeverity = worstSeverity(underSeverities);
    if (underSeverity !== 'pass' && worstUnderEl) {
      evidence.deficit = round(worstUnderGap);
      return {
        id: 'DOC-1',
        category: 'Defense',
        severity: underSeverity,
        statement: `You can add ${round(worstUnderGap)}% ${worstUnderEl} resistance to reach the cap — closing this hole is your cheapest survivability gain.`,
        evidence,
        fixTemplates: [
          {
            id: 'DOC-1-cap-res',
            label: 'Cap the missing resistance',
            hint: `Look for +${worstUnderEl} resistance on rings, boots, or an amulet suffix.`,
          },
        ],
      };
    }

    // Nothing undercapped: is there recoverable overcap waste?
    if (worstOverEl && overcapWasteTotal > 0) {
      evidence.overcapWaste = round(overcapWasteTotal);
      return {
        id: 'DOC-1',
        category: 'Defense',
        severity: 'minor',
        statement: `You're ${round(worstOverSurplus)}% over the ${worstOverEl} cap — that's roughly ${round(overcapWasteTotal)}% of resistance you can recover and reinvest elsewhere.`,
        evidence,
        fixTemplates: [
          {
            id: 'DOC-1-recover-overcap',
            label: 'Reinvest overcapped resistance',
            hint: 'Swap one resist affix for life, damage, or an offensive stat.',
          },
        ],
      };
    }

    return {
      id: 'DOC-1',
      category: 'Defense',
      severity: 'pass',
      statement: 'Your elemental resistances are capped with no overcap to reclaim — nicely balanced.',
      evidence,
      fixTemplates: [],
    };
  },
};

// ---------------------------------------------------------------------------
// DOC-2 — Chaos resistance too low (the classic hidden killer)
// ---------------------------------------------------------------------------
const DOC_2: Rule = {
  id: 'DOC-2',
  category: 'Defense',
  check(o, t): Finding {
    const chaos = o.resists.chaos.total;
    const floor = t.chaosResFloor;
    const gap = floor - chaos;
    const evidence = { chaosResist: round(chaos), chaosResFloor: round(floor), deficit: round(Math.max(0, gap)) };

    let severity: Severity = 'pass';
    if (gap > 0) {
      if (chaos <= -50) severity = 'critical';
      else if (gap <= 10) severity = 'minor';
      else if (gap <= 25) severity = 'major';
      else severity = 'critical';
    }

    if (severity === 'pass') {
      return {
        id: 'DOC-2',
        category: 'Defense',
        severity,
        statement: `Your chaos resistance (${round(chaos)}%) clears the ${t.goal} bar — chaos damage won't be the thing that catches you out.`,
        evidence,
        fixTemplates: [],
      };
    }
    return {
      id: 'DOC-2',
      category: 'Defense',
      severity,
      statement: `Chaos resistance is at ${round(chaos)}%; lifting it about ${round(gap)}% toward ${round(floor)}% removes one of the most common "died at full health" causes for your goal.`,
      evidence,
      fixTemplates: [
        {
          id: 'DOC-2-chaos-res',
          label: 'Pick up chaos resistance',
          hint: 'Chaos res is gear-only in PoE2 — target it on rings, amulet, or a corrupted implicit.',
        },
      ],
    };
  },
};

// ---------------------------------------------------------------------------
// DOC-3 — EHP / max-hit too low for target tier
// ---------------------------------------------------------------------------
const HIT_TYPES = ['physical', 'fire', 'cold', 'lightning', 'chaos'] as const;

const DOC_3: Rule = {
  id: 'DOC-3',
  category: 'Defense',
  check(o, t): Finding {
    const ehpRatio = t.ehpFloor > 0 ? o.totalEHP / t.ehpFloor : 1;
    const ehpSeverity = ratioSeverity(ehpRatio);

    const requiredHit = round(t.expectedTierHit * t.maxHitFloorMultiplier);
    let worstHitType: (typeof HIT_TYPES)[number] = 'physical';
    let worstHitValue = Infinity;
    for (const type of HIT_TYPES) {
      const v = o.maximumHitTaken[type];
      if (v < worstHitValue) {
        worstHitValue = v;
        worstHitType = type;
      }
    }
    const hitRatio = requiredHit > 0 ? worstHitValue / requiredHit : 1;
    const hitSeverity = ratioSeverity(hitRatio);

    const severity = worstSeverity([ehpSeverity, hitSeverity]);
    const evidence = {
      totalEHP: round(o.totalEHP),
      ehpFloor: round(t.ehpFloor),
      worstHitType,
      worstMaximumHitTaken: round(worstHitValue),
      requiredHit,
      expectedTierHit: round(t.expectedTierHit),
      targetTier: t.tier,
    };

    if (severity === 'pass') {
      return {
        id: 'DOC-3',
        category: 'Defense',
        severity,
        statement: `Your ${round(o.totalEHP)} EHP and ${round(worstHitValue)} worst-case (${worstHitType}) hit both clear the T${t.tier} ${t.goal} bar — you can take the punches this content throws.`,
        evidence,
        fixTemplates: [],
      };
    }

    const ehpIsLimiter = ehpRatio <= hitRatio;
    const limiterMsg = ehpIsLimiter
      ? `EHP is ${round(o.totalEHP)} against a ${round(t.ehpFloor)} target`
      : `your ${worstHitType} MaximumHitTaken is ${round(worstHitValue)} against a ${requiredHit} target`;
    return {
      id: 'DOC-3',
      category: 'Defense',
      severity,
      statement: `For T${t.tier} at your ${t.goal} goal, ${limiterMsg} — building toward that number is what unlocks the tier safely.`,
      evidence,
      fixTemplates: [
        {
          id: 'DOC-3-add-ehp',
          label: 'Add effective HP',
          hint: ehpIsLimiter
            ? 'More life/ES, or a mitigation layer (armour, evasion, block), raises EHP fastest.'
            : `Shore up the ${worstHitType} damage type specifically — it is your thinnest wall.`,
        },
      ],
    };
  },
};

// ---------------------------------------------------------------------------
// DOC-4 — Missing stun/freeze/ailment protection
// ---------------------------------------------------------------------------
const DOC_4: Rule = {
  id: 'DOC-4',
  category: 'Defense',
  check(o, t): Finding {
    const ail = o.ailmentProtection;
    const stunGap = t.stunAvoidanceFloor - ail.stunAvoidance;
    const ailmentEntries: Array<{ name: string; value: number; gap: number }> = [
      { name: 'freeze', value: ail.freezeAvoidance, gap: t.ailmentAvoidanceFloor - ail.freezeAvoidance },
      { name: 'shock', value: ail.shockAvoidance, gap: t.ailmentAvoidanceFloor - ail.shockAvoidance },
      { name: 'ignite', value: ail.igniteAvoidance, gap: t.ailmentAvoidanceFloor - ail.igniteAvoidance },
    ];
    const worstAilment = ailmentEntries.reduce((a, b) => (b.gap > a.gap ? b : a));

    function gapSeverity(gap: number): Severity {
      if (gap <= 0) return 'pass';
      if (gap <= 25) return 'minor';
      if (gap <= 60) return 'major';
      return 'critical';
    }
    const stunSeverity = gapSeverity(stunGap);
    const ailmentSeverity = gapSeverity(worstAilment.gap);
    const severity = worstSeverity([stunSeverity, ailmentSeverity]);

    const evidence = {
      stunAvoidance: round(ail.stunAvoidance),
      stunAvoidanceFloor: round(t.stunAvoidanceFloor),
      freezeAvoidance: round(ail.freezeAvoidance),
      shockAvoidance: round(ail.shockAvoidance),
      igniteAvoidance: round(ail.igniteAvoidance),
      ailmentAvoidanceFloor: round(t.ailmentAvoidanceFloor),
    };

    if (severity === 'pass') {
      return {
        id: 'DOC-4',
        category: 'Defense',
        severity,
        statement: `Stun and ailment protection meet your ${t.goal} targets — you won't get chain-locked when a pack lands on you.`,
        evidence,
        fixTemplates: [],
      };
    }
    const stunIsLimiter = SEVERITY_RANK[stunSeverity] >= SEVERITY_RANK[ailmentSeverity] && stunGap > 0;
    const focus = stunIsLimiter
      ? `stun avoidance sits at ${round(ail.stunAvoidance)}% (target ${round(t.stunAvoidanceFloor)}%)`
      : `${worstAilment.name} avoidance sits at ${round(worstAilment.value)}% (target ${round(t.ailmentAvoidanceFloor)}%)`;
    return {
      id: 'DOC-4',
      category: 'Defense',
      severity,
      statement: `Locking down ${focus} keeps you in control when a fight turns dangerous — that's a big smoothness-and-safety win for ${t.goal}.`,
      evidence,
      fixTemplates: [
        {
          id: 'DOC-4-ailment',
          label: 'Add stun/ailment protection',
          hint: 'Stun threshold, freeze/shock/ignite avoidance on gear, or an ailment-immunity flask/charm.',
        },
      ],
    };
  },
};

// ---------------------------------------------------------------------------
// DOC-5 — Defense layering incoherent
// ---------------------------------------------------------------------------
const DOC_5: Rule = {
  id: 'DOC-5',
  category: 'Defense',
  check(o, t): Finding {
    const d = o.defenses;
    const issues: string[] = [];

    const esIsMajorPool = d.energyShield > 0 && d.energyShield >= d.life;
    if (esIsMajorPool && !d.energyShieldRechargeProtected) {
      issues.push('your Energy Shield carries the build but has no recharge protection, so one uninterrupted hit can start a death spiral');
    }
    const armourBased = d.armour > 0 && d.armour >= d.evasion * 2 && d.energyShield < d.life;
    if (armourBased && d.blockChance < 20 && d.spellSuppression < 30) {
      issues.push('you lean on armour with no block or suppression behind it, so big and spell hits skip your only layer');
    }
    const evasionBased = d.evasion > 0 && d.evasion >= d.armour * 2;
    if (evasionBased && d.spellSuppression < 30) {
      issues.push('evasion covers attacks but low suppression leaves you exposed to spells');
    }

    const evidence = {
      life: round(d.life),
      energyShield: round(d.energyShield),
      armour: round(d.armour),
      evasion: round(d.evasion),
      blockChance: round(d.blockChance),
      spellSuppression: round(d.spellSuppression),
      energyShieldRechargeProtected: d.energyShieldRechargeProtected,
      issueCount: issues.length,
    };

    const rawSeverity: Severity = issues.length >= 2 ? 'critical' : issues.length === 1 ? 'major' : 'pass';
    const severity = capSeverity(rawSeverity, t.layeringCap);

    if (severity === 'pass' || issues.length === 0) {
      return {
        id: 'DOC-5',
        category: 'Defense',
        severity: 'pass',
        statement: 'Your defensive layers back each other up — no obvious single-point-of-failure in the mitigation stack.',
        evidence,
        fixTemplates: [],
      };
    }
    return {
      id: 'DOC-5',
      category: 'Defense',
      severity,
      statement: `One coherent addition pays off a lot here: ${issues[0]}. Adding a complementary layer is more effective than more of what you already stack.`,
      evidence,
      fixTemplates: [
        {
          id: 'DOC-5-add-layer',
          label: 'Add a complementary defensive layer',
          hint: 'Block, spell suppression, or recharge protection depending on your primary pool.',
        },
      ],
    };
  },
};

// ---------------------------------------------------------------------------
// DOC-6 — Sustain broken
// ---------------------------------------------------------------------------
const DOC_6: Rule = {
  id: 'DOC-6',
  category: 'Sustain',
  check(o, t): Finding {
    const s = o.sustain;
    const evidence = {
      netLifeRegen: round(s.netLifeRegen),
      netRegenFloor: round(t.netRegenFloor),
      totalBuildDegen: round(s.totalBuildDegen),
      lifeLeechRatePerSecond: round(s.lifeLeechRatePerSecond),
      energyShieldRechargeRate: round(s.energyShieldRechargeRate),
    };
    const hasRecovery =
      s.lifeLeechRatePerSecond > 0 || s.energyShieldRechargeRate > 0 || s.netLifeRegen > 0;

    let severity: Severity;
    if (s.netLifeRegen < 0) {
      severity = 'critical';
    } else if (!hasRecovery) {
      severity = 'major';
    } else if (s.netLifeRegen < t.netRegenFloor && s.lifeLeechRatePerSecond <= 0 && s.energyShieldRechargeRate <= 0) {
      severity = 'minor';
    } else {
      severity = 'pass';
    }

    if (severity === 'pass') {
      return {
        id: 'DOC-6',
        category: 'Sustain',
        severity,
        statement: 'Your recovery outpaces the damage you take between packs — sustain is holding up for this goal.',
        evidence,
        fixTemplates: [],
      };
    }
    const detail =
      s.netLifeRegen < 0
        ? `your degen (${round(s.totalBuildDegen)}/s) currently outpaces recovery, netting ${round(s.netLifeRegen)}/s`
        : `there's little steady recovery here (net regen ${round(s.netLifeRegen)}/s, leech ${round(s.lifeLeechRatePerSecond)}/s)`;
    return {
      id: 'DOC-6',
      category: 'Sustain',
      severity,
      statement: `Turning recovery positive is a quality-of-life unlock: ${detail}. A leech mod or flat regen closes the gap.`,
      evidence,
      fixTemplates: [
        {
          id: 'DOC-6-recovery',
          label: 'Add reliable recovery',
          hint: 'Life/ES leech, flat life regen, or reduce a self-inflicted degen source.',
        },
      ],
    };
  },
};

// ---------------------------------------------------------------------------
// DOC-7 — DPS below tier expectation (satisficing: overkill is a pass)
// ---------------------------------------------------------------------------
const DOC_7: Rule = {
  id: 'DOC-7',
  category: 'Offense',
  check(o, t): Finding {
    const ratio = t.expectedDps > 0 ? o.fullDps / t.expectedDps : 1;
    const severity = ratioSeverity(ratio);
    const evidence = {
      fullDps: round(o.fullDps),
      expectedDps: round(t.expectedDps),
      targetTier: t.tier,
    };
    if (severity === 'pass') {
      return {
        id: 'DOC-7',
        category: 'Offense',
        severity,
        statement: `Your ${round(o.fullDps)} DPS is enough to clear T${t.tier} at your ${t.goal} pace — no need to chase overkill damage; spend elsewhere.`,
        evidence,
        fixTemplates: [],
      };
    }
    return {
      id: 'DOC-7',
      category: 'Offense',
      severity,
      statement: `Reaching about ${round(t.expectedDps)} DPS (you're at ${round(o.fullDps)}) makes T${t.tier} feel smooth for ${t.goal} — a support-gem or one damage affix often bridges most of it.`,
      evidence,
      fixTemplates: [
        {
          id: 'DOC-7-add-dps',
          label: 'Raise damage to the tier band',
          hint: 'A better support gem, added flat damage, or a key passive cluster.',
        },
      ],
    };
  },
};

// ---------------------------------------------------------------------------
// DOC-8 — Cost warnings / unusable skills
// ---------------------------------------------------------------------------
const DOC_8: Rule = {
  id: 'DOC-8',
  category: 'QoL',
  check(o): Finding {
    let severity: Severity = 'pass';
    let offender: string | null = null;
    let detail = '';

    for (const skill of o.skills) {
      if (skill.lifeCost > o.unreservedLife) {
        severity = 'critical';
        offender = skill.name;
        detail = `${skill.name} costs ${round(skill.lifeCost)} life but only ${round(o.unreservedLife)} is unreserved — casting it can kill you`;
        break;
      }
      if (skill.manaCost > o.unreservedMana) {
        severity = 'major';
        offender = skill.name;
        detail = `${skill.name} costs ${round(skill.manaCost)} mana but only ${round(o.unreservedMana)} is unreserved — it won't fire reliably`;
      }
    }
    if (severity === 'pass' && o.warnings.length > 0) {
      severity = 'minor';
      offender = null;
      detail = `the engine flagged: ${o.warnings[0]}`;
    }

    const evidence: Record<string, number | string> = {
      unreservedMana: round(o.unreservedMana),
      unreservedLife: round(o.unreservedLife),
      warningCount: o.warnings.length,
    };
    if (offender) evidence.skill = offender;

    if (severity === 'pass') {
      return {
        id: 'DOC-8',
        category: 'QoL',
        severity,
        statement: 'Every socketed skill is affordable to cast and the engine raised no cost warnings — nothing dead weight here.',
        evidence,
        fixTemplates: [],
      };
    }
    return {
      id: 'DOC-8',
      category: 'QoL',
      severity,
      statement: `A quick fix frees this up: ${detail}. Trimming a reservation or adding cost reduction makes it reliable.`,
      evidence,
      fixTemplates: [
        {
          id: 'DOC-8-cost',
          label: 'Fix skill cost / reservation',
          hint: 'Reduce a reservation, add mana/cost efficiency, or raise unreserved life.',
        },
      ],
    };
  },
};

/** DOC-1 … DOC-8 in canonical order. DOC-9 is the composite verdict (runDoctor). */
export const RULES: readonly Rule[] = [DOC_1, DOC_2, DOC_3, DOC_4, DOC_5, DOC_6, DOC_7, DOC_8];

/** Re-run a single rule under freshly computed thresholds (used by DOC-9). */
export function runRule(
  rule: Rule,
  engineOutputs: EngineOutputs,
  thresholds: DoctorThresholds,
): Finding | null {
  return rule.check(engineOutputs, thresholds);
}
