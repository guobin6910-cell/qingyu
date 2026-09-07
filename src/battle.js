/** 六角戰術戰鬥引擎（odd-r pointy-top hex） */
import { TERRAIN, CLASSES, TREES } from './data.js';
import { hexNeighbors, hexDistance } from './hex.js';

export function createBattle(state, mapDef) {
  const h = mapDef.grid.length;
  const w = mapDef.grid[0].length;
  const units = [];
  let uid = 0;

  const deploy = state.roster.filter((u) => u.recruited);
  mapDef.playerStarts.forEach((pos, i) => {
    const src = deploy[i];
    if (!src) return;
    const cls = CLASSES[src.classId];
    units.push({
      id: `p${uid++}`,
      side: 'player',
      srcUid: src.uid,
      name: src.name,
      classId: src.classId,
      tree: cls.tree,
      move: cls.move,
      range: cls.range,
      hp: src.hp,
      maxHp: src.maxHp || cls.hp,
      atk: cls.atk,
      def: cls.def,
      mag: cls.mag,
      res: cls.res,
      heal: !!cls.heal,
      skill: cls.skill ? { ...cls.skill, used: false } : null,
      x: pos[0],
      y: pos[1],
      moved: false,
      acted: false,
      alive: true,
      hero: !!src.hero,
      boss: false,
    });
  });

  for (const e of mapDef.enemies) {
    const cls = CLASSES[e.classId];
    const hpMul = e.hpMul || 1;
    units.push({
      id: `e${uid++}`,
      side: 'enemy',
      name: e.name,
      classId: e.classId,
      tree: cls.tree,
      move: cls.move,
      range: cls.range,
      hp: Math.round(cls.hp * hpMul),
      maxHp: Math.round(cls.hp * hpMul),
      atk: cls.atk,
      def: cls.def,
      mag: cls.mag,
      res: cls.res,
      heal: !!cls.heal,
      skill: null,
      x: e.pos[0],
      y: e.pos[1],
      moved: false,
      acted: false,
      alive: true,
      ai: e.ai || 'aggro',
      boss: !!e.boss,
      hero: false,
    });
  }

  return {
    mapDef,
    grid: mapDef.grid,
    w,
    h,
    units,
    turn: 1,
    phase: 'player', // player | enemy
    selected: null,
    mode: 'select', // select | move | act | skill
    moveHint: [],
    attackHint: [],
    log: [`—— ${mapDef.name} ——`],
    floats: [],
    result: null, // win | lose
    flags: {
      steppedVillage: false,
      steppedShop: false,
      steppedSecret: false,
      shopOpen: false,
    },
    waitHeal: 8,
  };
}

export function terrainAt(battle, x, y) {
  if (y < 0 || y >= battle.h || x < 0 || x >= battle.w) return null;
  return TERRAIN[battle.grid[y][x]] || TERRAIN.plain;
}

export function unitAt(battle, x, y) {
  return battle.units.find((u) => u.alive && u.x === x && u.y === y) || null;
}

function inBounds(battle, x, y) {
  return x >= 0 && y >= 0 && x < battle.w && y < battle.h;
}

/** BFS 移動範圍 */
export function computeMoveRange(battle, unit) {
  const cells = [];
  const cost = Array.from({ length: battle.h }, () => Array(battle.w).fill(Infinity));
  cost[unit.y][unit.x] = 0;
  const q = [[unit.x, unit.y]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [nx, ny] of hexNeighbors(x, y)) {
      if (!inBounds(battle, nx, ny)) continue;
      const t = terrainAt(battle, nx, ny);
      if (!t || t.block || t.move >= 99) continue;
      const occ = unitAt(battle, nx, ny);
      if (occ && occ.side !== unit.side) continue; // 不可穿過敵
      const nc = cost[y][x] + t.move;
      if (nc > unit.move) continue;
      if (nc < cost[ny][nx]) {
        cost[ny][nx] = nc;
        q.push([nx, ny]);
      }
    }
  }
  for (let y = 0; y < battle.h; y++) {
    for (let x = 0; x < battle.w; x++) {
      if (cost[y][x] === Infinity) continue;
      if (x === unit.x && y === unit.y) {
        cells.push({ x, y, cost: 0 });
        continue;
      }
      const occ = unitAt(battle, x, y);
      if (occ) continue; // 不可停在友軍上
      cells.push({ x, y, cost: cost[y][x] });
    }
  }
  return cells;
}

