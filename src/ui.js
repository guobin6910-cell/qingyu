/** 畫面與操作 */
import {
  TITLE, EMPIRE, PROLOGUE, MAPS, CLASSES, TREES, TERRAIN, ITEMS,
  TRANSFER_GOLD, getClassChildren, classesInTree, rootClass,
} from './data.js';
import {
  newGame, saveGame, loadGame, clearSave, unitStats, restRoster,
  canPromote, promote, canTransferTree, transferTree, buyItem,
  recruitHaiNing, applyBattleRewards, SAVE_KEY,
} from './state.js';
import {
  createBattle, selectUnit, tryMove, trySkill, waitUnit,
  endPlayerPhase, terrainAt, unitAt, syncBattleToState,
  planTryAttack, commitAttackPlan, enemyPrepare, finalizeEnemyPhase,
} from './battle.js';
import { ART, mapBackground, portraitFor, unitTokenHTML, terrainPattern } from './art.js';

let app, state, screen, battle, hubTab = 'mission', toastTimer;

export function mount(el) {
  app = el;
  state = loadGame() || null;
  showTitle();
}

function toast(msg) {
  const old = app.querySelector('.toast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  app.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2000);
}

function showTitle() {
  screen = 'title';
  battle = null;
  const has = !!loadGame();
  app.innerHTML = `
  <div class="screen title-screen" style="background-image:linear-gradient(180deg,#0b1a2acc 10%,#0b1a2af2 70%),url('${ART.cover}')">
    <div class="title-hero"><img class="title-cover-thumb" src="${ART.cover}" alt="" /></div>
    <h1>${TITLE}</h1>
    <div class="sub">${EMPIRE}</div>
    <p class="muted" style="margin-bottom:24px">手機優先　戰術 SRPG</p>
    <div class="title-actions stack">
      <button class="btn primary" id="btn-new">開始征途</button>
      <button class="btn" id="btn-cont" ${has ? '' : 'disabled'}>繼續遊戲</button>
      <button class="btn ghost" id="btn-clear" ${has ? '' : 'disabled'}>清除存檔</button>
    </div>
  </div>`;
  app.querySelector('#btn-new').onclick = () => {
    state = newGame();
    saveGame(state);
    showPrologue(0);
  };
  app.querySelector('#btn-cont').onclick = () => {
    state = loadGame();
    if (!state) return toast('沒有存檔');
    showHub();
  };
  app.querySelector('#btn-clear').onclick = () => {
    clearSave();
    toast('存檔已清除');
    showTitle();
  };
}

function showPrologue(i) {
  screen = 'prologue';
  const line = PROLOGUE[i];
  if (!line) {
    showHub();
    return;
  }
  const faceMap = { '林青川': ART.portrait.lin_qingchuan, '蘇晚晴': ART.portrait.su_wanqing, '方朔': ART.portrait.fang_shuo };
  const face = faceMap[line.speaker];
  app.innerHTML = `
  <div class="screen dialogue" id="dlg" style="background-image:linear-gradient(180deg,#0b1a2a99,#0b1a2af2),url('${ART.cover}')">
    <div class="spacer"></div>
    <div class="box">
      ${face ? `<img class="dlg-face" src="${face}" alt="" />` : ''}
      <div class="dlg-body">
      <div class="speaker">${line.speaker}</div>
      <div class="text">${line.text}</div>
      <div class="hint">點擊繼續</div>
      </div>
    </div>
  </div>`;
  const next = () => showPrologue(i + 1);
  app.querySelector('#dlg').onclick = next;
}

function showHub() {
  screen = 'hub';
  battle = null;
  restRoster(state);
  saveGame(state);
  const map = MAPS[Math.min(state.mapIndex, MAPS.length - 1)];
  const done = state.cleared.length >= MAPS.length;

  app.innerHTML = `
  <div class="screen hub-screen" style="background-image:linear-gradient(180deg,#0b1a2ae6,#0b1a2af5),url('${ART.hub}')">
    <div class="hub-header">
      <div>
        <h2>${TITLE}</h2>
        <div class="muted">第一章 · 潮起村外</div>
      </div>
      <div class="gold">💰 ${state.gold}</div>
    </div>
    <div class="tabs">
      <div class="tab ${hubTab === 'mission' ? 'active' : ''}" data-t="mission">出征</div>
      <div class="tab ${hubTab === 'roster' ? 'active' : ''}" data-t="roster">名簿</div>
      <div class="tab ${hubTab === 'class' ? 'active' : ''}" data-t="class">轉職</div>
      <div class="tab ${hubTab === 'shop' ? 'active' : ''}" data-t="shop">商店</div>
      <div class="tab ${hubTab === 'save' ? 'active' : ''}" data-t="save">存檔</div>
    </div>
    <div class="panel" id="hub-body"></div>
  </div>`;

  app.querySelectorAll('.tab').forEach((el) => {
    el.onclick = () => {
      hubTab = el.dataset.t;
      showHub();
    };
  });

  const body = app.querySelector('#hub-body');
  if (hubTab === 'mission') {
    body.innerHTML = done
      ? `<div class="card"><div class="name">第一章通關</div>
         <p class="muted">青港已奪回。後續篇章待續……</p>
         <button class="btn" id="btn-replay">再戰青港</button></div>`
      : `<div class="card">
          <div class="name">下一戰：${map.name}</div>
          <p class="muted">${map.brief}</p>
          <p>目標：${map.objective}</p>
          <button class="btn primary" id="btn-fight">出征</button>
        </div>
        <div class="muted">已通關 ${state.cleared.length}/${MAPS.length}</div>`;
    const bf = body.querySelector('#btn-fight');
    if (bf) bf.onclick = () => startBattle(map);
    const rp = body.querySelector('#btn-replay');
    if (rp) rp.onclick = () => startBattle(MAPS[MAPS.length - 1]);
  } else if (hubTab === 'roster') {
    body.innerHTML = state.roster
      .filter((u) => u.recruited)
      .map((u) => {
        const s = unitStats(u);
        const stars = '★'.repeat(u.merit || 0) + '☆'.repeat(4 - (u.merit || 0));
        const por = portraitFor(u);
        return `<div class="card ${s.tree} roster-card">
          ${por ? `<img class="roster-portrait" src="${por}" alt="${u.name}" />` : ''}
          <div class="roster-info">
          <div class="row"><span class="name">${u.name}</span>
            <span class="muted">${s.name}</span>
            <span class="spacer"></span>
            <span class="stars">${stars}</span>
          </div>
          <div class="muted">HP ${u.hp}/${u.maxHp}　移 ${s.move}　射程 ${s.range}
           　攻 ${s.atk} 防 ${s.def} 術 ${s.mag}</div>
          ${s.skill ? `<div class="muted">必殺：${s.skill.name}</div>` : ''}
          ${u.exclusiveReady ? `<div class="gold">可覺醒專屬 Rank-4</div>` : ''}
          </div>
        </div>`;
      })
      .join('');
  } else if (hubTab === 'class') {
    renderClassTab(body);
  } else if (hubTab === 'shop') {
    body.innerHTML = Object.values(ITEMS)
      .map(
        (it) => `<div class="card row">
        <div class="spacer"><div class="name">${it.name}</div>
        <div class="muted">${it.desc}</div></div>
        <div class="gold">${it.price}金</div>
        <button class="btn small" data-buy="${it.id}">買</button>
      </div>`
      )
      .join('') +
      `<div class="muted">持有：${Object.entries(state.inventory)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${ITEMS[k]?.name || k}×${n}`)
        .join('、') || '無'}</div>
       <p class="muted">轉系費用：${TRANSFER_GOLD} 金（可轉至該系已解鎖頂階）</p>`;
    body.querySelectorAll('[data-buy]').forEach((btn) => {
      btn.onclick = () => {
        const r = buyItem(state, btn.dataset.buy);
        toast(r.ok ? '購入成功' : r.reason);
        if (r.ok) {
          saveGame(state);
          showHub();
        }
      };
    });
  } else {
    body.innerHTML = `
      <div class="card">
        <div class="name">存檔</div>
        <p class="muted">鍵名：${SAVE_KEY}</p>
        <button class="btn primary" id="btn-save">立即儲存</button>
        <button class="btn" id="btn-title">回標題</button>
      </div>`;
    body.querySelector('#btn-save').onclick = () => {
      saveGame(state);
      toast('已儲存');
    };
    body.querySelector('#btn-title').onclick = () => showTitle();
  }
}

function renderClassTab(body) {
  const units = state.roster.filter((u) => u.recruited);
  let html = units
    .map((u) => {
      const s = unitStats(u);
      const children = getClassChildren(u.classId);
      const promoteBtns = children
        .map((c) => {
          const chk = canPromote(u, c.id);
          return `<button class="btn small" data-promo="${u.uid}:${c.id}" ${chk.ok ? '' : 'disabled'}
            title="${chk.reason || ''}">→ ${c.name}${c.meritNeed ? `(${c.meritNeed}★)` : ''}</button>`;
        })
        .join('');
      const treeBtns = Object.values(TREES)
        .filter((t) => t.id !== u.tree)
        .map((t) => {
          const chk = canTransferTree(state, u, t.id);
          const top = u.treeTops?.[t.id] || rootClass(t.id).id;
          return `<button class="btn small" data-tree="${u.uid}:${t.id}" ${chk.ok ? '' : 'disabled'}>
            轉${t.name}（${CLASSES[top].name}）${TRANSFER_GOLD}金</button>`;
        })
        .join('');
      return `<div class="card ${s.tree}">
        <div class="name">${u.name} · ${s.name}</div>
        <div class="stars">${'★'.repeat(u.merit || 0)}${'☆'.repeat(4 - (u.merit || 0))}</div>
        <div class="muted">同系晉升（選分支會鎖定另一邊）：</div>
        <div class="row">${promoteBtns || '<span class="muted">已達頂或需更多功勳</span>'}</div>
        <div class="muted">轉系：</div>
        <div class="row">${treeBtns}</div>
      </div>`;
    })
    .join('');
  body.innerHTML = html;
  body.querySelectorAll('[data-promo]').forEach((btn) => {
    btn.onclick = () => {
      const [uid, cid] = btn.dataset.promo.split(':');
      const u = state.roster.find((x) => x.uid === uid);
      const r = promote(u, cid);
      toast(r.ok ? `晉升為 ${CLASSES[cid].name}` : r.reason);
      if (r.ok) {
        saveGame(state);
        showHub();
      }
    };
  });
  body.querySelectorAll('[data-tree]').forEach((btn) => {
    btn.onclick = () => {
      const [uid, tid] = btn.dataset.tree.split(':');
      const u = state.roster.find((x) => x.uid === uid);
      const r = transferTree(state, u, tid);
      toast(r.ok ? `已轉至 ${TREES[tid].name}` : r.reason);
      if (r.ok) {
        saveGame(state);
        showHub();
      }
    };
  });
}

function startBattle(mapDef) {
  battle = createBattle(state, mapDef);
  renderBattle();
}

function renderBattle() {
  screen = 'battle';
  if (!battle) return;
  const b = battle;
  const cellSize = b.w >= 8 ? 40 : 44;

  let gridHtml = '';
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const t = terrainAt(b, x, y);
      const u = unitAt(b, x, y);
      const isMove = b.moveHint.some((c) => c.x === x && c.y === y);
      const isAtk = b.attackHint.some((c) => c.x === x && c.y === y);
      const sel = u && u.id === b.selected;
      const cls = [
        'cell',
        isMove ? 'move-hint' : '',
        isAtk ? 'atk-hint' : '',
        sel ? 'selected' : '',
      ].join(' ');
      gridHtml += `<div class="${cls}" data-x="${x}" data-y="${y}"
        style="background:${t.color};width:${cellSize}px;height:${cellSize}px"
        title="${t.name}">
        ${u ? '' : `<span>${terrainPattern(t.id)}</span>`}
        ${u ? `<div class="tok">${unitTokenHTML(u, cellSize - 4)}</div>` : ''}
      </div>`;
    }
  }

  const selU = b.units.find((u) => u.id === b.selected);
  const phaseLabel = b.phase === 'player' ? '我軍' : '敵軍';
  const canSkill = selU && selU.skill && !selU.skill.used && b.mode === 'act';

  const bgUrl = mapBackground(b.mapDef.id);
  app.innerHTML = `
  <div class="screen battle-screen" style="background-image:linear-gradient(180deg,#0b1a2acc,#0b1a2ae8),url('${bgUrl}')">
    <div class="battle-top">
      <strong>${b.mapDef.name}</strong>
      <span>T${b.turn} · ${phaseLabel}</span>
      <span class="gold">${state.gold}金</span>
    </div>
    <div class="grid-wrap" style="position:relative">
      <div class="grid" style="grid-template-columns:repeat(${b.w}, ${cellSize}px)">
        ${gridHtml}
      </div>
    </div>
    <div class="battle-bar">
      <div class="muted" style="margin-bottom:4px">
        ${selU ? `${selU.name}（${CLASSES[selU.classId].name}）HP ${selU.hp}/${selU.maxHp}` : '點選我軍單位 → 移動 → 攻擊／待機'}
      </div>
      <div class="actions">
        <button class="btn small" id="btn-wait" ${selU && (b.mode === 'act' || b.mode === 'move') ? '' : 'disabled'}>待機</button>
        <button class="btn small" id="btn-skill" ${canSkill ? '' : 'disabled'}>必殺</button>
        <button class="btn small" id="btn-end" ${b.phase === 'player' && !b.result ? '' : 'disabled'}>結束回合</button>
        <button class="btn small ghost" id="btn-flee">撤退</button>
      </div>
      <div class="battle-log">${b.log.slice(-5).map((l) => `<div>${l}</div>`).join('')}</div>
    </div>
  </div>`;

  // floats
  for (const f of b.floats.slice(-8)) {
    // approximate positions skipped in DOM rebuild; show toast-like in log already
  }
  b.floats = [];

  app.querySelectorAll('.cell').forEach((el) => {
    el.onclick = () => onCellClick(+el.dataset.x, +el.dataset.y);
  });
  app.querySelector('#btn-wait').onclick = () => {
    if (waitUnit(b)) afterPlayerAction();
  };
  app.querySelector('#btn-skill').onclick = () => {
    if (trySkill(b)) {
      if (b.mode === 'skill') renderBattle();
      else afterPlayerAction();
    }
  };
  app.querySelector('#btn-end').onclick = () => {
    endPlayerPhase(b);
    doEnemyThenRender();
  };
  app.querySelector('#btn-flee').onclick = () => {
    showHub();
  };

  if (b.result) showBattleResult();
}

function onCellClick(x, y) {
  const b = battle;
  if (!b || b.result || b.phase !== 'player') return;
  const u = unitAt(b, x, y);

  if (b.mode === 'select' || !b.selected) {
    if (u && u.side === 'player') {
      selectUnit(b, u);
      renderBattle();
    }
    return;
  }

  if (b.mode === 'move') {
    if (u && u.id === b.selected) {
      // 原地進入行動
      tryMove(b, x, y);
      renderBattle();
      return;
    }
    if (tryMove(b, x, y)) {
      renderBattle();
      maybeSpecialPopup();
      return;
    }
    // 點其他我軍
    if (u && u.side === 'player') {
      selectUnit(b, u);
      renderBattle();
      return;
    }
    selectUnit(b, null);
    renderBattle();
    return;
  }

  if (b.mode === 'act' || b.mode === 'skill') {
    const plan = planTryAttack(b, x, y);
    if (plan) {
      showBattleCutIn(plan, () => {
        commitAttackPlan(b, plan);
        afterPlayerAction();
      });
      return;
    }
    if (u && u.side === 'player' && !u.acted) {
      selectUnit(b, u);
      renderBattle();
    }
  }
}

function maybeSpecialPopup() {
  const b = battle;
  if (b.flags.steppedVillage && !state.flags.recruitedHaiNing && b.mapDef.recruitOnVillage) {
    b.flags.steppedVillage = false;
    showModal(
      '村落相遇',
      '海寧：「……你們要去港邊？我認得山路，算我一個。」',
      [
        {
          label: '招募海寧',
          fn: () => {
            recruitHaiNing(state);
            toast('海寧加入！（下場出征）');
            saveGame(state);
          },
        },
        { label: '婉拒', fn: () => {} },
      ]
    );
  }
  if (b.flags.steppedSecret && !state.flags.foundSecretM1) {
    b.flags.steppedSecret = false;
    showModal(
      '遺跡共鳴',
      '青川觸及古老石碑……島嶼之力在胸中甦醒。功勳 +1。通關最終戰後可覺醒【青嶼守護】。',
      [
        {
          label: '收下試煉印記',
          fn: () => {
            state.flags.foundSecretM1 = true;
            const hero = state.roster.find((u) => u.hero);
            if (hero) hero.merit = Math.min(4, (hero.merit || 0) + 1);
            toast('隱藏功勳 +1★');
            saveGame(state);
          },
        },
      ]
    );
  }
  if (b.flags.steppedShop && b.mapDef.shopStock) {
    b.flags.steppedShop = false;
    showModal('殘留商鋪', '發現還能用的補給……', [
      {
        label: '買草藥 (30金)',
        fn: () => {
          const r = buyItem(state, 'herb');
          toast(r.ok ? '取得草藥' : r.reason);
          saveGame(state);
        },
      },
      { label: '離開', fn: () => {} },
    ]);
  }
}

function showModal(title, text, actions) {
  const wrap = document.createElement('div');
  wrap.className = 'modal';
  wrap.innerHTML = `<div class="sheet">
    <h3>${title}</h3>
    <p>${text}</p>
    <div class="stack" id="modal-acts"></div>
  </div>`;
  app.appendChild(wrap);
  const box = wrap.querySelector('#modal-acts');
  for (const a of actions) {
    const btn = document.createElement('button');
    btn.className = 'btn primary';
    btn.textContent = a.label;
    btn.onclick = () => {
      wrap.remove();
      a.fn();
      renderBattle();
    };
    box.appendChild(btn);
  }
}

function afterPlayerAction() {
  renderBattle();
  if (battle.result) {
    showBattleResult();
    return;
  }
  if (battle.phase === 'enemy') {
    doEnemyThenRender();
  }
}

async function doEnemyThenRender() {
  toast('敵方行動中…');
  const b = battle;
  if (!b || b.phase !== 'enemy' || b.result) return;
  // 稍微等待讓 toast 出現
  await sleep(220);
  const enemies = b.units.filter((u) => u.side === 'enemy' && u.alive);
  for (const e of enemies) {
    if (!e.alive || b.result || battle !== b) break;
    const plan = enemyPrepare(b, e);
    renderBattle();
    if (plan) {
      await new Promise((resolve) => {
        showBattleCutIn(plan, () => {
          commitAttackPlan(b, plan);
          e.acted = true;
          resolve();
        });
      });
      renderBattle();
      if (b.result) {
        showBattleResult();
        return;
      }
    }
  }
  finalizeEnemyPhase(b);
  renderBattle();
  if (b.result) showBattleResult();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function showBattleResult() {
  const b = battle;
  const win = b.result === 'win';
  syncBattleToState(state, b);
  const extras = {};
  if (b.flags.steppedSecret || state.flags.foundSecretM1) {
    // secret already applied via modal; ensure flag
  }
  if (win) {
    applyBattleRewards(state, b.mapDef, {
      unlockExclusive: !!b.mapDef.unlockExclusiveOnClear,
    });
    // 若打完第三章且找過遺跡、功勳夠
    if (b.mapDef.unlockExclusiveOnClear) {
      const hero = state.roster.find((u) => u.hero);
      if (hero && state.flags.foundSecretM1 && hero.merit >= 4) {
        hero.exclusiveReady = true;
        state.flags.exclusiveUnlocked = true;
      }
    }
  } else {
    restRoster(state);
  }
  saveGame(state);

  const sheet = document.createElement('div');
  sheet.className = 'modal';
  sheet.innerHTML = `<div class="sheet">
    <h2>${win ? '勝利！' : '戰敗…'}</h2>
    <p>${win ? `獲得 ${b.mapDef.winGold} 金、全隊功勳 +${b.mapDef.winMerit}★` : '重整旗鼓，再戰一回。'}</p>
    ${state.flags.exclusiveUnlocked ? '<p class="gold">林青川可覺醒【青嶼守護】！請至轉職頁。</p>' : ''}
    <button class="btn primary" id="btn-back">回據點</button>
  </div>`;
  app.appendChild(sheet);
  sheet.querySelector('#btn-back').onclick = () => showHub();
}


function hpPct(hp, maxHp) {
  return Math.max(0, Math.min(100, Math.round((hp / Math.max(1, maxHp)) * 100)));
}

function cutinSideHTML(snap, side) {
  const cls = CLASSES[snap.classId];
  const por = portraitFor(snap);
  const token = unitTokenHTML({ ...snap, alive: true }, 52);
  const face = por
    ? `<img class="cutin-face" src="${por}" alt="${snap.name}" />`
    : `<div class="cutin-face fallback">${token}</div>`;
  return `<div class="cutin-panel ${side}">
    <div class="cutin-portrait">${face}</div>
    <div class="cutin-id">
      <div class="cutin-name">${snap.name}</div>
      <div class="cutin-class">${cls?.name || ''}</div>
    </div>
    <div class="cutin-stats">攻 ${snap.atk}　防 ${snap.def}</div>
    <div class="cutin-hpwrap">
      <div class="cutin-hp-label">HP <span data-hp-num>${snap.hp}</span>/${snap.maxHp}</div>
      <div class="cutin-hpbar"><i data-hp-bar style="width:${hpPct(snap.hp, snap.maxHp)}%"></i></div>
    </div>
  </div>`;
}

/** 仙劍式交鋒特寫（致敬布局，原創美術） */
function showBattleCutIn(plan, onDone) {
  const existing = app.querySelector('.cutin-overlay');
  if (existing) existing.remove();

  const bg = battle ? mapBackground(battle.mapDef.id) : ART.cover;
  const ultimate = !!plan.ultimate;
  const isHeal = plan.kind === 'heal';
  const title = ultimate ? `【${plan.skillName || '必殺'}】` : (isHeal ? '治療' : '交鋒');
  const atkPor = portraitFor(plan.attacker);
  const defPor = portraitFor(plan.defender);

  const overlay = document.createElement('div');
  overlay.className = `cutin-overlay${ultimate ? ' ultimate' : ''}${isHeal ? ' heal' : ''}`;
  overlay.innerHTML = `
    <div class="cutin-dim" style="background-image:linear-gradient(180deg,#0b1a2acc,#0b1a2af2),url('${bg}')"></div>
    <div class="cutin-frame">
      <div class="cutin-banner">${title}</div>
      <div class="cutin-cols">
        ${cutinSideHTML(plan.attacker, 'left')}
        <div class="cutin-stage">
          <div class="cutin-fighter atk ${ultimate ? 'ulti' : ''}">
            ${atkPor ? `<img src="${atkPor}" alt="" />` : unitTokenHTML({ ...plan.attacker, alive: true }, 72)}
          </div>
          <div class="cutin-vs">${isHeal ? '＋' : 'VS'}</div>
          <div class="cutin-fighter def">
            ${defPor ? `<img src="${defPor}" alt="" />` : unitTokenHTML({ ...plan.defender, alive: true }, 72)}
          </div>
          <div class="cutin-flash"></div>
          <div class="cutin-pop" hidden></div>
        </div>
        ${cutinSideHTML(plan.defender, 'right')}
      </div>
      <div class="cutin-hint">點擊略過</div>
    </div>`;
  app.appendChild(overlay);

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(tHit);
    clearTimeout(tEnd);
    overlay.classList.add('out');
    setTimeout(() => {
      overlay.remove();
      onDone && onDone();
    }, 160);
  };

  const pop = overlay.querySelector('.cutin-pop');
  const flash = overlay.querySelector('.cutin-flash');
  const fighterAtk = overlay.querySelector('.cutin-fighter.atk');
  const fighterDef = overlay.querySelector('.cutin-fighter.def');
  const bars = overlay.querySelectorAll('[data-hp-bar]');
  const nums = overlay.querySelectorAll('[data-hp-num]');

  // 開場微頓 → 衝刺 → 閃光與扣血
  requestAnimationFrame(() => overlay.classList.add('in'));

  const tHit = setTimeout(() => {
    fighterAtk.classList.add('lunge');
    fighterDef.classList.add('lunge');
    flash.classList.add('boom');
    if (ultimate) overlay.classList.add('ulti-flash');

    if (isHeal) {
      pop.hidden = false;
      pop.textContent = `+${plan.healAmount}`;
      pop.className = 'cutin-pop heal';
      const newHp = Math.min(plan.defender.maxHp, plan.defender.hp + plan.healAmount);
      if (bars[1]) bars[1].style.width = hpPct(newHp, plan.defender.maxHp) + '%';
      if (nums[1]) nums[1].textContent = String(newHp);
    } else {
      pop.hidden = false;
      pop.textContent = `-${plan.dmg}`;
      pop.className = 'cutin-pop dmg';
      const defHp = Math.max(0, plan.defender.hp - plan.dmg);
      if (bars[1]) {
        bars[1].style.width = hpPct(defHp, plan.defender.maxHp) + '%';
        if (defHp / plan.defender.maxHp < 0.35) bars[1].classList.add('low');
      }
      if (nums[1]) nums[1].textContent = String(defHp);

      if (plan.counterDmg > 0) {
        setTimeout(() => {
          const atkHp = Math.max(0, plan.attacker.hp - plan.counterDmg);
          if (bars[0]) {
            bars[0].style.width = hpPct(atkHp, plan.attacker.maxHp) + '%';
            if (atkHp / plan.attacker.maxHp < 0.35) bars[0].classList.add('low');
          }
          if (nums[0]) nums[0].textContent = String(atkHp);
          pop.textContent = `反擊 -${plan.counterDmg}`;
        }, 280);
      }
    }
  }, ultimate ? 280 : 220);

  const duration = ultimate ? 1200 : 1000;
  const tEnd = setTimeout(finish, duration);

  overlay.addEventListener('click', finish);
}

// 供 playtest 匯出
export const _test = {
  get state() { return state; },
  setState(s) { state = s; },
  showHub,
  startBattle,
  getBattle: () => battle,
  setBattle: (b) => { battle = b; },
};
