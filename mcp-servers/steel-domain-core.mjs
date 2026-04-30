const SPECS = {
  'ASTM A36': {
    aliases: ['A36', 'ASTM A36/A36M'],
    product: 'Structural carbon steel',
    units: { strength: 'ksi', elongation: 'percent' },
    yield: { min: 36 },
    tensile: { min: 58, max: 80 },
    elongation: { min: 20 },
    notes: ['Common plate/shape/bar spec. Thickness and product form can affect elongation requirements.'],
  },
  'ASTM A572 Grade 50': {
    aliases: ['A572', 'A572 GR 50', 'A572 Grade 50', 'ASTM A572 Gr 50'],
    product: 'HSLA structural steel',
    units: { strength: 'ksi', elongation: 'percent' },
    yield: { min: 50 },
    tensile: { min: 65 },
    elongation: { min: 18 },
    notes: ['Verify thickness/product-form table for production use.'],
  },
  'ASTM A992': {
    aliases: ['A992', 'ASTM A992/A992M'],
    product: 'Structural shapes',
    units: { strength: 'ksi', elongation: 'percent' },
    yield: { min: 50, max: 65 },
    tensile: { min: 65 },
    elongation: { min: 18 },
    notes: ['Typical W-shape spec; yield max matters for seismic/design assumptions.'],
  },
  'ASTM A514 Grade B': {
    aliases: ['A514', 'A514 GR B', 'A514 Grade B', 'ASTM A514 Gr B'],
    product: 'Quenched and tempered alloy plate',
    units: { strength: 'ksi', elongation: 'percent' },
    yield: { min: 100 },
    tensile: { min: 110, max: 130 },
    elongation: { min: 16 },
    notes: ['Requirements vary by grade/thickness; use grade-specific tables for release decisions.'],
  },
  'API 2H Grade 50': {
    aliases: ['API 2H', 'API 2H GR 50', 'API 2H Grade 50'],
    product: 'Offshore structural plate',
    units: { strength: 'ksi', elongation: 'percent', impactEnergy: 'ft-lb', temperature: 'F' },
    yield: { min: 50 },
    tensile: { min: 70, max: 90 },
    elongation: { min: 21 },
    charpy: { energyMin: 25, temperatureMax: 14 },
    notes: ['Representative Charpy grounding; confirm customer/API edition tables before certification.'],
  },
  'ABS DH36': {
    aliases: ['DH36', 'ABS DH36', 'ABS Grade DH36'],
    product: 'Marine hull structural steel',
    units: { strength: 'ksi', elongation: 'percent', impactEnergy: 'J', temperature: 'C' },
    yield: { min: 51 },
    tensile: { min: 71, max: 90 },
    elongation: { min: 21 },
    charpy: { energyMin: 34, temperatureMax: -20 },
    notes: ['Charpy orientation/thickness rules may apply; use class-approved tables for release.'],
  },
};