export function manhattan(x1, y1, x2, y2) {
  return hexDistance(x1, y1, x2, y2);
}

export { hexDistance };

export function computeAttackRange(battle, unit, fromX = unit.x, fromY = unit.y) {
  const cells = [];
  for (let y = 0; y < battle.h; y++) {
    for (let x = 0; x < battle.w; x++) {
      const d = hexDistance(fromX, fromY, x, y);
      if (d >= 1 && d <= unit.range) cells.push({ x, y });
    }
  }
  return cells;
}

function counterMul(attacker, defender) {
  const at = TREES[attacker.tree];
  if (!at) return 1;
  if (at.counter === defender.tree) return 1.25;
  if (at.weak === defender.tree) return 0.8;
  return 1;
}

export function calcDamage(battle, attacker, defender) {
  const tDef = terrainAt(battle, defender.x, defender.y);
  const terrainBonus = tDef ? tDef.def : 0;
  const useMag = attacker.tree === 'magic' && !attacker.heal;
  let raw;
  if (useMag) {
    raw = attacker.mag * 1.2 - defender.res * 0.5;
  } else if (attacker.heal) {
    raw = attacker.mag * 0.9 - defender.res * 0.3;
  } else {
    raw = attacker.atk - defender.def * 0.5 - terrainBonus;
  }
  raw *= counterMul(attacker, defender);
  const dmg = Math.max(1, Math.round(raw));
  return dmg;
}

export function calcHeal(attacker, target) {
  return Math.max(5, Math.round(attacker.mag * 1.1));
}

function pushFloat(battle, x, y, text, kind) {
  battle.floats.push({ id: Math.random().toString(36).slice(2), x, y, text, kind, t: Date.now() });
}

export function selectUnit(battle, unit) {
  if (battle.phase !== 'player' || battle.result) return;
  if (!unit || unit.side !== 'player' || !unit.alive || unit.acted) {
    battle.selected = null;
    battle.mode = 'select';
    battle.moveHint = [];
    battle.attackHint = [];
    return;
  }
  battle.selected = unit.id;
  battle.mode = 'move';
  battle.moveHint = computeMoveRange(battle, unit);
  battle.attackHint = [];
}

export function tryMove(battle, x, y) {
  const unit = battle.units.find((u) => u.id === battle.selected);
  if (!unit || battle.mode !== 'move') return false;
  const cell = battle.moveHint.find((c) => c.x === x && c.y === y);
  if (!cell) return false;
  unit.x = x;
  unit.y = y;
  unit.moved = true;
  // 特殊格
  const t = terrainAt(battle, x, y);
  if (t?.special === 'village') battle.flags.steppedVillage = true;
  if (t?.special === 'shop') battle.flags.steppedShop = true;
  if (t?.special === 'secret') battle.flags.steppedSecret = true;

  battle.mode = 'act';
  battle.moveHint = [];
  battle.attackHint = computeAttackRange(battle, unit);
  return true;
}

function snapUnit(u) {
  return {
    id: u.id,
    name: u.name,
    classId: u.classId,
    side: u.side,
    tree: u.tree,
    hp: u.hp,
    maxHp: u.maxHp,
    atk: u.atk,
    def: u.def,
    mag: u.mag,
    res: u.res,
    hero: !!u.hero,
    boss: !!u.boss,
    srcUid: u.srcUid || null,
    x: u.x,
    y: u.y,
  };
}

