/** 美術資源與單位標記 */
import { TREES, CLASSES } from './data.js';

import coverUrl from './assets/art/cover.jpg';
import hubUrl from './assets/art/hub.jpg';
import bgM1 from './assets/art/bg-m1.jpg';
import bgM2 from './assets/art/bg-m2.jpg';
import bgM3 from './assets/art/bg-m3.jpg';

import unitLin from './assets/art/unit-lin.jpg';
import unitSu from './assets/art/unit-su.jpg';
import unitFang from './assets/art/unit-fang.jpg';
import unitHai from './assets/art/unit-hai.jpg';
import enemyBandit from './assets/art/enemy-bandit.jpg';
import enemyPirate from './assets/art/enemy-pirate.jpg';
import enemyDeserter from './assets/art/enemy-deserter.jpg';

import tokenLin from './assets/art/token-lin.png';
import tokenSu from './assets/art/token-su.png';
import tokenFang from './assets/art/token-fang.png';
import tokenHai from './assets/art/token-hai.png';
import tokenBandit from './assets/art/token-bandit.png';
import tokenPirate from './assets/art/token-pirate.png';
import tokenDeserter from './assets/art/token-deserter.png';

export const ART = {
  cover: coverUrl,
  hub: hubUrl,
  mapBg: {
    m1_tutorial: bgM1,
    m2_pass: bgM2,
    m3_harbor: bgM3,
  },
  portrait: {
    lin_qingchuan: unitLin,
    su_wanqing: unitSu,
    fang_shuo: unitFang,
    hai_ning: unitHai,
  },
  token: {
    lin_qingchuan: tokenLin,
    su_wanqing: tokenSu,
    fang_shuo: tokenFang,
    hai_ning: tokenHai,
  },
  enemyToken: {
    bandit: tokenBandit,
    pirate: tokenPirate,
    deserter: tokenDeserter,
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

export function tokenFor(unit) {
  if (!unit) return null;
  if (unit.srcUid && ART.token[unit.srcUid]) return ART.token[unit.srcUid];
  if (unit.uid && ART.token[unit.uid]) return ART.token[unit.uid];
  if (unit.side === 'enemy' || unit.boss) {
    if (unit.boss) return ART.enemyToken.deserter;
    if (unit.tree === 'ranged') return ART.enemyToken.pirate;
    if (unit.tree === 'magic') return ART.enemyToken.pirate;
    return ART.enemyToken.bandit;
  }
  // fallback by name heuristics for player without srcUid
  const n = unit.name || '';
  if (n.includes('青川')) return ART.token.lin_qingchuan;
  if (n.includes('晚晴')) return ART.token.su_wanqing;
  if (n.includes('方朔')) return ART.token.fang_shuo;
  if (n.includes('海寧')) return ART.token.hai_ning;
  return null;
}

/** 戰鬥格上的單位標記（圖片優先，否則 SVG） */
export function unitTokenHTML(unit, size = 36) {
  const tok = tokenFor(unit);
  const tree = TREES[unit.tree] || TREES.melee;
  const color = tree.color;
  const isEnemy = unit.side === 'enemy';
  const stroke = isEnemy ? '#e05050' : color;
  const hpPct = Math.max(0, Math.round((unit.hp / Math.max(1, unit.maxHp)) * 100));
  const crown = unit.boss ? '★' : unit.hero ? '◆' : '';
  if (tok) {
    return `<div class="unit-token" style="width:${size}px;height:${size}px;--ring:${stroke}">
      <img src="${tok}" alt="${unit.name}" draggable="false" />
      ${crown ? `<span class="crown">${crown}</span>` : ''}
      <span class="hpbar"><i style="width:${hpPct}%"></i></span>
    </div>`;
  }
  return unitTokenSVG(unit, size);
}

export function unitTokenSVG(unit, size = 36) {
  const tree = TREES[unit.tree] || TREES.melee;
  const color = tree.color;
  const letter = (unit.name || '?').slice(0, 1);
  const hpPct = Math.max(0, Math.round((unit.hp / unit.maxHp) * 100));
  const isEnemy = unit.side === 'enemy';
  const bg = isEnemy ? '#3a1a1a' : '#0d2137';
  const stroke = isEnemy ? '#e05050' : color;
  const crown = unit.boss ? '★' : unit.hero ? '◆' : '';
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40">
  <rect x="1" y="1" width="38" height="38" rx="8" fill="${bg}" stroke="${stroke}" stroke-width="2"/>
  <circle cx="20" cy="16" r="8" fill="${color}" opacity="0.9"/>
  <text x="20" y="20" text-anchor="middle" font-size="10" font-weight="700" fill="#0a1520">${letter}</text>
  <text x="20" y="32" text-anchor="middle" font-size="8" fill="${stroke}">${CLASSES[unit.classId]?.name?.slice(0, 2) || ''}</text>
  ${crown ? `<text x="32" y="10" font-size="8" fill="#ffd700">${crown}</text>` : ''}
  <rect x="4" y="35" width="32" height="3" rx="1" fill="#222"/>
  <rect x="4" y="35" width="${32 * hpPct / 100}" height="3" rx="1" fill="${hpPct > 40 ? '#4ec99a' : '#e05050'}"/>
</svg>`;
}

export function terrainPattern(tid) {
  const map = {
    plain: '平', hill: '山', forest: '林', wall: '牆', ford: '灘',
    village: '村', shop: '店', secret: '※', harbor: '港',
  };
  return map[tid] || '·';
}
