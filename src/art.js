/** 美術資源與單位標記 — 連續地圖＋Q版全身立繪（致敬經典台製 SRPG 呈現，原創資產） */
import { TREES, CLASSES } from './data.js';

import coverUrl from './assets/art/cover.jpg';
import hubUrl from './assets/art/hub.jpg';
import bgM1 from './assets/art/bg-m1.jpg';
import bgM2 from './assets/art/bg-m2.jpg';
import bgM3 from './assets/art/bg-m3.jpg';
import boardM1 from './assets/art/board-m1.jpg';
import boardM2 from './assets/art/board-m2.jpg';
import boardM3 from './assets/art/board-m3.jpg';

import unitLin from './assets/art/unit-lin.jpg';
import unitSu from './assets/art/unit-su.jpg';
import unitFang from './assets/art/unit-fang.jpg';
import unitHai from './assets/art/unit-hai.jpg';
import enemyBandit from './assets/art/enemy-bandit.jpg';
import enemyPirate from './assets/art/enemy-pirate.jpg';
import enemyDeserter from './assets/art/enemy-deserter.jpg';

import spriteLin from './assets/art/sprite-lin.png';
import spriteSu from './assets/art/sprite-su.png';
import spriteFang from './assets/art/sprite-fang.png';
import spriteHai from './assets/art/sprite-hai.png';
import spriteBandit from './assets/art/sprite-bandit.png';
import spritePirate from './assets/art/sprite-pirate.png';
import spriteDeserter from './assets/art/sprite-deserter.png';

export const ART = {
  cover: coverUrl,
  hub: hubUrl,
  mapBg: {
    m1_tutorial: bgM1,
    m2_pass: bgM2,
    m3_harbor: bgM3,
  },
  /** 連續手繪戰場圖（格盤背景，非碎塊地磚） */
  board: {
    m1_tutorial: boardM1,
    m2_pass: boardM2,
    m3_harbor: boardM3,
  },
  portrait: {
    lin_qingchuan: unitLin,
    su_wanqing: unitSu,
    fang_shuo: unitFang,
    hai_ning: unitHai,
  },
  /** Q版全身立繪（站在格上） */
  sprite: {
    lin_qingchuan: spriteLin,
    su_wanqing: spriteSu,
    fang_shuo: spriteFang,
    hai_ning: spriteHai,
  },
  enemySprite: {
    bandit: spriteBandit,
    pirate: spritePirate,
    deserter: spriteDeserter,
  },
  enemyPortrait: {
    bandit: enemyBandit,
    pirate: enemyPirate,
    deserter: enemyDeserter,
  },
};

export function mapBackground(mapId) {
  return ART.mapBg[mapId] || ART.mapBg.m1_tutorial;
}

export function boardFor(mapId) {
  return ART.board[mapId] || ART.board.m1_tutorial;
}

export function portraitFor(unit) {
  if (!unit) return null;
  if (unit.srcUid && ART.portrait[unit.srcUid]) return ART.portrait[unit.srcUid];
  if (unit.uid && ART.portrait[unit.uid]) return ART.portrait[unit.uid];
  if (unit.side === 'enemy' || unit.boss) {
    if (unit.boss) return ART.enemyPortrait.deserter;
    if (unit.tree === 'ranged') return ART.enemyPortrait.pirate;
    if (unit.tree === 'magic') return ART.enemyPortrait.pirate;
    return ART.enemyPortrait.bandit;
  }
  return null;
}

export function spriteFor(unit) {
  if (!unit) return null;
  if (unit.srcUid && ART.sprite[unit.srcUid]) return ART.sprite[unit.srcUid];
  if (unit.uid && ART.sprite[unit.uid]) return ART.sprite[unit.uid];
  if (unit.side === 'enemy' || unit.boss) {
    if (unit.boss) return ART.enemySprite.deserter;
    if (unit.tree === 'ranged') return ART.enemySprite.pirate;
    if (unit.tree === 'magic') return ART.enemySprite.pirate;
    return ART.enemySprite.bandit;
  }
  const n = unit.name || '';
  if (n.includes('青川')) return ART.sprite.lin_qingchuan;
  if (n.includes('晚晴')) return ART.sprite.su_wanqing;
  if (n.includes('方朔')) return ART.sprite.fang_shuo;
  if (n.includes('海寧')) return ART.sprite.hai_ning;
  return null;
}

