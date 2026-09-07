// Conservative em widths keep CJK, Latin and marker prefixes within the same box.
export function layoutLabel(name: string, width: number, height: number, area: string | null) {
  const padding = Math.min(width, height) * .1;
  const innerWidth = Math.max(.001, width - padding * 2);
  const innerHeight = Math.max(.001, height - padding * 2);
  const chars = Array.from(name || '未命名');
  const visible = chars.length > 120 ? [...chars.slice(0, 119), '…'] : chars;
  let best = { lines: [''], font: 0 };
  for (let count = 1; count <= Math.min(3, visible.length); count++) {
    const perLine = Math.ceil(visible.length / count);
    const lines: string[] = [];
    for (let i = 0; i < visible.length; i += perLine) lines.push(visible.slice(i, i + perLine).join(''));
    const font = Math.min(1.65, innerWidth / (perLine * 1.15), innerHeight / (lines.length * 1.35 + (area ? 1.3 : 0)));
    if (font > best.font) best = {lines, font};
  }
  const areaFont = area ? Math.min(best.font * .8, innerWidth / (Array.from(area).length * .85)) : 0;
  const lineHeight = best.font * 1.35;
  const blockHeight = best.lines.length * lineHeight + (area ? areaFont * 1.6 : 0);
  const top = (innerHeight - blockHeight) / 2;
  return {padding, innerWidth, innerHeight, font: best.font, lines: best.lines.map((text, i) => ({text, y: top + i * lineHeight + lineHeight / 2})), areaFont, areaY: top + best.lines.length * lineHeight + areaFont * .8};
}
