import yaml from 'js-yaml';

const FALLBACK = {
  name: 'Workout Builder',
  subtitle: 'No program loaded',
  program: [],
};

function normalize(data) {
  if (!data || !Array.isArray(data.days)) {
    throw new Error('YAML must define a `days` array.');
  }
  const program = data.days.map((d, i) => {
    if (d === 'rest' || (d && d.rest)) return { t: 'rest' };
    if (typeof d !== 'object' || !d.workout || !d.video) {
      throw new Error(`Invalid day at index ${i}: ${JSON.stringify(d)}`);
    }
    return { t: 'workout', v: String(d.video), n: String(d.workout) };
  });
  return {
    name: data.name || 'Workout Builder',
    subtitle: data.subtitle || '',
    program,
  };
}

export async function loadProgram() {
  try {
    const res = await fetch('/program.yaml', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const data = yaml.load(text);
    return { ...normalize(data), source: 'yaml' };
  } catch (e) {
    console.error('Failed to load /program.yaml:', e);
    return { ...FALLBACK, source: 'fallback', error: String(e.message || e) };
  }
}
