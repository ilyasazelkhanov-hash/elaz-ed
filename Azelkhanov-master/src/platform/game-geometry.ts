/** One coordinate system for SVG sectors and the stop beneath the fixed top pointer. */
export function wheelStop(outcome: string, count = 8) {
  const hash = Array.from(outcome).reduce((value, char) => (Math.imul(value, 31) + char.codePointAt(0)!) >>> 0, 0)
  const index = hash % count
  return { index, rotation: 5 * 360 + ((360 - (index * 360) / count) % 360) }
}
export function wheelSector(index: number, count = 8, radius = 145) {
  const angle = (((index * 360) / count - 90) * Math.PI) / 180
  const half = Math.PI / count
  const point = (a: number, r: number) => [160 + Math.cos(a) * r, 160 + Math.sin(a) * r]
  const a = point(angle - half, radius),
    b = point(angle + half, radius),
    label = point(angle, radius * 0.66)
  return { path: `M 160 160 L ${a[0]} ${a[1]} A ${radius} ${radius} 0 0 1 ${b[0]} ${b[1]} Z`, x: label[0], y: label[1] }
}
/** Coverage counts unique cells, so rubbing the same spot cannot reveal the whole ticket. */
export function scratchCoverage(cells: Set<number>, x: number, y: number, radius = 0.066, size = 24) {
  for (
    let row = Math.max(0, Math.floor((y - radius) * size));
    row < Math.min(size, Math.ceil((y + radius) * size));
    row++
  ) {
    for (
      let col = Math.max(0, Math.floor((x - radius) * size));
      col < Math.min(size, Math.ceil((x + radius) * size));
      col++
    ) {
      if (Math.hypot((col + 0.5) / size - x, (row + 0.5) / size - y) <= radius) cells.add(row * size + col)
    }
  }
  return cells.size / (size * size)
}
