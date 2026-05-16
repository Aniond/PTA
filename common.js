// PTA3 Common Script
// Shared functions used across all record types and list items

// ─── TYPE COLORS ───────────────────────────────────────────────
function getTypeColor(type) {
  var colors = {
    "Normal": "#A8A878", "Fire": "#F08030", "Water": "#6890F0",
    "Grass": "#78C850", "Electric": "#F8D030", "Ice": "#98D8D8",
    "Fighting": "#C03028", "Poison": "#A040A0", "Ground": "#E0C068",
    "Flying": "#A890F0", "Psychic": "#F85888", "Bug": "#A8B820",
    "Rock": "#B8A038", "Ghost": "#705898", "Dragon": "#7038F8",
    "Dark": "#705848", "Steel": "#B8B8D0", "Fairy": "#EE99AC"
  };
  return colors[type] || "#68A090";
}

// ─── UUID GENERATOR ────────────────────────────────────────────
function generateUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    var r = Math.floor(Math.random() * 16);
    var v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── TYPE NAMES ────────────────────────────────────────────────
var PTA3_TYPE_NAMES = [
  "Normal","Fire","Water","Grass","Electric","Ice","Fighting","Poison",
  "Ground","Flying","Psychic","Bug","Rock","Ghost","Dragon","Dark","Steel","Fairy"
];

// ─── PARSE A PTA3 MOVE STRING ──────────────────────────────────
function parsePokemonMove(raw) {
  var dashIdx = raw.indexOf(" - ");
  if (dashIdx < 0) return null;
  var name = raw.substring(0, dashIdx).trim();
  var rest = raw.substring(dashIdx + 3).trim();
  var colonIdx = rest.indexOf(":");
  if (colonIdx < 0) return null;
  var header = rest.substring(0, colonIdx).trim();
  var body = rest.substring(colonIdx + 1).trim();

  var category = "";
  if (header.indexOf("Special Attack") >= 0) category = "Special Attack";
  else if (header.indexOf("Attack") >= 0) category = "Attack";
  else if (header.indexOf("Effect") >= 0) category = "Effect";
  else if (header.indexOf("Field") >= 0) category = "Effect";

  var type = "";
  for (var i = 0; i < PTA3_TYPE_NAMES.length; i++) {
    var pattern = PTA3_TYPE_NAMES[i];
    var pos = header.indexOf(pattern);
    if (pos >= 0) {
      var before = pos === 0 ? " " : header.charAt(pos - 1);
      var after = (pos + pattern.length >= header.length) ? " " : header.charAt(pos + pattern.length);
      if (/[\s\(\)]/.test(before) && /[\s\(\)]/.test(after)) { type = pattern; break; }
    }
  }

  var range = "";
  if (type) range = header.substring(0, header.indexOf(type)).trim();
  else range = header.split(" ")[0];

  var uses = "", damage = "", effect = "";
  var usesMatch = body.match(/^(At-Will|\d+\/day|Once)/i);
  if (usesMatch) {
    uses = usesMatch[1];
    var afterUses = body.substring(usesMatch[0].length).trim();
    var dmgMatch = afterUses.match(/^(\d+d\d+(?:\s*\+\s*\d+)?)/);
    if (dmgMatch) {
      damage = dmgMatch[1];
      effect = afterUses.substring(dmgMatch[0].length).replace(/^\.\s*/, "").trim();
    } else {
      effect = afterUses.replace(/^\.\s*/, "").trim();
    }
  } else {
    effect = body;
  }
  return { name: name, type: type, category: category, range: range, uses: uses, damage: damage, effect: effect };
}

function parsePokemonModifier(raw) {
  if (!raw) return 0;
  var str = String(raw).trim();
  if (str === "") return 0;
  if (str.charAt(0) === "+") str = str.substring(1);
  var n = parseInt(str, 10);
  return isNaN(n) ? 0 : n;
}

