import type { LevelDef, LevelObject, LevelObjectType } from './types';

export class LevelError extends Error {}

const OBJECT_TYPES: LevelObjectType[] = ['plate', 'door', 'walker', 'hint', 'platform', 'laser', 'orb', 'spring', 'conveyor', 'crawler', 'brute', 'mimic', 'crusher'];
const TILE_CHARS = new Set(['#', '^', 'v', '=', '.', 'g', 'x', '<', '>', 'n', 'p']);

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isVec(v: unknown): v is { x: number; y: number } {
  return typeof v === 'object' && v !== null && isNum((v as { x: unknown }).x) && isNum((v as { y: unknown }).y);
}

/** Validates untrusted level JSON. Throws LevelError with a readable message. */
export function parseLevel(raw: unknown): LevelDef {
  if (typeof raw !== 'object' || raw === null) throw new LevelError('Level is not an object');
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id) throw new LevelError('Level id missing');
  const where = `level "${r.id}"`;
  if (typeof r.name !== 'string') throw new LevelError(`${where}: name missing`);
  if (!isNum(r.width) || !isNum(r.height) || r.width < 8 || r.height < 6 || r.width > 120 || r.height > 80) {
    throw new LevelError(`${where}: invalid size`);
  }
  const width = r.width;
  const height = r.height;
  if (!Array.isArray(r.tiles) || r.tiles.length !== height) throw new LevelError(`${where}: tiles must have ${height} rows`);
  r.tiles.forEach((row, i) => {
    if (typeof row !== 'string' || row.length !== width) {
      throw new LevelError(`${where}: tile row ${i} must be ${width} chars`);
    }
    for (const ch of row) if (!TILE_CHARS.has(ch)) throw new LevelError(`${where}: unknown tile "${ch}" in row ${i}`);
  });
  if (!isVec(r.spawn)) throw new LevelError(`${where}: spawn missing`);
  if (!isVec(r.exit)) throw new LevelError(`${where}: exit missing`);
  if (r.loopDuration !== undefined && (!isNum(r.loopDuration) || r.loopDuration <= 0)) {
    throw new LevelError(`${where}: invalid loopDuration`);
  }
  const objects: LevelObject[] = [];
  const ids = new Set<string>();
  if (!Array.isArray(r.objects)) throw new LevelError(`${where}: objects must be an array`);
  for (const o of r.objects as unknown[]) {
    if (typeof o !== 'object' || o === null) throw new LevelError(`${where}: bad object`);
    const obj = o as Record<string, unknown>;
    if (typeof obj.id !== 'string' || ids.has(obj.id)) throw new LevelError(`${where}: object id missing or duplicated`);
    if (!OBJECT_TYPES.includes(obj.type as LevelObjectType)) throw new LevelError(`${where}: unknown object type ${String(obj.type)}`);
    if (!isNum(obj.x) || !isNum(obj.y)) throw new LevelError(`${where}: object ${obj.id} needs x/y`);
    ids.add(obj.id);
    objects.push({
      id: obj.id,
      type: obj.type as LevelObjectType,
      x: obj.x,
      y: obj.y,
      width: isNum(obj.width) ? obj.width : 1,
      height: isNum(obj.height) ? obj.height : 1,
      properties: (typeof obj.properties === 'object' && obj.properties !== null)
        ? obj.properties as Record<string, unknown> : {},
    });
  }
  // Plate targets must reference something a plate can drive.
  const drivable = new Set(objects.filter((o) => o.type === 'door' || o.type === 'platform' || o.type === 'laser' || o.type === 'conveyor').map((o) => o.id));
  for (const p of objects.filter((o) => o.type === 'plate')) {
    for (const t of plateTargets(p)) {
      if (!drivable.has(t)) throw new LevelError(`${where}: plate ${p.id} targets unknown door/platform/laser ${t}`);
    }
  }
  for (const o of objects) {
    const pr = o.properties ?? {};
    if (o.type === 'platform') {
      if (!isVec(pr.to)) throw new LevelError(`${where}: platform ${o.id} needs properties.to {x,y}`);
    }
    if (o.type === 'laser') {
      if (!['left', 'right', 'up', 'down'].includes(String(pr.dir))) throw new LevelError(`${where}: laser ${o.id} needs dir left/right/up/down`);
    }
  }
  return {
    id: r.id,
    name: r.name,
    world: typeof r.world === 'string' ? r.world : '',
    width, height,
    tiles: r.tiles as string[],
    spawn: r.spawn, exit: r.exit,
    loopDuration: r.loopDuration as number | undefined,
    solidGhosts: r.solidGhosts === true,
    objects,
  };
}

export function plateTargets(o: LevelObject): string[] {
  const t = o.properties?.target;
  if (typeof t === 'string') return [t];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === 'string');
  return [];
}
