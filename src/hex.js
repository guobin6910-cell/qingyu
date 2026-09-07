/** Axial / offset hex helpers for 青嶼戰記
 *  pointy-top: odd-r (maps 2–3)
 *  flat-top:   odd-q (map1 painted island)
 */

/** odd-r pointy-top neighbors */
function neighborsPointy(x, y) {
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

/** odd-q flat-top neighbors */
function neighborsFlat(x, y) {
  const odd = x & 1;
  if (odd) {
    return [
      [x, y - 1], [x + 1, y],
      [x - 1, y], [x + 1, y + 1],
      [x - 1, y + 1], [x, y + 1],
    ];
  }
  return [
    [x, y - 1], [x + 1, y - 1],
    [x - 1, y - 1], [x + 1, y],
    [x - 1, y], [x, y + 1],
  ];
}

export function hexNeighbors(x, y, orientation = 'pointy') {
  return orientation === 'flat' ? neighborsFlat(x, y) : neighborsPointy(x, y);
}

/** odd-r pointy → cube */
function offsetToCubePointy(x, y) {
  const q = x - ((y - (y & 1)) >> 1);
  const r = y;
  const s = -q - r;
  return [q, r, s];
}

/** odd-q flat → cube */
function offsetToCubeFlat(x, y) {
  const q = x;
  const r = y - ((x - (x & 1)) >> 1);
  const s = -q - r;
  return [q, r, s];
}

export function offsetToCube(x, y, orientation = 'pointy') {
  return orientation === 'flat' ? offsetToCubeFlat(x, y) : offsetToCubePointy(x, y);
}

export function hexDistance(x1, y1, x2, y2, orientation = 'pointy') {
  const [q1, r1, s1] = offsetToCube(x1, y1, orientation);
  const [q2, r2, s2] = offsetToCube(x2, y2, orientation);
  return (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs(s1 - s2)) / 2;
}

/**
 * Pixel center of hex.
 * size = center-to-vertex distance (pre-squash)
 * squashY: vertical foreshortening for painted isometric boards
 */
export function hexToPixel(x, y, size, orientation = 'pointy', squashY = 1) {
  if (orientation === 'flat') {
    const w = 2 * size;
    const h = Math.sqrt(3) * size * squashY;
    const px = size * 1.5 * x;
    const py = Math.sqrt(3) * size * (y + 0.5 * (x & 1)) * squashY;
    return { px, py, w, h };
  }
  const w = Math.sqrt(3) * size;
  const h = 2 * size;
  const px = w * (x + 0.5 * (y & 1));
  const py = (h * 0.75) * y;
  return { px, py, w, h };
}

/** Bounding box for a cols×rows board */
export function hexBoardSize(cols, rows, size, orientation = 'pointy', squashY = 1) {
  if (orientation === 'flat') {
    const w = 2 * size;
    const h = Math.sqrt(3) * size * squashY;
    const width = size * 1.5 * (cols - 1) + w;
    const height = Math.sqrt(3) * size * (rows - 0.5) * squashY + h * 0.5;
    return { width: Math.ceil(width), height: Math.ceil(height), cellW: w, cellH: h };
  }
  const w = Math.sqrt(3) * size;
  const h = 2 * size;
  const width = w * (cols + 0.5);
  const height = h * 0.75 * (rows - 1) + h;
  return { width: Math.ceil(width), height: Math.ceil(height), cellW: w, cellH: h };
}

/** Hex polygon points centered at 0,0 (optionally squashed) */
export function hexPolygonPoints(size, orientation = 'pointy', squashY = 1) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = orientation === 'flat'
      ? (Math.PI / 180) * (60 * i)
      : (Math.PI / 180) * (60 * i - 30);
    pts.push([size * Math.cos(angle), size * squashY * Math.sin(angle)]);
  }
  return pts.map((p) => p.join(',')).join(' ');
}
