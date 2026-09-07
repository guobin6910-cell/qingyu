/** 青嶼戰記 — 遊戲資料（原創 IP） */

export const SAVE_KEY = 'qingyu-v1';
export const TITLE = '青嶼戰記';
export const EMPIRE = '青嶼帝國';

/** 地形：移動消耗 + 防禦加成 */
export const TERRAIN = {
  plain:  { id: 'plain',  name: '平原', move: 1, def: 0, color: '#6b8f5a', emoji: '·' },
  hill:   { id: 'hill',   name: '山地', move: 2, def: 2, color: '#8a7355', emoji: '▲' },
  forest: { id: 'forest', name: '森林', move: 2, def: 1, color: '#2d5a3d', emoji: '♣' },
  wall:   { id: 'wall',   name: '城牆', move: 99, def: 3, color: '#5a5a5a', emoji: '█', block: true },
  ford:   { id: 'ford',   name: '淺灘', move: 2, def: 0, color: '#4a7a9a', emoji: '≈' },
  village:{ id: 'village',name: '村落', move: 1, def: 1, color: '#c4a35a', emoji: '⌂', special: 'village' },
  shop:   { id: 'shop',   name: '商鋪', move: 1, def: 0, color: '#d4b06a', emoji: '店', special: 'shop' },
  secret: { id: 'secret', name: '遺跡', move: 1, def: 1, color: '#6a4a8a', emoji: '※', special: 'secret' },
  harbor: { id: 'harbor', name: '碼頭', move: 1, def: 0, color: '#3a6a8a', emoji: '⚓' },
};

/** 三大職階樹 */
export const TREES = {
  melee: {
    id: 'melee',
    name: '近戰防禦',
    color: '#4a8fd4',
    short: '近',
    counter: 'ranged', // 克制遠射
    weak: 'magic',
  },
  magic: {
    id: 'magic',
    name: '術法治療',
    color: '#4ec99a',
    short: '術',
    counter: 'melee',
    weak: 'ranged',
  },
  ranged: {
    id: 'ranged',
    name: '遠射突擊',
    color: '#e09a3a',
    short: '遠',
    counter: 'magic',
    weak: 'melee',
  },
};

/**
 * 職階：rank 1→4
 * branch: 同階互斥分支鍵（選一邊鎖另一邊）
 * parent: 前置職階 id
 * meritNeed: 解鎖所需功勳星
 * exclusive: 僅特定英雄
 * skill: 戰技（rank1）或必殺（rank3+）；tier tech|ulti
 */