/** 預覽攻擊／治療結果（不改戰鬥狀態） */
export function planTryAttack(battle, tx, ty) {
  const unit = battle.units.find((u) => u.id === battle.selected);
  if (!unit || (battle.mode !== 'act' && battle.mode !== 'skill')) return null;
  const hint = battle.attackHint.find((c) => c.x === tx && c.y === ty);
  if (!hint) return null;
  const target = unitAt(battle, tx, ty);
  if (!target) return null;
  return buildCombatPlan(battle, unit, target, {
    skillMode: battle.mode === 'skill',
    finishAct: true,
  });
}

export function buildCombatPlan(battle, attacker, target, opts = {}) {
  const skillMode = !!opts.skillMode;
  const finish = opts.finishAct !== false;

  if (attacker.heal && target.side === attacker.side) {
    const h = calcHeal(attacker, target);
    return {
      kind: 'heal',
      attackerId: attacker.id,
      targetId: target.id,
      attacker: snapUnit(attacker),
      defender: snapUnit(target),
      healAmount: h,
      dmg: 0,
      counterDmg: 0,
      skillName: null,
      ultimate: false,
      aoe: [],
      finishAct: finish,
      markSkillUsed: false,
    };
  }

  if (target.side === attacker.side) return null;

  let dmg = calcDamage(battle, attacker, target);
  let skillName = null;
  let ultimate = false;
  let markSkillUsed = false;
  const aoe = [];

  if (skillMode && attacker.skill && attacker.skill.type === 'attack') {
    const sk = attacker.skill;
    dmg = Math.round(dmg * (sk.power || 1.5));
    if (sk.id === 'bi_sha_break') dmg = Math.round(dmg * 1.1);
    skillName = sk.name;
    ultimate = sk.tier !== 'tech';
    markSkillUsed = true;
    if (sk.aoe) {
      const extras = battle.units.filter(
        (u) => u.alive && u.side === target.side && u.id !== target.id
          && manhattan(u.x, u.y, target.x, target.y) === 1
      ).slice(0, 2);
      for (const ex of extras) {
        aoe.push({
          id: ex.id,
          name: ex.name,
          x: ex.x,
          y: ex.y,
          dmg: Math.max(1, Math.round(dmg * 0.7)),
          hpBefore: ex.hp,
          maxHp: ex.maxHp,
        });
      }
    }
  }

  let counterDmg = 0;
  const canCounter = target.range === 1 && attacker.range === 1
    && manhattan(attacker.x, attacker.y, target.x, target.y) <= target.range;
  // 反擊僅在主目標 theoretically 存活時（依計劃傷害判斷）
  if (canCounter && target.hp - dmg > 0) {
    counterDmg = calcDamage(battle, target, attacker);
  }

  return {
    kind: 'attack',
    attackerId: attacker.id,
    targetId: target.id,
    attacker: snapUnit(attacker),
    defender: snapUnit(target),
    healAmount: 0,
    dmg,
    counterDmg,
    skillName,
    ultimate,
    tier: ultimate ? 'ulti' : (skillName ? 'tech' : null),
    aoe,
    finishAct: finish,
    markSkillUsed,
  };
}