export function findSpec(grade, standard = '') {
  const q = `${standard} ${grade}`.toUpperCase().replace(/\s+/g, ' ').trim();
  for (const [name, spec] of Object.entries(SPECS)) {
    const keys = [name, ...(spec.aliases || [])].map(x => x.toUpperCase());
    if (keys.some(k => q === k || q.includes(k) || k.includes(q))) return { name, spec };
  }
  return null;
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

function toKsi(value, unit = 'ksi') {
  const u = String(unit).toLowerCase();
  if (u === 'ksi') return Number(value);
  if (u === 'mpa') return Number(value) * 0.1450377377;
  if (u === 'psi') return Number(value) / 1000;
  throw new Error(`Unsupported strength unit: ${unit}`);
}

function toFtLb(value, unit = 'ft-lb') {
  const u = String(unit).toLowerCase().replace('ftlb', 'ft-lb');
  if (u === 'ft-lb' || u === 'ft·lbf') return Number(value);
  if (u === 'j' || u === 'joule' || u === 'joules') return Number(value) * 0.7375621493;
  throw new Error(`Unsupported impact energy unit: ${unit}`);
}

function toF(value, unit = 'F') {
  const u = String(unit).toLowerCase();
  if (u === 'f' || u === 'degf' || u === '°f') return Number(value);
  if (u === 'c' || u === 'degc' || u === '°c') return (Number(value) * 9 / 5) + 32;
  throw new Error(`Unsupported temperature unit: ${unit}`);
}

function checkRange(label, actual, req) {
  if (!req || actual == null || Number.isNaN(actual)) return null;
  const failures = [];
  if (req.min != null && actual < req.min) failures.push(`${label} ${round(actual)} below min ${req.min}`);
  if (req.max != null && actual > req.max) failures.push(`${label} ${round(actual)} above max ${req.max}`);
  return { label, actual: round(actual), requirement: req, pass: failures.length === 0, failures };
}

export function evaluateSpec(args) {
  const hit = findSpec(args.grade || args.spec || '', args.standard || '');
  if (!hit) throw new Error(`Unknown grade/spec: ${args.standard || ''} ${args.grade || args.spec || ''}`.trim());
  const r = args.results || {};
  const strengthUnit = r.strengthUnit || args.strengthUnit || 'ksi';
  const checks = [];
  if (r.yield != null) checks.push(checkRange('yield', toKsi(r.yield, strengthUnit), hit.spec.yield));
  if (r.tensile != null || r.uts != null) checks.push(checkRange('tensile', toKsi(r.tensile ?? r.uts, strengthUnit), hit.spec.tensile));
  if (r.elongation != null) checks.push(checkRange('elongation', Number(r.elongation), hit.spec.elongation));
  if (hit.spec.charpy && r.charpyEnergy != null) {
    const energyFtLb = toFtLb(r.charpyEnergy, r.impactEnergyUnit || hit.spec.units.impactEnergy || 'ft-lb');
    const reqFtLb = toFtLb(hit.spec.charpy.energyMin, hit.spec.units.impactEnergy || 'ft-lb');
    checks.push(checkRange('charpyEnergy', energyFtLb, { min: reqFtLb }));
  }
  if (hit.spec.charpy && r.charpyTemperature != null) {
    const tempF = toF(r.charpyTemperature, r.temperatureUnit || hit.spec.units.temperature || 'F');
    const maxF = toF(hit.spec.charpy.temperatureMax, hit.spec.units.temperature || 'F');
    checks.push({ label: 'charpyTemperature', actual: round(tempF), requirement: { max: round(maxF) }, pass: tempF <= maxF, failures: tempF <= maxF ? [] : [`charpyTemperature ${round(tempF)} above max ${round(maxF)} F`] });
  }
  const materialChecks = checks.filter(Boolean);
  const failed = materialChecks.flatMap(c => c.failures);
  return {
    spec: hit.name,
    pass: failed.length === 0,
    failedProperties: failed,
    checks: materialChecks,
    retestEligible: failed.length > 0 ? 'Review governing spec/customer retest rules before disposition.' : 'Not applicable',
    caution: 'Demo reference only. Confirm against the current standard edition/customer specification before certification.',
  };
}

export function validateTraceability(args) {
  const rec = args.record || args;
  const required = ['heatNumber', 'coilId', 'sampleId', 'mtrId'];
  const missing = required.filter(k => !rec[k]);
  const warnings = [];
  if (rec.sampleHeatNumber && rec.heatNumber && rec.sampleHeatNumber !== rec.heatNumber) warnings.push('sampleHeatNumber does not match heatNumber');
  if (rec.mtrHeatNumber && rec.heatNumber && rec.mtrHeatNumber !== rec.heatNumber) warnings.push('mtrHeatNumber does not match heatNumber');
  if (rec.coilHeatNumber && rec.heatNumber && rec.coilHeatNumber !== rec.heatNumber) warnings.push('coilHeatNumber does not match heatNumber');
  if (rec.testResults && !Array.isArray(rec.testResults)) warnings.push('testResults should be an array of result records');
  return {
    valid: missing.length === 0 && warnings.length === 0,
    missing,
    warnings,
    chain: {
      heatNumber: rec.heatNumber || null,
      coilId: rec.coilId || null,
      sampleId: rec.sampleId || null,
      mtrId: rec.mtrId || null,
    },
  };
}

export function lookupSpec(args) {
  const hit = findSpec(args.grade || '', args.standard || '');
  if (!hit) throw new Error(`Unknown grade/spec: ${args.standard || ''} ${args.grade || ''}`.trim());
  return {
    spec: hit.name,
    ...hit.spec,
    caution: 'Demo reference only. Confirm against the current standard edition/customer specification before certification.',
  };
}
