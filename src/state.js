/** 存檔與全域狀態 */
import {
  SAVE_KEY, STARTER_ROSTER, CLASSES, TREES, TRANSFER_GOLD,
  getClassChildren, rootClass, MAPS, ITEMS, RECRUIT_CANDIDATE,
} from './data.js';

export function newGame() {
  return {
    version: 1,
    gold: 50,
    mapIndex: 0,
    flags: {
      recruitedHaiNing: false,
      foundSecretM1: false,
      exclusiveUnlocked: false,
      shopBought: {},
    },
    roster: STARTER_ROSTER(),
    inventory: { herb: 1 },
    cleared: [],
    log: [],
  };
}

export function saveGame(state, storage = globalThis.localStorage) {
  if (!storage) return false;
  storage.setItem(SAVE_KEY, JSON.stringify(state));
  return true;
}

export function loadGame(storage = globalThis.localStorage) {
  if (!storage) return null;
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (!s || s.version !== 1 || !Array.isArray(s.roster)) return null;
    return s;
  } catch {
    return null;
  }
}

export function clearSave(storage = globalThis.localStorage) {
  if (storage) storage.removeItem(SAVE_KEY);
}

export function unitStats(unit) {
  const cls = CLASSES[unit.classId];
  return {
    ...cls,
    hp: unit.hp,
    maxHp: unit.maxHp || cls.hp,
    name: unit.name,
    merit: unit.merit,
    skill: cls.skill || null,
    tree: cls.tree,
  };
}

/** 戰鬥後回復至滿血（據點休整） */
export function restRoster(state) {
  for (const u of state.roster) {
    if (!u.recruited) continue;
    const cls = CLASSES[u.classId];
    u.maxHp = cls.hp;
    u.hp = cls.hp;
    u.alive = true;
  }
}

/** 增加功勳星（上限 4） */
export function grantMerit(unit, amount) {
  unit.merit = Math.min(4, (unit.merit || 0) + amount);
}

/**
 * 取得單位在某樹可轉的最高職（已解鎖路徑頂）
 * 轉樹：花金幣跳到該樹已解鎖頂（至少 rank1）
 */
export function canTransferTree(state, unit, treeId) {
  if (unit.tree === treeId) return { ok: false, reason: '已在此系' };
  if (state.gold < TRANSFER_GOLD) return { ok: false, reason: `需 ${TRANSFER_GOLD} 金` };
  return { ok: true };
}

export function transferTree(state, unit, treeId) {
  const check = canTransferTree(state, unit, treeId);
  if (!check.ok) return check;
  state.gold -= TRANSFER_GOLD;
  const top = unit.treeTops?.[treeId] || rootClass(treeId).id;
  applyClass(unit, top);
  unit.unlockedTrees = unit.unlockedTrees || {};
  unit.unlockedTrees[treeId] = true;
  return { ok: true };
}

function applyClass(unit, classId) {
  const cls = CLASSES[classId];
  const ratio = unit.maxHp > 0 ? unit.hp / unit.maxHp : 1;
  unit.classId = classId;
  unit.tree = cls.tree;
  unit.maxHp = cls.hp;
  unit.hp = Math.max(1, Math.round(cls.hp * ratio));
  unit.treeTops = unit.treeTops || {};
  const prev = unit.treeTops[cls.tree];
  const prevRank = prev ? CLASSES[prev].rank : 0;
  if (cls.rank >= prevRank) unit.treeTops[cls.tree] = classId;
}

/**
 * 同樹內晉升：選一個子職階，鎖同 branch 兄弟
 */