/** 套用交鋒計劃 */
export function commitAttackPlan(battle, plan) {
  if (!plan) return false;
  const unit = battle.units.find((u) => u.id === plan.attackerId);
  const target = battle.units.find((u) => u.id === plan.targetId);
  if (!unit || !target) return false;

  if (plan.kind === 'heal') {
    const h = plan.healAmount;
    target.hp = Math.min(target.maxHp, target.hp + h);
    pushFloat(battle, target.x, target.y, `+${h}`, 'heal');
    battle.log.push(`${unit.name} 治療 ${target.name} +${h}`);
  } else if (plan.kind === 'skill_heal') {
    if (plan.markSkillUsed && unit.skill) unit.skill.used = true;
    if (plan.skillName) battle.log.push(`${unit.name} 發動【${plan.skillName}】！`);
    for (const ht of plan.healTargets || []) {
      const a = battle.units.find((u) => u.id === ht.id);
      if (!a || !a.alive) continue;
      a.hp = Math.min(a.maxHp, a.hp + ht.amount);
      pushFloat(battle, a.x, a.y, `+${ht.amount}`, 'heal');
    }
  } else if (plan.kind === 'skill_buff') {
    if (plan.markSkillUsed && unit.skill) unit.skill.used = true;
    unit._buffDef = plan.buffDef || 8;
    unit._counterBonus = plan.counterBonus || 1.5;
    pushFloat(battle, unit.x, unit.y, plan.skillName || '強化', 'buff');
    if (plan.skillName) battle.log.push(`${unit.name} 發動【${plan.skillName}】`);
  } else {
    if (plan.markSkillUsed && unit.skill) {
      unit.skill.used = true;
      if (plan.skillName) battle.log.push(`${unit.name} 發動【${plan.skillName}】！`);
    }
    for (const ex of plan.aoe || []) {
      const eu = battle.units.find((u) => u.id === ex.id);
      if (!eu || !eu.alive) continue;
      eu.hp -= ex.dmg;
      pushFloat(battle, eu.x, eu.y, `-${ex.dmg}`, 'dmg');
      if (eu.hp <= 0) {
        eu.alive = false;
        eu.hp = 0;
        battle.log.push(`${eu.name} 被擊破`);
      }
    }
    target.hp -= plan.dmg;
    pushFloat(battle, target.x, target.y, `-${plan.dmg}`, 'dmg');
    battle.log.push(`${unit.name} 攻擊 ${target.name} 造成 ${plan.dmg}`);
    if (target.hp <= 0) {
      target.alive = false;
      target.hp = 0;
      battle.log.push(`${target.name} 被擊破`);
    }
    if (plan.counterDmg > 0 && target.alive) {
      unit.hp -= plan.counterDmg;
      pushFloat(battle, unit.x, unit.y, `-${plan.counterDmg}`, 'dmg');
      battle.log.push(`${target.name} 反擊 ${plan.counterDmg}`);
      if (unit.hp <= 0) {
        unit.alive = false;
        unit.hp = 0;
      }
    }
  }

  if (plan.finishAct) finishAct(battle, unit);
  checkResult(battle);
  return true;
}

export function tryAttack(battle, tx, ty) {
  const plan = planTryAttack(battle, tx, ty);
  if (!plan) return false;
  return commitAttackPlan(battle, plan);
}

export function trySkill(battle) {
  const unit = battle.units.find((u) => u.id === battle.selected);
  if (!unit || !unit.skill || unit.skill.used || battle.mode !== 'act') return null;
  const sk = unit.skill;
  if (sk.type === 'buff') {
    return {
      kind: 'skill_buff',
      attackerId: unit.id,
      targetId: unit.id,
      attacker: snapUnit(unit),
      defender: snapUnit(unit),
      healAmount: 0,
      dmg: 0,
      counterDmg: 0,
      skillName: sk.name,
      ultimate: sk.tier !== 'tech',
      tier: sk.tier || 'ulti',
      aoe: [],
      finishAct: true,
      markSkillUsed: true,
      buffDef: 8,
      counterBonus: 1.5,
    };
  }
  if (sk.type === 'heal') {
    const allies = battle.units.filter(
      (u) => u.alive && u.side === unit.side && manhattan(u.x, u.y, unit.x, unit.y) <= 2
    );
    const heals = allies.map((a) => ({
      id: a.id,
      name: a.name,
      x: a.x,
      y: a.y,
      amount: Math.round(calcHeal(unit, a) * (sk.power || 1.5)),
      hpBefore: a.hp,
      maxHp: a.maxHp,
    }));
    const primary = allies.find((a) => a.id === unit.id) || allies[0] || unit;
    return {
      kind: 'skill_heal',
      attackerId: unit.id,
      targetId: primary.id,
      attacker: snapUnit(unit),
      defender: snapUnit(primary),
      healAmount: heals.find((h) => h.id === primary.id)?.amount || 0,
      healTargets: heals,
      dmg: 0,
      counterDmg: 0,
      skillName: sk.name,
      ultimate: sk.tier !== 'tech',
      tier: sk.tier || 'ulti',
      aoe: [],
      finishAct: true,
      markSkillUsed: true,
    };
  }
  // attack skill → 進入 skill 瞄準
  battle.mode = 'skill';
  battle.attackHint = computeAttackRange(battle, unit);
  return { kind: 'aim' };
}

