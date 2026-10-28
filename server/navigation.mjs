import { WORLDS, blocked, rayBoxDistance } from '../shared/world.mjs';

const graphs = new WeakMap();
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function clearPath(a, b, world = WORLDS.quarantine) {
  const length = distance(a, b);
  if (length < 0.001) return true;
  const dx = (b.x - a.x) / length, dz = (b.z - a.z) / length;
  return !world.obstacles.some(o => rayBoxDistance(a.x, a.z, dx, dz, { ...o, w: o.w + .82, d: o.d + .82 }) < length - 0.001);
}

function graphFor(world) {
if (graphs.has(world)) return graphs.get(world);
const nodes = world.obstacles.flatMap(o => [-1, 1].flatMap(sx => [-1, 1].map(sz => ({
  x: o.x + sx * (o.w / 2 + 0.75), z: o.z + sz * (o.d / 2 + 0.75),
})))).filter(p => !blocked(p.x, p.z, 0.4, world));
const edges = nodes.map((node, i) => nodes.flatMap((next, j) =>
  i !== j && clearPath(node, next, world) ? [{ index: j, cost: distance(node, next) }] : []));

const graph = { nodes, edges }; graphs.set(world, graph); return graph;
}

// A small visibility graph is enough for this fixed arena. The graph is shared
// by every enemy; only the start and destination change as players move.
export function findRoute(from, to, world = WORLDS.quarantine) {
  const { nodes, edges } = graphFor(world);
  if (clearPath(from, to, world)) return [];
  const cost = nodes.map(node => clearPath(from, node, world) ? distance(from, node) : Infinity);
  const previous = nodes.map(() => -1), visited = new Set();
  let best = -1, bestCost = Infinity;
  for (let iteration = 0; iteration < nodes.length; iteration++) {
    let current = -1, cheapest = Infinity;
    for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && cost[i] < cheapest) { cheapest = cost[i]; current = i; }
    if (current === -1 || cheapest >= bestCost) break;
    visited.add(current);
    if (clearPath(nodes[current], to, world)) {
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