export function canPromote(unit, toClassId) {
  const to = CLASSES[toClassId];
  if (!to) return { ok: false, reason: '無此職' };
  if (to.tree !== unit.tree) return { ok: false, reason: '不同系，請先轉系' };
  const from = CLASSES[unit.classId];
  const isChild =
    to.parent === unit.classId ||
    (to.altParents && to.altParents.includes(unit.classId));
  if (!isChild) return { ok: false, reason: '非下一階' };
  if ((unit.merit || 0) < (to.meritNeed || 0)) {
    return { ok: false, reason: `需功勳 ${to.meritNeed}★` };
  }
  if (to.exclusive && to.exclusive !== unit.uid) {
    return { ok: false, reason: '專屬職階' };
  }
  if (to.exclusive === unit.uid && !unit.exclusiveReady) {
    return { ok: false, reason: '尚未完成隱藏試煉' };
  }
  if (to.branch && unit.lockedBranches?.[to.branch] && unit.lockedBranches[to.branch] !== toClassId) {
    return { ok: false, reason: '已選另一分支' };
  }
  // 同階其他未選分支：若同 parent 的 sibling 已被鎖
  const siblings = getClassChildren(unit.classId).filter((c) => c.branch && c.branch === to.branch);
  if (siblings.length > 1 && unit.lockedBranches?.[to.branch] && unit.lockedBranches[to.branch] !== toClassId) {
    return { ok: false, reason: '分支已鎖' };
  }
  return { ok: true };
}

export function promote(unit, toClassId) {
  const check = canPromote(unit, toClassId);
  if (!check.ok) return check;
  const to = CLASSES[toClassId];
  if (to.branch) {
    unit.lockedBranches = unit.lockedBranches || {};
    unit.lockedBranches[to.branch] = toClassId;
  }
  applyClass(unit, toClassId);
  return { ok: true };
}

export function buyItem(state, itemId) {
  const item = ITEMS[itemId];
  if (!item) return { ok: false, reason: '無此物' };
  if (state.gold < item.price) return { ok: false, reason: '金幣不足' };
  state.gold -= item.price;
  state.inventory[itemId] = (state.inventory[itemId] || 0) + 1;
  return { ok: true };
}

export function useHerbOn(state, unit, itemId = 'herb') {
  const n = state.inventory[itemId] || 0;
  if (n <= 0) return { ok: false, reason: '沒有道具' };
  const item = ITEMS[itemId];
  let heal = 30;
  if (item.effect === 'heal60') heal = 60;
  if (item.effect === 'heal30') heal = 30;
  unit.hp = Math.min(unit.maxHp, unit.hp + heal);
  state.inventory[itemId]--;
  return { ok: true, heal };
}

export function recruitHaiNing(state) {
  if (state.flags.recruitedHaiNing) return { ok: false, reason: '已招募' };
  const u = {
    uid: RECRUIT_CANDIDATE.uid,
    name: RECRUIT_CANDIDATE.name,
    classId: RECRUIT_CANDIDATE.classId,
    tree: CLASSES[RECRUIT_CANDIDATE.classId].tree,
    hero: false,
    merit: 0,
    lockedBranches: {},
    unlockedTrees: { ranged: true },
    treeTops: { ranged: RECRUIT_CANDIDATE.classId },
    hp: CLASSES[RECRUIT_CANDIDATE.classId].hp,
    maxHp: CLASSES[RECRUIT_CANDIDATE.classId].hp,
    items: [],
    alive: true,
    recruited: true,
    exclusiveReady: false,
  };
  state.roster.push(u);
  state.flags.recruitedHaiNing = true;
  return { ok: true, unit: u };
}

export function applyBattleRewards(state, mapDef, extras = {}) {
  state.gold += mapDef.winGold || 0;
  const merit = mapDef.winMerit || 0;
  for (const u of state.roster) {
    if (u.recruited && u.alive !== false) grantMerit(u, merit);
  }
  if (extras.secretMerit) {
    const hero = state.roster.find((u) => u.hero);
    if (hero) grantMerit(hero, extras.secretMerit);
    state.flags.foundSecretM1 = true;
  }
  if (mapDef.unlockExclusiveOnClear || extras.unlockExclusive) {
    const hero = state.roster.find((u) => u.hero);
    // 需功勳 4 且找過遺跡
    if (hero && hero.merit >= 4 && (state.flags.foundSecretM1 || extras.forceExclusive)) {
      hero.exclusiveReady = true;
      state.flags.exclusiveUnlocked = true;
    }
  }
  if (!state.cleared.includes(mapDef.id)) state.cleared.push(mapDef.id);
  const next = (mapDef.index ?? 0) + 1;
  if (next < MAPS.length) state.mapIndex = next;
  restRoster(state);
}

export { SAVE_KEY, TREES, CLASSES, TRANSFER_GOLD, MAPS };
