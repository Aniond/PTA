// PTA3 Common Script
// Shared functions used across all record types and list items

// ─── TYPE COLORS ───────────────────────────────────────────────
function getTypeColor(type) {
  var colors = {
    "Normal": "#A8A878",
    "Fire": "#F08030",
    "Water": "#6890F0",
    "Grass": "#78C850",
    "Electric": "#F8D030",
    "Ice": "#98D8D8",
    "Fighting": "#C03028",
    "Poison": "#A040A0",
    "Ground": "#E0C068",
    "Flying": "#A890F0",
    "Psychic": "#F85888",
    "Bug": "#A8B820",
    "Rock": "#B8A038",
    "Ghost": "#705898",
    "Dragon": "#7038F8",
    "Dark": "#705848",
    "Steel": "#B8B8D0",
    "Fairy": "#EE99AC"
  };
  return colors[type] || "#68A090";
}

// ─── UUID GENERATOR ────────────────────────────────────────────
// Per Sean: required when building list items programmatically
function generateUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    var r = Math.floor(Math.random() * 16);
    var v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── ROLL A POKEMON MOVE ───────────────────────────────────────
// Called from the per-move 🎲 button in a pokemon_move list item.
// In list-item context:
//   data   = the full list-item record { _id, name, recordType, data: {move_type, ...} }
//   record = the parent Pokemon record
function rollPokemonMove() {
  api.sendMessage("🟢 rollPokemonMove fired (from common.js)", undefined, [], []);

  // Move data — `data` is the full record, fields live at data.data
  var moveItem = (typeof data !== "undefined" && data) ? data : {};
  var moveFields = moveItem.data || {};
  var moveName = moveItem.name || "Move";
  var moveType = moveFields.move_type || "";
  var moveCat  = moveFields.move_category || "";
  var dmgDice  = moveFields.move_damage || "";

  // Parent Pokemon (the record this list belongs to)
  var parentRec  = (typeof record !== "undefined" && record) ? record : {};
  var parentData = parentRec.data || {};
  var pkName = parentRec.name || "Pokemon";
  var t1 = parentData.poke_type1 || "";
  var t2 = parentData.poke_type2 || "";

  // Choose modifier based on move category
  var modKey = "poke_atk_mod";
  if (moveCat && moveCat.indexOf("Special") >= 0) modKey = "poke_spatk_mod";
  else if (moveCat === "Effect") modKey = "poke_effect_mod";
  var mod = parseInt(parentData[modKey] || 0, 10);
  var sign = mod >= 0 ? "+" : "";

  api.sendMessage("🟢 about to roll: 1d20" + sign + mod + " for " + moveName, undefined, [], []);

  try {
    api.roll(
      "1d20" + sign + mod,
      {
        rollType: "accuracy",
        moveName: moveName,
        moveType: moveType,
        moveCategory: moveCat,
        actorName: pkName,
        attackerType1: t1,
        attackerType2: t2,
        damageRoll: dmgDice,
        recordId: parentRec._id
      }
    );
    api.sendMessage("🟢 api.roll returned successfully", undefined, [], []);
  } catch(e) {
    api.sendMessage("⚠️ api.roll threw: " + (e && e.message ? e.message : "unknown error"), undefined, [], []);
  }
}

// ─── PARSE A PTA3 MOVE STRING ──────────────────────────────────
// Used by pokemon-main.html when auto-filling from Pokedex.
// Input format: "Flamethrower - Ranged(20ft) Fire Special Attack: 3/day 3d10. On hit, ..."
var PTA3_TYPE_NAMES = [
  "Normal","Fire","Water","Grass","Electric","Ice","Fighting","Poison",
  "Ground","Flying","Psychic","Bug","Rock","Ghost","Dragon","Dark","Steel","Fairy"
];

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
      if (/[\s\(\)]/.test(before) && /[\s\(\)]/.test(after)) {
        type = pattern;
        break;
      }
    }
  }

  var range = "";
  if (type) {
    var typeIdx = header.indexOf(type);
    range = header.substring(0, typeIdx).trim();
  } else {
    range = header.split(" ")[0];
  }

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

// ─── PARSE MODIFIER STRING ─────────────────────────────────────
// Handles "+3" / "-2" / "" → returns integer
function parsePokemonModifier(raw) {
  if (!raw) return 0;
  var str = String(raw).trim();
  if (str === "") return 0;
  if (str.charAt(0) === "+") str = str.substring(1);
  var n = parseInt(str, 10);
  return isNaN(n) ? 0 : n;
}