// ═══════════════════════════════════════════════════════════════
// PTA3 TYPE CHART — DICE MODIFIERS, NOT MULTIPLIERS
// ═══════════════════════════════════════════════════════════════
var PTA3_TYPE_CHART = {
  "Bug":      { "Dark":+1, "Fairy":-1, "Fighting":-1, "Fire":-1, "Flying":-1, "Ghost":-1, "Grass":+1, "Poison":-1, "Psychic":+1, "Steel":-1 },
  "Dark":     { "Dark":-1, "Fairy":-1, "Fighting":-1, "Ghost":+1, "Psychic":+1 },
  "Dragon":   { "Dragon":+1, "Fairy":"IMMUNE", "Steel":-1 },
  "Electric": { "Dragon":-1, "Electric":-1, "Flying":+1, "Ground":"IMMUNE", "Grass":-1, "Water":+1 },
  "Fairy":    { "Dark":+1, "Dragon":+1, "Fighting":+1, "Fire":-1, "Poison":-1, "Steel":-1 },
  "Fighting": { "Bug":-1, "Dark":+1, "Fairy":-1, "Flying":-1, "Ghost":"IMMUNE", "Ice":+1, "Normal":+1, "Poison":-1, "Psychic":-1, "Rock":+1, "Steel":+1 },
  "Fire":     { "Bug":+1, "Dragon":-1, "Fire":-1, "Grass":+1, "Ice":+1, "Rock":-1, "Steel":+1, "Water":-1 },
  "Flying":   { "Bug":+1, "Electric":-1, "Fighting":+1, "Grass":+1, "Rock":-1, "Steel":-1 },
  "Ghost":    { "Dark":-1, "Ghost":+1, "Normal":"IMMUNE", "Psychic":+1 },
  "Grass":    { "Bug":-1, "Dragon":-1, "Fire":-1, "Flying":-1, "Grass":-1, "Ground":+1, "Poison":-1, "Rock":+1, "Steel":-1, "Water":+1 },
  "Ground":   { "Bug":-1, "Electric":+1, "Fire":+1, "Flying":"IMMUNE", "Grass":-1, "Poison":+1, "Rock":+1, "Steel":+1 },
  "Ice":      { "Dragon":+1, "Fire":-1, "Flying":+1, "Grass":+1, "Ground":+1, "Ice":-1, "Steel":-1, "Water":-1 },
  "Normal":   { "Ghost":"IMMUNE", "Rock":-1, "Steel":-1 },
  "Poison":   { "Fairy":+1, "Grass":+1, "Ground":-1, "Poison":-1, "Rock":-1, "Steel":"IMMUNE" },
  "Psychic":  { "Dark":"IMMUNE", "Fighting":+1, "Poison":+1, "Psychic":-1, "Steel":-1 },
  "Rock":     { "Bug":+1, "Fighting":-1, "Fire":+1, "Flying":+1, "Ground":-1, "Ice":+1, "Steel":-1 },
  "Steel":    { "Electric":-1, "Fairy":+1, "Fire":-1, "Ice":+1, "Rock":+1, "Steel":-1, "Water":-1 },
  "Water":    { "Dragon":-1, "Fire":+1, "Grass":-1, "Ground":+1, "Rock":+1, "Water":-1 }
};

function getTypeMatchup(attackType, defType1, defType2) {
  if (!attackType) return 0;
  var row = PTA3_TYPE_CHART[attackType];
  if (!row) return 0;
  function getMod(defType) {
    if (!defType) return 0;
    var v = row[defType];
    if (v === undefined) return 0;
    return v;
  }
  var m1 = getMod(defType1);
  var m2 = getMod(defType2);
  if (m1 === "IMMUNE" || m2 === "IMMUNE") return "IMMUNE";
  return m1 + m2;
}

function describeMatchup(mod) {
  if (mod === "IMMUNE") return "⊘ **No Effect!**";
  if (mod >= 2)  return "🔴 **Extremely Effective!** (+2 dice)";
  if (mod === 1) return "🟠 **Super Effective!** (+1 die)";
  if (mod <= -2) return "🔵 **Shielded** (-2 dice)";
  if (mod === -1) return "🔵 **Resisted** (-1 die)";
  return "⬜ Normal";
}

function modifyDamageDice(dmgStr, mod) {
  if (!dmgStr) return dmgStr;
  var match = dmgStr.match(/^(\d+)d(\d+)(.*)$/);
  if (!match) return dmgStr;
  var count = parseInt(match[1], 10) + mod;
  if (count < 1) count = 1;
  return count + "d" + match[2] + match[3];
}

function hasSTAB(moveType, t1, t2) {
  if (!moveType) return false;
  return moveType === t1 || moveType === t2;
}