export function waitUnit(battle) {
  const unit = battle.units.find((u) => u.id === battle.selected);
  if (!unit || (battle.mode !== 'act' && battle.mode !== 'move')) return false;
  // 待機回復
  const heal = battle.waitHeal || 8;
  unit.hp = Math.min(unit.maxHp, unit.hp + heal);
  pushFloat(battle, unit.x, unit.y, `+${heal}`, 'heal');
  battle.log.push(`${unit.name} 待機，回復 ${heal}`);
  // 若還在 move 模式沒移動，也算結束
  finishAct(battle, unit);
  checkResult(battle);
  return true;
}

function finishAct(battle, unit) {
  unit.acted = true;
  unit.moved = true;
  battle.selected = null;
  battle.mode = 'select';
  battle.moveHint = [];
  battle.attackHint = [];
  // 若全員行動完 → 敵方
  const players = battle.units.filter((u) => u.side === 'player' && u.alive);
  if (players.every((u) => u.acted)) {
    endPlayerPhase(battle);
  }
}

export function endPlayerPhase(battle) {
  if (battle.result) return;
  battle.phase = 'enemy';
  battle.selected = null;
  battle.mode = 'select';
  battle.moveHint = [];
  battle.attackHint = [];
  battle.log.push(`—— 敵方回合 ——`);
}

/** 執行一整個敵方階段（同步，供 UI / playtest） */
export function runEnemyPhase(battle) {
  if (battle.phase !== 'enemy' || battle.result) return;
  const enemies = battle.units.filter((u) => u.side === 'enemy' && u.alive);
  for (const e of enemies) {
    if (!e.alive || battle.result) break;
    enemyAct(battle, e);
    checkResult(battle);
  }
  finalizeEnemyPhase(battle);
}

/** 敵單位移動並決定攻擊；回傳交鋒計劃（尚未扣血）。 */
export function enemyPrepare(battle, e) {
  const players = battle.units.filter((u) => u.side === 'player' && u.alive);
  if (!players.length) {
    e.acted = true;
    return null;
  }

  const moveCells = computeMoveRange(battle, e);
  let best = null;
  const ox = e.x;
  const oy = e.y;
  for (const cell of moveCells) {
    e.x = -99;
    e.y = -99;
    const blocked = unitAt(battle, cell.x, cell.y);
    if (blocked) {
      e.x = ox;
      e.y = oy;
      continue;
    }
    e.x = cell.x;
    e.y = cell.y;
    const targets = players.filter((p) => manhattan(e.x, e.y, p.x, p.y) <= e.range);
    for (const t of targets) {
      const dmg = calcDamage(battle, e, t);
      const score = dmg + (t.hero ? 5 : 0) + (t.hp <= dmg ? 50 : 0) - cell.cost;
      if (!best || score > best.score) best = { x: cell.x, y: cell.y, target: t, score, dmg };
    }
    e.x = ox;
    e.y = oy;
  }

  if (best) {
    e.x = best.x;
    e.y = best.y;
    const plan = buildCombatPlan(battle, e, best.target, {
      skillMode: false,
      finishAct: false,
    });
    return plan;
  }

  if (e.ai === 'aggro') {
    let nearest = players[0];
    let nd = manhattan(ox, oy, nearest.x, nearest.y);
    for (const p of players) {
      const d = manhattan(ox, oy, p.x, p.y);
      if (d < nd) {
        nd = d;
        nearest = p;
      }
    }
    let bestCell = { x: ox, y: oy, d: nd };
    e.x = -99;
    e.y = -99;
    for (const cell of moveCells) {
      if (unitAt(battle, cell.x, cell.y)) continue;
      const d = manhattan(cell.x, cell.y, nearest.x, nearest.y);
      if (d < bestCell.d) bestCell = { x: cell.x, y: cell.y, d };
    }
    e.x = bestCell.x;
    e.y = bestCell.y;
  } else {
    e.x = ox;
    e.y = oy;
  }
  e.acted = true;
  return null;
}