export const CLASSES = {
  // —— 近戰 ——
  dao_wei: {
    id: 'dao_wei', tree: 'melee', rank: 1, name: '島衛',
    move: 3, range: 1, hp: 38, atk: 9, def: 6, mag: 2, res: 3,
    skill: { id: 'zhan_ji_guard', name: '穩守一擊', type: 'attack', power: 1.25, tier: 'tech',
      desc: '凝聚一擊，造成 125% 傷害。（每場一次・戰技）' },
    desc: '青嶼沿岸的基礎衛士。',
  },
  tie_dun: {
    id: 'tie_dun', tree: 'melee', rank: 2, name: '鐵盾',
    branch: 'melee_r2', parent: 'dao_wei', meritNeed: 1,
    move: 3, range: 1, hp: 42, atk: 9, def: 9, mag: 2, res: 5,
    desc: '厚盾穩守，擅長擋線。',
  },
  po_zhen: {
    id: 'po_zhen', tree: 'melee', rank: 2, name: '破陣槍',
    branch: 'melee_r2', parent: 'dao_wei', meritNeed: 1,
    move: 4, range: 1, hp: 36, atk: 12, def: 6, mag: 2, res: 3,
    desc: '長槍突擊，撕開敵陣。',
  },
  cheng_jiang: {
    id: 'cheng_jiang', tree: 'melee', rank: 3, name: '城壁將',
    branch: 'melee_r3a', parent: 'tie_dun', meritNeed: 2,
    move: 3, range: 1, hp: 55, atk: 11, def: 14, mag: 3, res: 7,
    skill: { id: 'bi_sha_guard', name: '壁立千仞', type: 'buff', power: 0, tier: 'ulti', desc: '本回合自身防禦+8，並反擊傷害+50%。' },
    desc: '如城牆般不可撼動。',
  },
  lie_jia: {
    id: 'lie_jia', tree: 'melee', rank: 3, name: '裂甲騎士',
    branch: 'melee_r3b', parent: 'po_zhen', meritNeed: 2,
    move: 4, range: 1, hp: 48, atk: 16, def: 8, mag: 3, res: 4,
    skill: { id: 'bi_sha_break', name: '裂甲一擊', type: 'attack', power: 1.6, tier: 'ulti', desc: '對單體造成 160% 傷害，無視 半數防禦。' },
    desc: '一槍洞穿甲胄。',
  },
  qing_shou: {
    id: 'qing_shou', tree: 'melee', rank: 4, name: '青嶼守護',
    parent: 'cheng_jiang', meritNeed: 4, exclusive: 'lin_qingchuan',
    altParents: ['lie_jia'],
    move: 4, range: 1, hp: 70, atk: 15, def: 16, mag: 4, res: 8,
    skill: { id: 'bi_sha_isle', name: '青嶼之心', type: 'attack', power: 1.8, tier: 'ulti', desc: '島嶼之力：高傷並回復自身 20% HP。' },
    desc: '守護整座青嶼的傳說職階。',
  },

  // —— 術法 ——
  chao_tu: {
    id: 'chao_tu', tree: 'magic', rank: 1, name: '潮語徒',
    move: 3, range: 2, hp: 28, atk: 3, def: 3, mag: 10, res: 6,
    heal: true,
    skill: { id: 'zhan_ji_tide', name: '微潮癒', type: 'heal', power: 1.2, tier: 'tech',
      desc: '回復周圍友軍少量 HP。（每場一次・戰技）' },
    desc: '聆聽潮聲的初學者。',
  },
  yu_quan: {
    id: 'yu_quan', tree: 'magic', rank: 2, name: '癒泉師',
    branch: 'magic_r2', parent: 'chao_tu', meritNeed: 1,
    move: 3, range: 2, hp: 30, atk: 3, def: 3, mag: 11, res: 8,
    heal: true,
    desc: '泉水般溫柔的治療。',
  },
  wu_zhou: {
    id: 'wu_zhou', tree: 'magic', rank: 2, name: '霧咒士',
    branch: 'magic_r2', parent: 'chao_tu', meritNeed: 1,
    move: 3, range: 2, hp: 28, atk: 4, def: 2, mag: 13, res: 7,
    desc: '以海霧編織咒術。',
  },
  sheng_chao: {
    id: 'sheng_chao', tree: 'magic', rank: 3, name: '聖潮祭司',
    branch: 'magic_r3a', parent: 'yu_quan', meritNeed: 2,
    move: 3, range: 2, hp: 38, atk: 4, def: 4, mag: 14, res: 11,
    heal: true,
    skill: { id: 'bi_sha_tide', name: '潮湧癒合', type: 'heal', power: 1.5, aoe: true, tier: 'ulti', desc: '回復周圍友軍大量 HP。' },
    desc: '潮汐聖力護佑同伴。',
  },
  lan_fa: {
    id: 'lan_fa', tree: 'magic', rank: 3, name: '嵐法師',
    branch: 'magic_r3b', parent: 'wu_zhou', meritNeed: 2,
    move: 3, range: 2, hp: 34, atk: 5, def: 3, mag: 17, res: 9,
    skill: { id: 'bi_sha_storm', name: '嵐擊', type: 'attack', power: 1.7, tier: 'ulti', desc: '魔法暴擊，對單體造成高額術傷。' },
    desc: '召喚島嶼風暴。',
  },

  // —— 遠射 ——
  gang_lie: {
    id: 'gang_lie', tree: 'ranged', rank: 1, name: '港獵手',
    move: 3, range: 2, hp: 30, atk: 10, def: 3, mag: 2, res: 3,
    skill: { id: 'zhan_ji_shot', name: '迅羽', type: 'attack', power: 1.3, tier: 'tech',
      desc: '迅捷一箭，造成 130% 傷害。（每場一次・戰技）' },
    desc: '港邊長大的弓手。',
  },
  ji_yu: {
    id: 'ji_yu', tree: 'ranged', rank: 2, name: '疾羽弓',
    branch: 'ranged_r2', parent: 'gang_lie', meritNeed: 1,
    move: 4, range: 2, hp: 30, atk: 12, def: 3, mag: 2, res: 4,
    desc: '輕盈迅捷，風一般移動。',
  },
  chuan_yun: {
    id: 'chuan_yun', tree: 'ranged', rank: 2, name: '穿雲弩',
    branch: 'ranged_r2', parent: 'gang_lie', meritNeed: 1,
    move: 3, range: 3, hp: 32, atk: 13, def: 4, mag: 2, res: 3,
    desc: '重弩遠程，貫穿雲層。',
  },
  ju_feng: {
    id: 'ju_feng', tree: 'ranged', rank: 3, name: '颶風射手',
    branch: 'ranged_r3a', parent: 'ji_yu', meritNeed: 2,
    move: 4, range: 2, hp: 38, atk: 15, def: 4, mag: 3, res: 5,
    skill: { id: 'bi_sha_gale', name: '颶羽連射', type: 'attack', power: 1.4, aoe: true, tier: 'ulti', desc: '對相鄰最多 3 名敵人連射。' },
    desc: '羽箭如颶風席捲。',
  },
  po_lang: {
    id: 'po_lang', tree: 'ranged', rank: 3, name: '破浪遊俠',
    branch: 'ranged_r3b', parent: 'chuan_yun', meritNeed: 2,
    move: 3, range: 3, hp: 40, atk: 16, def: 5, mag: 2, res: 4,
    skill: { id: 'bi_sha_wave', name: '破浪穿心', type: 'attack', power: 1.75, tier: 'ulti', desc: '超遠單點必殺。' },
    desc: '專打海上要害。',
  },
};

