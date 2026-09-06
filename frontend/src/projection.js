export function project4D(pos, angle = 0) {
  const [x, y, z, w] = pos.map((n) => n - 3.5)
  const x1 = x * Math.cos(angle) - w * Math.sin(angle)
  const w1 = x * Math.sin(angle) + w * Math.cos(angle)
  const z1 = z * Math.cos(angle * 0.618) - w1 * Math.sin(angle * 0.618)
  const w2 = z * Math.sin(angle * 0.618) + w1 * Math.cos(angle * 0.618)
  const scale = 12 / (12 - w2)
  return [x1 * scale, z1 * scale, y * scale]
}
export const corners = Array.from({ length: 16 }, (_, i) =>
  Array.from({ length: 4 }, (_, a) => (i & (1 << a) ? 7 : 0)),
)
export const edges = corners.flatMap((_, i) =>
  [0, 1, 2, 3].filter((a) => !(i & (1 << a))).map((a) => [i, i | (1 << a)]),
)
export const nodes = Array.from({ length: 4096 }, (_, i) => [
  i % 8,
  Math.floor(i / 8) % 8,
  Math.floor(i / 64) % 8,
  Math.floor(i / 512),
])
