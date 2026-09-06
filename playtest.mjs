/** Headless playtest：清關地圖1、功勳與存檔、轉職與隱藏 */
import { SAVE_KEY, MAPS, CLASSES, TRANSFER_GOLD, RECRUIT_CANDIDATE, TERRAIN } from "./src/data.js";
import {
  newGame, saveGame, loadGame, grantMerit, promote, canPromote,
  transferTree, applyBattleRewards, recruitHaiNing, restRoster,
} from "./src/state.js";
import { createBattle, autoPlayBattle, syncBattleToState } from "./src/battle.js";

const mem = {};
const storage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; },
};

const fails = [];
function check(cond, msg) {
  if (!cond) {
    fails.push(msg);
    console.error("✗", msg);
  } else {
    console.log("✓", msg);
  }
}

const state = newGame();
saveGame(state, storage);
check(storage.getItem(SAVE_KEY), "fresh save written to qingyu-v1");
check(!storage.getItem("zhufeng-v1"), "does not touch zhufeng save key");

check(state.roster.length === 3, "starter squad 3");
check(state.roster[0].name === "林青川" && state.roster[0].hero, "protagonist 林青川");
check(MAPS.length >= 3, "≥3 maps");
check(MAPS[0].id === "m1_tutorial", "map1 tutorial");
check(MAPS[1].id.includes("pass"), "map2 mountain pass");
check(MAPS[2].id.includes("harbor"), "map3 harbor");

const map1 = MAPS[0];
const battle = createBattle(state, map1);
battle.flags.steppedSecret = true;
battle.flags.steppedVillage = true;
const result = autoPlayBattle(battle, 50);
check(result === "win", `map1 auto-clear (got ${result})`);
check(battle.turn <= 50, `map1 finished in ${battle.turn} turns`);

syncBattleToState(state, battle);
state.flags.foundSecretM1 = true;
const hero = state.roster.find((u) => u.hero);
const meritBefore = hero.merit;
recruitHaiNing(state);
check(state.flags.recruitedHaiNing, "recruited 海寧 from village");
check(state.roster.some((u) => u.uid === RECRUIT_CANDIDATE.uid), "海寧 in roster");

applyBattleRewards(state, map1, { secretMerit: map1.secretMerit || 1 });
check(hero.merit > meritBefore, `hero merit increased (${meritBefore}→${hero.merit})`);
check(state.cleared.includes("m1_tutorial"), "map1 marked cleared");
check(state.gold >= 80, "gold rewarded");

saveGame(state, storage);
const loaded = loadGame(storage);
check(loaded && loaded.cleared.includes("m1_tutorial"), "save persists map1 clear");
check(loaded.roster[0].merit === hero.merit, "save persists merit");

grantMerit(hero, 2);
const r1 = promote(hero, "tie_dun");
check(r1.ok, "promote 島衛→鐵盾");
const rBad = canPromote(hero, "po_zhen");
check(!rBad.ok, "sibling branch 破陣槍 locked after 鐵盾");

state.gold = Math.max(state.gold, TRANSFER_GOLD);
const tr = transferTree(state, hero, "magic");
check(tr.ok, "transfer to 術法治療");
check(hero.tree === "magic", "tree is magic");
state.gold += TRANSFER_GOLD;
const tr2 = transferTree(state, hero, "melee");
check(tr2.ok && hero.classId === "tie_dun", "transfer back to melee top 鐵盾");

hero.merit = 4;
hero.exclusiveReady = true;
promote(hero, "cheng_jiang");
const r4 = canPromote(hero, "qing_shou");
check(r4.ok, "hero can promote to exclusive Rank-4 青嶼守護");
const r4do = promote(hero, "qing_shou");
check(r4do.ok && hero.classId === "qing_shou", "promoted to 青嶼守護");

check(TERRAIN.hill.move === 2 && TERRAIN.hill.def === 2, "hill terrain cost+def");
check(TERRAIN.forest.move === 2, "forest move cost");
check(TERRAIN.wall.block || TERRAIN.wall.move >= 99, "wall blocks");

restRoster(state);
const b2 = createBattle(state, MAPS[1]);
const r2 = autoPlayBattle(b2, 60);
check(r2 === "win" || r2 === "lose", `map2 resolved (${r2})`);
if (r2 === "win") {
  applyBattleRewards(state, MAPS[1]);
  check(state.cleared.includes(MAPS[1].id), "map2 cleared");
}

saveGame(state, storage);
check(!!storage.getItem(SAVE_KEY), "final save ok");

console.log("\n—— summary ——");
console.log("cleared:", state.cleared);
console.log("gold:", state.gold);
console.log("hero:", hero.name, CLASSES[hero.classId].name, "merit", hero.merit);
console.log("roster:", state.roster.map((u) => u.name).join(", "));

if (fails.length) {
  console.error("\nFAILED", fails.length, fails);
  process.exit(1);
}
console.log("\nAll playtests passed.");