/** 商店道具 */
export const ITEMS = {
  herb:   { id: 'herb',   name: '草藥', price: 30, effect: 'heal30', desc: '回復 30 HP' },
  tonic:  { id: 'tonic',  name: '潮泉劑', price: 80, effect: 'heal60', desc: '回復 60 HP' },
  smoke:  { id: 'smoke',  name: '迷霧彈', price: 50, effect: 'escape', desc: '戰鬥中脫離（未實裝）' },
};

/** 預設角色模板 */
export function makeUnit(def) {
  const cls = CLASSES[def.classId];
  return {
    uid: def.uid,
    name: def.name,
    classId: def.classId,
    tree: cls.tree,
    hero: !!def.hero,
    merit: def.merit || 0,
    goldSpent: 0,
    lockedBranches: {}, // branchKey -> chosen classId
    unlockedTrees: { [cls.tree]: true },
    treeTops: { [cls.tree]: def.classId }, // each tree's highest unlocked class
    hp: cls.hp,
    maxHp: cls.hp,
    items: def.items || [],
    alive: true,
    recruited: def.recruited !== false,
    exclusiveReady: !!def.exclusiveReady,
  };
}

export const STARTER_ROSTER = () => [
  makeUnit({ uid: 'lin_qingchuan', name: '林青川', classId: 'dao_wei', hero: true }),
  makeUnit({ uid: 'su_wanqing', name: '蘇晚晴', classId: 'chao_tu' }),
  makeUnit({ uid: 'fang_shuo', name: '方朔', classId: 'gang_lie' }),
];

/** 可招募：隱藏村遇 */
export const RECRUIT_CANDIDATE = {
  uid: 'hai_ning',
  name: '海寧',
  classId: 'gang_lie',
  dialogue: '……你們要去港邊？我認得山路，算我一個。',
};

/**
 * 地圖定義（六角 odd-r）
 * grid: 字串列，字元對應地形；每列為 hex row
 * P=plain H=hill F=forest W=wall S=ford V=village $=shop *=secret B=harbor
 */
const TMAP = {
  P: 'plain', H: 'hill', F: 'forest', W: 'wall', S: 'ford',
  V: 'village', $: 'shop', '*': 'secret', B: 'harbor',
};

export function parseGrid(rows) {
  return rows.map((row) => [...row].map((ch) => TMAP[ch] || 'plain'));
}

