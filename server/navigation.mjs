import { OBSTACLES, blocked, rayBoxDistance } from '../shared/world.mjs';

const obstacles = OBSTACLES.map(o => ({ ...o, w: o.w + 0.82, d: o.d + 0.82 }));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function clearPath(a, b) {
  const length = distance(a, b);
  if (length < 0.001) return true;
  const dx = (b.x - a.x) / length, dz = (b.z - a.z) / length;
  return !obstacles.some(o => rayBoxDistance(a.x, a.z, dx, dz, o) < length - 0.001);
}

const nodes = OBSTACLES.flatMap(o => [-1, 1].flatMap(sx => [-1, 1].map(sz => ({
  x: o.x + sx * (o.w / 2 + 0.75), z: o.z + sz * (o.d / 2 + 0.75),
})))).filter(p => !blocked(p.x, p.z, 0.4));
const edges = nodes.map((node, i) => nodes.flatMap((next, j) =>
  i !== j && clearPath(node, next) ? [{ index: j, cost: distance(node, next) }] : []));

// A small visibility graph is enough for this fixed arena. The graph is shared
// by every enemy; only the start and destination change as players move.
export function findRoute(from, to) {
  if (clearPath(from, to)) return [];
  const cost = nodes.map(node => clearPath(from, node) ? distance(from, node) : Infinity);
  const previous = nodes.map(() => -1), visited = new Set();
  let best = -1, bestCost = Infinity;
  for (let iteration = 0; iteration < nodes.length; iteration++) {
    let current = -1, cheapest = Infinity;
    for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && cost[i] < cheapest) { cheapest = cost[i]; current = i; }
    if (current === -1 || cheapest >= bestCost) break;
    visited.add(current);
    if (clearPath(nodes[current], to)) {
      const total = cheapest + distance(nodes[current], to);
      if (total < bestCost) { best = current; bestCost = total; }
    }
    for (const edge of edges[current]) {
      const next = cheapest + edge.cost;
      if (next < cost[edge.index]) { cost[edge.index] = next; previous[edge.index] = current; }
    }
  }
  const route = [];
  while (best !== -1) { route.unshift(nodes[best]); best = previous[best]; }
  return route;
}
