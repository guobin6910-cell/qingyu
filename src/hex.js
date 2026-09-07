/** Axial / odd-r pointy-top hex helpers for 青嶼戰記 */

/** odd-r offset neighbors (pointy top) */
export function hexNeighbors(x, y) {
  const odd = y & 1;
  if (odd) {
    return [
      [x, y - 1], [x + 1, y - 1],
      [x - 1, y], [x + 1, y],
      [x, y + 1], [x + 1, y + 1],
    ];
  }
  return [
    [x - 1, y - 1], [x, y - 1],
    [x - 1, y], [x + 1, y],
    [x - 1, y + 1], [x, y + 1],
  ];
}

/** odd-r → cube */
export function offsetToCube(x, y) {
  const q = x - ((y - (y & 1)) >> 1);
  const r = y;
  const s = -q - r;
  return [q, r, s];
}

export function hexDistance(x1, y1, x2, y2) {
  const [q1, r1, s1] = offsetToCube(x1, y1);
  const [q2, r2, s2] = offsetToCube(x2, y2);
  return (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs(s1 - s2)) / 2;
}

/**
 * Pixel center of hex in odd-r pointy-top layout.
 * size = center-to-vertex distance
 */
export function hexToPixel(x, y, size) {
  const w = Math.sqrt(3) * size;
  const h = 2 * size;
  const px = w * (x + 0.5 * (y & 1));
  const py = (h * 0.75) * y;
  return { px, py, w, h };
}

/** Bounding box for a cols×rows odd-r board */
export function hexBoardSize(cols, rows, size) {
  const w = Math.sqrt(3) * size;
  const h = 2 * size;
  const width = w * (cols + 0.5);
  const height = h * 0.75 * (rows - 1) + h;
  return { width: Math.ceil(width), height: Math.ceil(height), cellW: w, cellH: h };
}

/** Pointy-top hex polygon points centered at 0,0 */
export function hexPolygonPoints(size) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push([size * Math.cos(angle), size * Math.sin(angle)]);
  }
  return pts.map((p) => p.join(',')).join(' ');
}