/** 六角盤（odd-r）：同一敘事節拍——村／山／港 */
export const MAPS = [
  {
    id: 'm1_tutorial',
    name: '村外草徑',
    chapter: 1,
    index: 0,
    brief: '蘇家村外——先熟悉六角步法與攻擊。村落裡也許有人願意同行。',
    objective: '擊破全部敵人',
    hiddenHint: '踏上村落格可招募同伴；遺跡格藏有功勳。',
    hex: true,
    grid: parseGrid([
      'PPPPPPP',
      'PFVPPHP',
      'PFFPPPP',
      'PPPPFPP',
      'PHPPPFP',
      'PPP*PPP',
      'PPPPPPP',
      'PPPPPPP',
    ]),
    playerStarts: [[1, 6], [2, 6], [3, 6]],
    enemies: [
      { name: '流寇', classId: 'dao_wei', pos: [5, 2], ai: 'aggro', hpMul: 0.7 },
      { name: '流寇弓', classId: 'gang_lie', pos: [5, 3], ai: 'hold', hpMul: 0.65 },
      { name: '流寇', classId: 'dao_wei', pos: [4, 1], ai: 'hold', hpMul: 0.7 },
    ],
    winGold: 80,
    winMerit: 1,
    secretMerit: 1,
    recruitOnVillage: true,
  },
  {
    id: 'm2_pass',
    name: '翠嶺隘口',
    chapter: 1,
    index: 1,
    brief: '山路狹窄，善用山地防禦。隘口另一側有商鋪殘跡。',
    objective: '擊破全部敵人',
    hex: true,
    grid: parseGrid([
      'WHHHHWW',
      'WPHHHWW',
      'WPFF$HW',
      'WPPFHFW',
      'WPPPPHW',
      'WHFPPPW',
      'WHHPPPW',
      'WWWWWWW',
    ]),
    playerStarts: [[2, 6], [3, 6], [4, 6], [1, 5]],
    enemies: [
      { name: '山賊槍', classId: 'po_zhen', pos: [3, 2], ai: 'aggro' },
      { name: '山賊弓', classId: 'ji_yu', pos: [4, 2], ai: 'hold' },
      { name: '山賊', classId: 'tie_dun', pos: [2, 3], ai: 'aggro' },
      { name: '山賊咒', classId: 'wu_zhou', pos: [3, 1], ai: 'hold' },
    ],
    winGold: 120,
    winMerit: 1,
    shopStock: ['herb', 'tonic'],
  },
  {
    id: 'm3_harbor',
    name: '青港碼頭',
    chapter: 1,
    index: 2,
    brief: '奪回碼頭。若林青川已達功勳巅峰並完成遺跡試煉，或可覺醒守護之力。',
    objective: '擊破敵將',
    bossKill: true,
    hex: true,
    grid: parseGrid([
      'BBBSSPP',
      'BPPSSPP',
      'BPPPPFP',
      'PPHPPFP',
      'PPHPPPP',
      'PPPPFPP',
      'PFPPPSP',
      'PPPPPSP',
    ]),
    playerStarts: [[1, 7], [2, 7], [3, 7], [4, 7]],
    enemies: [
      { name: '港匪', classId: 'po_zhen', pos: [2, 3], ai: 'aggro' },
      { name: '港匪弓', classId: 'chuan_yun', pos: [5, 2], ai: 'hold' },
      { name: '港匪術', classId: 'lan_fa', pos: [5, 1], ai: 'hold' },
      { name: '匪首阿魁', classId: 'lie_jia', pos: [3, 1], ai: 'aggro', boss: true, hpMul: 1.4 },
    ],
    winGold: 200,
    winMerit: 2,
    unlockExclusiveOnClear: true,
  },
];

export const PROLOGUE = [
  { speaker: '旁白', text: '青嶼帝國——四面環海，山脈縱貫，港灣星羅。' },
  { speaker: '旁白', text: '島嶼並非世外桃源。流寇據山，匪船擾港，邊村告急。' },
  { speaker: '林青川', text: '晚晴、方朔，帝國軍令到了。我們去守住翠嶺到青港這條線。' },
  { speaker: '蘇晚晴', text: '草藥備好了。你們可別逞強啊。' },
  { speaker: '方朔', text: '哈哈，有我的箭在，誰敢靠近？走吧，青川。' },
  { speaker: '旁白', text: '第一章　潮起村外' },
];

export const TRANSFER_GOLD = 100; // 轉職樹消耗

/** 依職階樹取得可升路徑 */
export function getClassChildren(classId) {
  return Object.values(CLASSES).filter(
    (c) => c.parent === classId || (c.altParents && c.altParents.includes(classId))
  );
}

export function classesInTree(treeId) {
  return Object.values(CLASSES).filter((c) => c.tree === treeId);
}

export function rootClass(treeId) {
  return Object.values(CLASSES).find((c) => c.tree === treeId && c.rank === 1);
}

/** 戰技 / 必殺 顯示名 */
export function skillLabel(skill) {
  if (!skill) return '';
  return skill.tier === 'tech' ? '戰技' : '必殺';
}