function enemyAct(battle, e) {
  const plan = enemyPrepare(battle, e);
  if (plan) {
    commitAttackPlan(battle, plan);
    e.acted = true;
  }
}

/** 結束敵方階段、開啟新回合（runEnemyPhase 尾段） */
export function finalizeEnemyPhase(battle) {
  if (!battle.result) {
    for (const u of battle.units) {
      u.moved = false;
      u.acted = false;
    }
    battle.turn += 1;
    battle.phase = 'player';
    battle.log.push(`—— 第 ${battle.turn} 回合 ——`);
  }
}

function checkResult(battle) {
  const enemies = battle.units.filter((u) => u.side === 'enemy' && u.alive);
  const players = battle.units.filter((u) => u.side === 'player' && u.alive);
  if (!players.length) {
    battle.result = 'lose';
    battle.log.push('戰敗……');
    return;
  }
  if (battle.mapDef.bossKill) {
    const bosses = battle.units.filter((u) => u.boss);
    if (bosses.length && bosses.every((b) => !b.alive)) {
      battle.result = 'win';
      battle.log.push('敵將已滅！勝利！');
      return;
    }
  }
  if (!enemies.length) {
    battle.result = 'win';
    battle.log.push('敵人全滅！勝利！');
  }
}

/** 無頭自動戰鬥：玩家貪婪 AI，直到勝負 */
export function autoPlayBattle(battle, maxTurns = 40) {
  while (!battle.result && battle.turn <= maxTurns) {
    if (battle.phase === 'player') {
      const players = battle.units.filter((u) => u.side === 'player' && u.alive && !u.acted);
      if (!players.length) {
        endPlayerPhase(battle);
        continue;
      }
      // 依序行動
      for (const p of [...players]) {
        if (!p.alive || p.acted || battle.result) continue;
        playerGreedyAct(battle, p);
        checkResult(battle);
      }
      if (!battle.result && battle.phase === 'player') {
        const left = battle.units.filter((u) => u.side === 'player' && u.alive && !u.acted);
        if (!left.length) endPlayerPhase(battle);
      }
    } else {
      runEnemyPhase(battle);
    }
  }
  if (!battle.result) battle.result = 'lose'; // timeout
  return battle.result;
}

