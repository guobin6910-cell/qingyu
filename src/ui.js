/** 畫面與操作 */
import {
  TITLE, EMPIRE, PROLOGUE, MAPS, CLASSES, TREES, TERRAIN, ITEMS,
  TRANSFER_GOLD, getClassChildren, classesInTree, rootClass, skillLabel,
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
  computeAttackRange,
} from './battle.js';
import { ART, mapBackground, boardFor, portraitFor, unitTokenHTML, terrainPattern } from './art.js';

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
          ${s.skill ? `<div class="muted">${skillLabel(s.skill)}：${s.skill.name}</div>` : ''}
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
          const sk = c.skill
            ? ` · 解鎖${skillLabel(c.skill)}【${c.skill.name}】`
            : (c.rank >= 3 ? '' : '');
          const tip = (chk.reason || '') + (c.skill ? ` ${c.skill.desc}` : '');
          return `<button class="btn small" data-promo="${u.uid}:${c.id}" ${chk.ok ? '' : 'disabled'}
            title="${tip.replace(/"/g, '&quot;')}">→ ${c.name}${c.meritNeed ? `(${c.meritNeed}★)` : ''}${sk}</button>`;
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
      const curSkill = s.skill
        ? `<div class="skill-tag">${skillLabel(s.skill)}：【${s.skill.name}】— ${s.skill.desc}</div>`
        : `<div class="muted">晉升至 Rank3 可解鎖強力必殺</div>`;
      const pathHint = Object.values(CLASSES)
        .filter((c) => c.tree === u.tree && c.skill && c.rank >= 3)
        .map((c) => `${c.name}→【${c.skill.name}】`)
        .join('　');
      return `<div class="card ${s.tree}">
        <div class="name">${u.name} · ${s.name}</div>
        <div class="stars">${'★'.repeat(u.merit || 0)}${'☆'.repeat(4 - (u.merit || 0))}</div>
        ${curSkill}
        ${pathHint ? `<div class="muted">本系必殺路線：${pathHint}</div>` : ''}
        <div class="muted">同系晉升（選分支會鎖定另一邊；Rank2 需1★、Rank3 需2★，第一章地圖功勳足夠）：</div>
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
  const cellSize = b.w >= 8 ? 44 : 50;
  const boardW = b.w * cellSize;
  const boardH = b.h * cellSize;

  // 敵方威脅格（選中我軍時顯示）
  const dangerSet = new Set();
  if (b.phase === 'player' && !b.result) {
    for (const e of b.units.filter((u) => u.side === 'enemy' && u.alive)) {
      for (const c of computeAttackRange(b, e)) {
        dangerSet.add(`${c.x},${c.y}`);
      }
    }
  }

  let gridHtml = '';
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const ter = terrainAt(b, x, y);
      const u = unitAt(b, x, y);
      const isMove = b.moveHint.some((c) => c.x === x && c.y === y);
      const isAtk = b.attackHint.some((c) => c.x === x && c.y === y);
      const sel = u && u.id === b.selected;
      const isDanger = dangerSet.has(`${x},${y}`) && !isMove && !isAtk;
      const badge = (!u && ter && !ter.block && terrainPattern(ter.id)) ? terrainPattern(ter.id) : '';
      const cls = [
        'cell',
        `tile-${ter.id}`,
        isMove ? 'move-hint' : '',
        isAtk ? 'atk-hint' : '',
        isDanger ? 'danger-hint' : '',
        sel ? 'selected' : '',
        ter.block ? 'blocked' : '',
      ].join(' ');
      const tokSize = Math.max(36, cellSize - 4);
      gridHtml += `<div class="${cls}" data-x="${x}" data-y="${y}"
        style="width:${cellSize}px;height:${cellSize}px"
        title="${ter.name}">
        ${badge ? `<span class="tile-badge">${badge}</span>` : ''}
        ${u ? `<div class="tok" data-uid="${u.id}">${unitTokenHTML(u, tokSize)}</div>` : ''}
        ${isMove && !u ? '<span class="move-foot"></span>' : ''}
      </div>`;
    }
  }

  const selU = b.units.find((u) => u.id === b.selected);
  const phaseLabel = b.phase === 'player' ? '我軍回合' : '敵軍回合';
  const phaseClass = b.phase === 'player' ? 'phase-player' : 'phase-enemy';
  const canSkill = selU && selU.skill && !selU.skill.used && b.mode === 'act';
  const skillBtnLabel = canSkill
    ? `${skillLabel(selU.skill)}·${selU.skill.name}`
    : (selU?.skill?.used ? '已用完' : '戰技／必殺');
  const skillTip = canSkill
    ? `<div class="skill-ready">✦ 可發動${skillLabel(selU.skill)}【${selU.skill.name}】— ${selU.skill.desc}</div>`
    : '';

  const bgUrl = mapBackground(b.mapDef.id);
  const boardUrl = boardFor(b.mapDef.id);
  const selPor = selU ? portraitFor(selU) : null;
  const selCls = selU ? CLASSES[selU.classId] : null;
  const selPanel = selU ? `
    <div class="sel-panel ornate">
      <div class="sel-portrait-wrap">
        ${selPor ? `<img class="sel-portrait" src="${selPor}" alt="" />` : unitTokenHTML(selU, 56)}
        <div class="sel-lv">Lv</div>
      </div>
      <div class="sel-body">
        <div class="sel-name">${selU.name}</div>
        <div class="sel-class">${selCls?.name || ''}</div>
        <div class="sel-hpwrap">
          <span>HP</span>
          <div class="sel-bar hp"><i style="width:${Math.round(selU.hp / selU.maxHp * 100)}%"></i></div>
          <em>${selU.hp}/${selU.maxHp}</em>
        </div>
        <div class="sel-stats">
          <span>攻 ${selU.atk}</span><span>防 ${selU.def}</span>
          <span>術 ${selU.mag}</span><span>移 ${selU.move}</span>
        </div>
      </div>
    </div>` : `
    <div class="sel-panel ornate empty">
      <div class="sel-hint">點選我軍單位<br/>移動 → 攻擊／待機</div>
    </div>`;

  const party = b.units.filter((u) => u.side === 'player' && u.alive);
  const partyHtml = party.map((u) => {
    const por = portraitFor(u);
    const active = u.id === b.selected ? 'active' : '';
    const done = u.acted ? 'done' : '';
    const pct = Math.round(u.hp / u.maxHp * 100);
    return `<button type="button" class="party-chip ${active} ${done}" data-pid="${u.id}">
      ${por ? `<img src="${por}" alt="" />` : `<span class="chip-fallback">${u.name.slice(0, 1)}</span>`}
      <span class="chip-name">${u.name.slice(0, 2)}</span>
      <span class="chip-hp"><i style="width:${pct}%"></i></span>
    </button>`;
  }).join('');

  app.innerHTML = `
  <div class="screen battle-screen gorgeous eoa-board">
    <div class="battle-bg" style="background-image:url('${bgUrl}')"></div>
    <div class="battle-bg-vignette"></div>
    <div class="battle-top ornate-bar">
      <div class="turn-badge">T${b.turn}</div>
      <div class="faction-tag">青嶼義軍</div>
      <div class="turn-banner ${phaseClass}"><span>${phaseLabel}</span></div>
      <span class="gold coin-badge">${state.gold}金</span>
    </div>
    <div class="battle-mid">
      <div class="grid-wrap" style="position:relative">
        <div class="board-stage" style="width:${boardW}px;height:${boardH}px;--board:url('${boardUrl}')">
          <div class="board-art" aria-hidden="true"></div>
          <div class="grid continuous-grid" style="grid-template-columns:repeat(${b.w}, ${cellSize}px);width:${boardW}px;height:${boardH}px">
            ${gridHtml}
          </div>
        </div>
      </div>
      <div class="party-rail">${partyHtml}</div>
    </div>
    <div class="battle-bar ornate-bar">
      <div class="map-loc">—— ${b.mapDef.name} ——</div>
      ${selPanel}
      ${skillTip}
      <div class="cmd-menu">
        <button class="cmd-btn" id="btn-wait" ${selU && (b.mode === 'act' || b.mode === 'move') ? '' : 'disabled'}>待機</button>
        <button class="cmd-btn ${canSkill ? 'skill-ready-btn' : ''}" id="btn-skill" ${canSkill ? '' : 'disabled'}>${skillBtnLabel}</button>
        <button class="cmd-btn" id="btn-end" ${b.phase === 'player' && !b.result ? '' : 'disabled'}>結束回合</button>
        <button class="cmd-btn ghost" id="btn-flee">撤退</button>
      </div>
      <div class="battle-log">${b.log.slice(-4).map((l) => `<div>${l}</div>`).join('')}</div>
    </div>
  </div>`;

  b.floats = [];

  app.querySelectorAll('.cell').forEach((el) => {
    el.onclick = () => onCellClick(+el.dataset.x, +el.dataset.y);
  });
  app.querySelectorAll('.party-chip').forEach((el) => {
    el.onclick = () => {
      const u = b.units.find((x) => x.id === el.dataset.pid);
      if (u && !u.acted && b.phase === 'player' && !b.result) {
        selectUnit(b, u);
        renderBattle();
      }
    };
  });
  app.querySelector('#btn-wait').onclick = () => {
    if (waitUnit(b)) afterPlayerAction();
  };
  app.querySelector('#btn-skill').onclick = () => {
    const plan = trySkill(b);
    if (!plan) return;
    if (plan.kind === 'aim') {
      toast('選擇目標發動戰技／必殺');
      renderBattle();
      return;
    }
    playGridLunge(b.selected, null, () => {
      showBattleCutIn(plan, () => {
        commitAttackPlan(b, plan);
        afterPlayerAction();
      });
    });
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
      playGridLunge(plan.attackerId, plan.targetId, () => {
        showBattleCutIn(plan, () => {
          commitAttackPlan(b, plan);
          afterPlayerAction();
        });
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
  const promoteNudge = [];
  if (win) {
    for (const u of state.roster.filter((x) => x.recruited)) {
      const kids = getClassChildren(u.classId).filter((c) => canPromote(u, c.id).ok);
      if (kids.length) {
        const skNote = kids
          .filter((c) => c.skill)
          .map((c) => `${c.name}解鎖${skillLabel(c.skill)}【${c.skill.name}】`)
          .join('、');
        promoteNudge.push(
          `${u.name} 可晉升：${kids.map((c) => c.name).join('／')}` +
          (skNote ? `（${skNote}）` : '')
        );
      }
    }
  }
  sheet.innerHTML = `<div class="sheet">
    <h2>${win ? '勝利！' : '戰敗…'}</h2>
    <p>${win ? `獲得 ${b.mapDef.winGold} 金、全隊功勳 +${b.mapDef.winMerit}★` : '重整旗鼓，再戰一回。'}</p>
    ${promoteNudge.length ? `<p class="gold">轉職提示：${promoteNudge.join('；')}。請至「轉職」頁晉升，解鎖更強戰技／必殺。</p>` : ''}
    ${state.flags.exclusiveUnlocked ? '<p class="gold">林青川可覺醒【青嶼守護】！請至轉職頁。</p>' : ''}
    <button class="btn primary" id="btn-back">${promoteNudge.length ? '前往轉職／據點' : '回據點'}</button>
  </div>`;
  app.appendChild(sheet);
  sheet.querySelector('#btn-back').onclick = () => {
    if (promoteNudge.length) hubTab = 'class';
    showHub();
  };
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

/** 格子上短衝刺，再進入特寫 */
function playGridLunge(attackerId, targetId, then) {
  const atkEl = attackerId ? app.querySelector(`.tok[data-uid="${attackerId}"]`) : null;
  const defEl = targetId ? app.querySelector(`.tok[data-uid="${targetId}"]`) : null;
  if (atkEl) atkEl.classList.add('tok-lunge');
  if (defEl) defEl.classList.add('tok-brace');
  const wrap = app.querySelector('.grid-wrap');
  if (wrap) wrap.classList.add('grid-anticipate');
  setTimeout(() => {
    if (atkEl) atkEl.classList.remove('tok-lunge');
    if (defEl) defEl.classList.remove('tok-brace');
    if (wrap) wrap.classList.remove('grid-anticipate');
    then && then();
  }, 180);
}

/** 仙劍式交鋒特寫：接近→軌跡→衝擊震動→扣血→跳字 */
function showBattleCutIn(plan, onDone) {
  const existing = app.querySelector('.cutin-overlay');
  if (existing) existing.remove();

  const bg = battle ? mapBackground(battle.mapDef.id) : ART.cover;
  const ultimate = !!plan.ultimate;
  const isHeal = plan.kind === 'heal' || plan.kind === 'skill_heal';
  const isBuff = plan.kind === 'skill_buff';
  const isTech = plan.tier === 'tech' || (!ultimate && !!plan.skillName);
  const title = plan.skillName
    ? `【${plan.skillName}】`
    : (isHeal ? '治療' : isBuff ? '強化' : '交鋒');
  const atkPor = portraitFor(plan.attacker);
  const defPor = portraitFor(plan.defender);
  const vfxClass = isBuff ? 'buff' : isHeal ? 'heal' : ultimate ? 'ultimate' : isTech ? 'tech' : 'normal';

  const overlay = document.createElement('div');
  overlay.className = `cutin-overlay ${vfxClass}`;
  const sparkles = Array.from({ length: 14 }, (_, i) =>
    `<i class="spark" style="--i:${i};--x:${8 + (i * 6.5) % 84}%;--y:${12 + (i * 11) % 70}%;--d:${0.1 + (i % 5) * 0.08}s"></i>`
  ).join('');
  overlay.innerHTML = `
    <div class="cutin-dim" style="background-image:linear-gradient(180deg,#0b1a2acc,#0b1a2af2),url('${bg}')"></div>
    <div class="cutin-particles">${sparkles}</div>
    <div class="cutin-frame ornate-cutin">
      <div class="cutin-banner">${title}</div>
      <div class="cutin-cols">
        ${cutinSideHTML(plan.attacker, 'left')}
        <div class="cutin-stage">
          <div class="cutin-trail"></div>
          <div class="cutin-arc"></div>
          <div class="cutin-fighter atk ${ultimate ? 'ulti' : ''} ${isTech ? 'tech' : ''}">
            ${atkPor ? `<img src="${atkPor}" alt="" />` : unitTokenHTML({ ...plan.attacker, alive: true }, 72)}
          </div>
          <div class="cutin-vs">${isHeal ? '＋' : isBuff ? '◆' : 'VS'}</div>
          <div class="cutin-fighter def">
            ${defPor ? `<img src="${defPor}" alt="" />` : unitTokenHTML({ ...plan.defender, alive: true }, 72)}
          </div>
          <div class="cutin-slash"></div>
          <div class="cutin-flash"></div>
          <div class="cutin-ring"></div>
          <div class="cutin-pop" hidden></div>
        </div>
        ${cutinSideHTML(plan.defender, 'right')}
      </div>
      <div class="cutin-hint">點擊略過</div>
    </div>`;
  app.appendChild(overlay);

  let finished = false;
  const timers = [];
  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
  const finish = () => {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    overlay.classList.add('out');
    setTimeout(() => {
      overlay.remove();
      onDone && onDone();
    }, 160);
  };

  const pop = overlay.querySelector('.cutin-pop');
  const flash = overlay.querySelector('.cutin-flash');
  const slash = overlay.querySelector('.cutin-slash');
  const trail = overlay.querySelector('.cutin-trail');
  const stage = overlay.querySelector('.cutin-stage');
  const fighterAtk = overlay.querySelector('.cutin-fighter.atk');
  const fighterDef = overlay.querySelector('.cutin-fighter.def');
  const bars = overlay.querySelectorAll('[data-hp-bar]');
  const nums = overlay.querySelectorAll('[data-hp-num]');

  requestAnimationFrame(() => overlay.classList.add('in'));

  const arc = overlay.querySelector('.cutin-arc');
  const ring = overlay.querySelector('.cutin-ring');
  const leftPanel = overlay.querySelector('.cutin-panel.left');
  const rightPanel = overlay.querySelector('.cutin-panel.right');

  // 0) portrait punch-in
  later(() => {
    leftPanel?.classList.add('punch');
    rightPanel?.classList.add('punch');
    overlay.classList.add('sparks-on');
  }, 40);

  // 1) approach
  later(() => {
    fighterAtk.classList.add('approach');
    fighterDef.classList.add('approach');
    trail.classList.add('show');
  }, 80);

  // 2) slash / cast trail
  later(() => {
    fighterAtk.classList.add('lunge');
    slash.classList.add(isHeal ? 'cast-heal' : isBuff ? 'cast-buff' : ultimate ? 'slash-ulti' : 'slash-normal');
    if (arc) arc.classList.add(isHeal || isBuff ? 'arc-cast' : 'arc-slash');
  }, 320);

  // 3) impact shake + flash
  later(() => {
    fighterDef.classList.add('hit');
    flash.classList.add('boom');
    stage.classList.add('shake');
    if (ring) ring.classList.add('burst');
    if (ultimate) overlay.classList.add('ulti-flash');

    if (isBuff) {
      pop.hidden = false;
      pop.textContent = plan.skillName || '強化';
      pop.className = 'cutin-pop buff';
    } else if (isHeal) {
      const amount = plan.healAmount || (plan.healTargets && plan.healTargets[0]?.amount) || 0;
      pop.hidden = false;
      pop.textContent = `+${amount}`;
      pop.className = 'cutin-pop heal';
      const newHp = Math.min(plan.defender.maxHp, plan.defender.hp + amount);
      if (bars[1]) bars[1].style.width = hpPct(newHp, plan.defender.maxHp) + '%';
      if (nums[1]) nums[1].textContent = String(newHp);
    } else {
      pop.hidden = false;
      pop.textContent = `-${plan.dmg}`;
      pop.className = 'cutin-pop dmg';
      const defHp = Math.max(0, plan.defender.hp - plan.dmg);
      // 4) HP drain (CSS transition)
      if (bars[1]) {
        bars[1].style.width = hpPct(defHp, plan.defender.maxHp) + '%';
        if (defHp / plan.defender.maxHp < 0.35) bars[1].classList.add('low');
      }
      if (nums[1]) nums[1].textContent = String(defHp);

      if (plan.counterDmg > 0) {
        later(() => {
          const atkHp = Math.max(0, plan.attacker.hp - plan.counterDmg);
          if (bars[0]) {
            bars[0].style.width = hpPct(atkHp, plan.attacker.maxHp) + '%';
            if (atkHp / plan.attacker.maxHp < 0.35) bars[0].classList.add('low');
          }
          if (nums[0]) nums[0].textContent = String(atkHp);
          pop.textContent = `反擊 -${plan.counterDmg}`;
          fighterAtk.classList.add('hit');
        }, 320);
      }
    }
  }, 520);

  const duration = ultimate ? 1700 : isHeal || isBuff ? 1400 : 1500;
  later(finish, duration);

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