/** @deprecated 改用 sprite；保留別名以免舊呼叫炸掉 */
export function tokenFor(unit) {
  return spriteFor(unit);
}

/** 戰鬥格上的 Q 版全身立繪（腳底 HP） */
export function unitTokenHTML(unit, size = 44) {
  const spr = spriteFor(unit);
  const tree = TREES[unit.tree] || TREES.melee;
  const color = tree.color;
  const isEnemy = unit.side === 'enemy';
  const stroke = isEnemy ? '#e05050' : color;
  const team = isEnemy ? '#c0392b' : '#2a7fd4';
  const hpPct = Math.max(0, Math.round((unit.hp / Math.max(1, unit.maxHp)) * 100));
  const hpColor = hpPct > 40 ? '#4ec99a' : '#e05050';
  const crown = unit.boss ? '★' : unit.hero ? '◆' : '';
  const acted = unit.acted ? ' acted' : '';
  const h = Math.round(size * 1.35);
  if (spr) {
    return `<div class="unit-sprite${acted}" style="width:${size}px;height:${h}px;--ring:${stroke};--team:${team}">
      <span class="spr-shadow"></span>
      <img src="${spr}" alt="${unit.name}" draggable="false" />
      ${crown ? `<span class="crown">${crown}</span>` : ''}
      <span class="hpbar"><i style="width:${hpPct}%;background:${hpColor}"></i></span>
    </div>`;
  }
  return unitTokenSVG(unit, size);
}

export function unitTokenSVG(unit, size = 40) {
  const tree = TREES[unit.tree] || TREES.melee;
  const color = tree.color;
  const letter = (unit.name || '?').slice(0, 1);
  const hpPct = Math.max(0, Math.round((unit.hp / unit.maxHp) * 100));
  const isEnemy = unit.side === 'enemy';
  const bg = isEnemy ? '#3a1a1a' : '#0d2137';
  const stroke = isEnemy ? '#e05050' : color;
  const crown = unit.boss ? '★' : unit.hero ? '◆' : '';
  const h = Math.round(size * 1.3);
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${h}" viewBox="0 0 40 52">
  <ellipse cx="20" cy="48" rx="12" ry="3" fill="${isEnemy ? '#c0392b88' : '#2a7fd488'}"/>
  <rect x="8" y="14" width="24" height="28" rx="6" fill="${bg}" stroke="${stroke}" stroke-width="2"/>
  <circle cx="20" cy="12" r="9" fill="${color}" opacity="0.95"/>
  <text x="20" y="16" text-anchor="middle" font-size="10" font-weight="700" fill="#0a1520">${letter}</text>
  <text x="20" y="36" text-anchor="middle" font-size="7" fill="${stroke}">${CLASSES[unit.classId]?.name?.slice(0, 2) || ''}</text>
  ${crown ? `<text x="32" y="10" font-size="8" fill="#ffd700">${crown}</text>` : ''}
  <rect x="6" y="46" width="28" height="3" rx="1" fill="#222"/>
  <rect x="6" y="46" width="${28 * hpPct / 100}" height="3" rx="1" fill="${hpPct > 40 ? '#4ec99a' : '#e05050'}"/>
</svg>`;
}

export function terrainPattern(tid) {
  const map = {
    plain: '', hill: '山', forest: '林', wall: '牆', ford: '灘',
    village: '村', shop: '店', secret: '※', harbor: '港',
  };
  return map[tid] || '';
}

/** 特殊地形小標（連續地圖上僅輕量圖示，非碎塊地磚） */
export function terrainBadge(tid) {
  return terrainPattern(tid);
}