function playerGreedyAct(battle, p) {
  const enemies = battle.units.filter((u) => u.side === 'enemy' && u.alive);
  const allies = battle.units.filter((u) => u.side === 'player' && u.alive && u.hp < u.maxHp);
  const ox = p.x;
  const oy = p.y;
  const moveCells = computeMoveRange(battle, p);
  let best = null;

  for (const cell of moveCells) {
    p.x = -99;
    p.y = -99;
    if (unitAt(battle, cell.x, cell.y)) {
      p.x = ox;
      p.y = oy;
      continue;
    }
    p.x = cell.x;
    p.y = cell.y;

    const terr = terrainAt(battle, cell.x, cell.y);
    let bonus = terr && terr.def ? terr.def * 2 : 0;
    // 隱藏格輕微加分，不可壓過攻擊
    if (terr?.special === 'secret') bonus += 3;
    if (terr?.special === 'village') bonus += 3;

    if (p.heal) {
      for (const a of allies) {
        if (a.id === p.id) continue;
        if (manhattan(p.x, p.y, a.x, a.y) <= p.range && a.hp < a.maxHp) {
          const score = 40 + (a.maxHp - a.hp) + (a.hero ? 10 : 0) + bonus;
          if (!best || score > best.score) best = { x: cell.x, y: cell.y, kind: 'heal', target: a, score };
        }
      }
    }
    if (!p.heal || (p.mag && p.atk >= 5)) {
      for (const e of enemies) {
        if (manhattan(p.x, p.y, e.x, e.y) <= p.range) {
          const dmg = calcDamage(battle, p, e);
          const score = 50 + dmg + (e.boss ? 25 : 0) + (e.hp <= dmg ? 60 : 0) + bonus;
          if (!best || score > best.score) best = { x: cell.x, y: cell.y, kind: 'atk', target: e, score, dmg };
        }
      }
    }
    // 靠近最近敵人
    {
      let nearest = enemies[0];
      let nd = nearest ? manhattan(cell.x, cell.y, nearest.x, nearest.y) : 99;
      for (const e of enemies) {
        const d = manhattan(cell.x, cell.y, e.x, e.y);
        if (d < nd) { nd = d; nearest = e; }
      }
      if (nearest) {
        const score = 15 - nd + bonus;
        if (!best || score > best.score) best = { x: cell.x, y: cell.y, kind: 'move', score };
      }
    }
    p.x = ox;
    p.y = oy;
  }

  if (!best) {
    // 待機
    battle.selected = p.id;
    battle.mode = 'act';
    waitUnit(battle);
    return;
  }
  p.x = best.x;
  p.y = best.y;
  const t = terrainAt(battle, p.x, p.y);
  if (t?.special === 'village') battle.flags.steppedVillage = true;
  if (t?.special === 'shop') battle.flags.steppedShop = true;
  if (t?.special === 'secret') battle.flags.steppedSecret = true;

  if (best.kind === 'atk' && best.target) {
    let dmg = calcDamage(battle, p, best.target);
    if (p.skill && !p.skill.used && p.skill.type === 'attack') {
      dmg = Math.round(dmg * (p.skill.power || 1.25));
      p.skill.used = true;
      battle.log.push(`${p.name} 發動【${p.skill.name}】！`);
    }
    best.target.hp -= dmg;
    pushFloat(battle, best.target.x, best.target.y, `-${dmg}`, 'dmg');
    if (best.target.hp <= 0) {
      best.target.alive = false;
      best.target.hp = 0;
    }
  } else if (best.kind === 'heal' && best.target) {
    if (p.skill && !p.skill.used && p.skill.type === 'heal') {
      const allies = battle.units.filter(
        (u) => u.alive && u.side === 'player' && manhattan(u.x, u.y, p.x, p.y) <= 2
      );
      for (const a of allies) {
        const h = Math.round(calcHeal(p, a) * (p.skill.power || 1.2));
        a.hp = Math.min(a.maxHp, a.hp + h);
        pushFloat(battle, a.x, a.y, `+${h}`, 'heal');
      }
      p.skill.used = true;
      battle.log.push(`${p.name} 發動【${p.skill.name}】！`);
    } else {
      const h = calcHeal(p, best.target);
      best.target.hp = Math.min(best.target.maxHp, best.target.hp + h);
      pushFloat(battle, best.target.x, best.target.y, `+${h}`, 'heal');
    }
  }
  p.acted = true;
  p.moved = true;
}

/** 同步戰鬥結果回存檔單位 */
export function syncBattleToState(state, battle) {
  for (const bu of battle.units.filter((u) => u.side === 'player')) {
    const src = state.roster.find((r) => r.uid === bu.srcUid);
    if (!src) continue;
    src.hp = Math.max(0, bu.hp);
    src.alive = bu.alive;
  }
}

export { TERRAIN };
