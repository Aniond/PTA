// ════════════════════════════════════════════════════════════════
// PTA3 Roll Handler — system.js
// Implements the OFFICIAL PTA3 type chart (dice modifier system)
//
// Type rules:
//   +1 = Super-effective: add 1 die to damage
//   +2 = Extremely-effective: add 2 dice (dual-type stacking)
//   -1 = Resisted: subtract 1 die
//   -2 = Shielded: subtract 2 dice (dual-type stacking)
//   ⊘  = No effect: cannot hit regardless of target's other type
// ════════════════════════════════════════════════════════════════

// ─── OFFICIAL PTA3 TYPE CHART (from GM Screen) ────────────────────
// TYPE_CHART[attackingType][defendingType] = +1 | -1 | 0 (immunity)
// 0 means immune — overrides everything else regardless of dual type
const TYPE_CHART = {
  Bug:      { Dark:+1, Fairy:-1, Fighting:-1, Fire:-1, Flying:-1, Ghost:-1, Grass:+1, Poison:-1, Psychic:+1, Steel:-1 },
  Dark:     { Dark:-1, Fairy:-1, Fighting:-1, Ghost:+1, Psychic:+1 },
  Dragon:   { Dragon:+1, Fairy:0, Steel:-1 },
  Electric: { Dragon:-1, Electric:-1, Flying:+1, Grass:-1, Ground:0, Water:+1 },
  Fairy:    { Dark:+1, Dragon:+1, Fighting:+1, Fire:-1, Poison:-1, Steel:-1 },
  Fighting: { Bug:-1, Dark:+1, Fairy:-1, Flying:-1, Ghost:0, Ice:+1, Normal:+1, Poison:-1, Psychic:-1, Rock:+1, Steel:+1 },
  Fire:     { Bug:+1, Dragon:-1, Fire:-1, Grass:+1, Ice:+1, Rock:-1, Steel:+1, Water:-1 },
  Flying:   { Bug:+1, Electric:-1, Fighting:+1, Grass:+1, Rock:-1, Steel:-1 },
  Ghost:    { Dark:-1, Ghost:+1, Normal:0, Psychic:+1 },
  Grass:    { Bug:-1, Dragon:-1, Fire:-1, Flying:-1, Grass:-1, Ground:+1, Poison:-1, Rock:+1, Steel:-1, Water:+1 },
  Ground:   { Bug:-1, Electric:+1, Fire:+1, Flying:0, Grass:-1, Poison:+1, Rock:+1, Steel:+1 },
  Ice:      { Dragon:+1, Fire:-1, Flying:+1, Grass:+1, Ground:+1, Ice:-1, Steel:-1, Water:-1 },
  Normal:   { Ghost:0, Rock:-1, Steel:-1 },
  Poison:   { Fairy:+1, Grass:+1, Ghost:-1, Ground:-1, Poison:-1, Rock:-1, Steel:0 },
  Psychic:  { Dark:0, Fighting:+1, Psychic:-1, Steel:-1 },
  Rock:     { Bug:+1, Fighting:-1, Fire:+1, Flying:+1, Ground:-1, Ice:+1, Steel:-1 },
  Steel:    { Electric:-1, Fairy:+1, Fire:-1, Ice:+1, Rock:+1, Steel:-1, Water:-1 },
  Water:    { Dragon:-1, Fire:+1, Grass:-1, Ground:+1, Rock:+1, Water:-1 }
};

// ─── TYPE COLORS for chat output ─────────────────────────────────
const TYPE_COLORS = {
  Normal:"#a8a878", Fire:"#f08030", Water:"#6890f0", Grass:"#78c850",
  Electric:"#f8d030", Ice:"#98d8d8", Fighting:"#c03028", Poison:"#a040a0",
  Ground:"#e0c068", Flying:"#a890f0", Psychic:"#f85888", Bug:"#a8b820",
  Rock:"#b8a038", Ghost:"#705898", Dragon:"#7038f8", Dark:"#705848",
  Steel:"#b8b8d0", Fairy:"#ee99ac"
};

// ─── Calculate dice modifier total ───────────────────────────────
// Returns object: { dice: number, immune: bool, label: string }
function getTypeMatchup(attackType, defType1, defType2) {
  if (!attackType) return { dice: 0, immune: false, label: "" };

  const chart = TYPE_CHART[attackType] || {};
  const mod1 = (defType1 && chart[defType1] !== undefined) ? chart[defType1] : null;
  const mod2 = (defType2 && chart[defType2] !== undefined) ? chart[defType2] : null;

  // Immunity (0) overrides everything
  if (mod1 === 0 || mod2 === 0) {
    return { dice: 0, immune: true, label: "⊘ **No Effect!**" };
  }

  const total = (mod1 || 0) + (mod2 || 0);
  let label = "";

  if (total >= 2)       label = "🔥 **Extremely Effective!** (+" + total + " dice)";
  else if (total === 1) label = "🟠 **Super Effective!** (+1 die)";
  else if (total === 0) label = "⬜ Normal effectiveness";
  else if (total === -1) label = "🔵 **Resisted** (-1 die)";
  else                  label = "🛡️ **Shielded!** (" + total + " dice)";

  return { dice: total, immune: false, label: label };
}

// ─── STAB Bonus ──────────────────────────────────────────────────
function hasSTAB(attackType, attackerType1, attackerType2) {
  return attackType && (attackType === attackerType1 || attackType === attackerType2);
}

// ─── Parse damage dice string (e.g. "3d10") and modify dice count ─
function modifyDamageDice(diceStr, deltaDice) {
  if (!diceStr) return diceStr;
  // Match patterns like "3d10", "2d6+3", etc.
  const match = diceStr.match(/^(\d+)d(\d+)(.*)$/);
  if (!match) return diceStr;

  let numDice = parseInt(match[1], 10);
  const dieSize = match[2];
  const rest = match[3] || "";

  numDice = Math.max(0, numDice + deltaDice);
  if (numDice === 0) return "0";  // shielded to nothing
  return numDice + "d" + dieSize + rest;
}

// ─── MAIN ROLL HANDLER ───────────────────────────────────────────
function handleResult(roll, record, msg) {
  const total = roll.total;
  const metadata = (msg && msg.roll && msg.roll.metadata) || {};
  const rollType = metadata.rollType || "generic";

  if (rollType === "accuracy") {
    handleAccuracy(total, metadata);
  } else if (rollType === "damage") {
    handleDamage(total, metadata);
  } else if (rollType === "capture") {
    handleCapture(total, metadata);
  } else if (rollType === "skill") {
    handleSkill(total, metadata);
  } else if (rollType === "save") {
    handleSave(total, metadata);
  } else {
    handleGeneric(total, metadata);
  }
}

// ─── ACCURACY CHECK ──────────────────────────────────────────────
function handleAccuracy(total, metadata) {
  const moveName    = metadata.moveName    || "Move";
  const moveType    = metadata.moveType    || "";
  const actorName   = metadata.actorName   || "Pokémon";
  const damageRoll  = metadata.damageRoll  || "";
  const attackerType1 = metadata.attackerType1 || "";
  const attackerType2 = metadata.attackerType2 || "";

  let resultLabel = "";
  if (total >= 20)      resultLabel = "🎯 **Critical Hit!** (Damage dice rolled twice)";
  else if (total >= 11) resultLabel = "✅ **Hit!**";
  else if (total >= 6)  resultLabel = "⚠️ **Glancing Blow**";
  else                  resultLabel = "❌ **Miss!**";

  const typeCol = TYPE_COLORS[moveType] || "#888";
  const typeTag = moveType ? "[color=" + typeCol + "][" + moveType + "][/color]" : "";

  let out = "## " + moveName + " " + typeTag + "\n";
  out += "**" + actorName + "** uses **" + moveName + "**";

  // Check for target via getTargets()
  const targets = api.getTargets();
  let targetName = "";
  if (targets && targets.length > 0) {
    const target = targets[0];
    if (target.token && target.token.name) {
      targetName = target.token.name;
    } else if (target.record && target.record.name) {
      targetName = target.record.name;
    }
  }
  if (targetName) out += " on **" + targetName + "**";
  out += "\n**Accuracy Check:** " + total + " — " + resultLabel + "\n";

  // On miss, just post and stop
  if (total < 6) {
    api.sendMessage(out, undefined, [], []);
    return;
  }

  // On hit (or glancing) — read target's types if we have one
  if (targets && targets.length > 0 && damageRoll) {
    const target = targets[0];
    const targetToken = target.token;
    const targetRec = target.record;

    if (targetRec && targetRec.data) {
      computeMatchupAndPostDamage(out, moveName, moveType, damageRoll, actorName, targetName,
        attackerType1, attackerType2, targetRec, total >= 20);
      return;
    } else if (targetToken && targetToken._id) {
      api.getRecord("pokemon", targetToken._id, function(targetRecord) {
        if (targetRecord && targetRecord.data) {
          computeMatchupAndPostDamage(out, moveName, moveType, damageRoll, actorName, targetName,
            attackerType1, attackerType2, targetRecord, total >= 20);
        } else {
          postDamageButton(out, moveName, damageRoll, moveType, actorName, targetName, 0, false, total >= 20);
        }
      });
      return;
    }
  }

  // No target — just post with damage button, no matchup
  if (damageRoll) {
    postDamageButton(out, moveName, damageRoll, moveType, actorName, targetName, 0, false, total >= 20);
  } else {
    api.sendMessage(out, undefined, [], []);
  }
}

function computeMatchupAndPostDamage(baseMsg, moveName, moveType, damageRoll, actorName, targetName,
                                     attackerType1, attackerType2, targetRecord, isCrit) {
  const defType1 = targetRecord.data.poke_type1 || "";
  const defType2 = targetRecord.data.poke_type2 || "";
  const finalTargetName = targetName || targetRecord.name || "target";
  const matchup = getTypeMatchup(moveType, defType1, defType2);
  const stab = hasSTAB(moveType, attackerType1, attackerType2);

  let out = baseMsg;
  if (defType1) {
    out += "\n**Target types:** " + defType1 + (defType2 ? " / " + defType2 : "") + "\n";
    out += matchup.label + "\n";
  }

  if (matchup.immune) {
    out += "\n*" + moveName + " has no effect on " + finalTargetName + "!*";
    api.sendMessage(out, undefined, [], []);
    return;
  }

  // Calculate modified damage dice
  const modifiedDice = modifyDamageDice(damageRoll, matchup.dice);
  if (modifiedDice === "0") {
    out += "\n*Damage reduced to nothing by resistance!*";
    api.sendMessage(out, undefined, [], []);
    return;
  }

  if (stab) out += "✨ **STAB** (+3 damage)\n";
  if (isCrit) out += "🎯 **Critical Hit** — roll damage dice twice!\n";

  out += "\n**Damage:** " + modifiedDice;
  if (matchup.dice !== 0) out += " *(was " + damageRoll + ")*";

  // Build damage roll button
  const buttonRoll = isCrit ? doubleDice(modifiedDice) : modifiedDice;
  out += "\n\n```Roll_Damage\napi.promptRoll('" + moveName + " Damage','" + buttonRoll +
    "',[],{ rollType:'damage', moveName:'" + moveName + "', moveType:'" + moveType +
    "', actorName:'" + actorName + "', targetName:'" + finalTargetName + "', typeMod:" + matchup.dice +
    ", stab:" + stab + " },'system');\n```";
  api.sendMessage(out, undefined, [], []);
}

function doubleDice(diceStr) {
  // For crit: 3d10 -> 6d10 (double the number of dice)
  const match = diceStr.match(/^(\d+)d(\d+)(.*)$/);
  if (!match) return diceStr;
  return (parseInt(match[1], 10) * 2) + "d" + match[2] + (match[3] || "");
}

function postDamageButton(baseMsg, moveName, damageRoll, moveType, actorName, targetName, typeMod, stab, isCrit) {
  let msg = baseMsg;
  const buttonRoll = isCrit ? doubleDice(damageRoll) : damageRoll;
  msg += "\n```Roll_Damage\napi.promptRoll('" + moveName + " Damage','" + buttonRoll +
    "',[],{ rollType:'damage', moveName:'" + moveName + "', moveType:'" + moveType +
    "', actorName:'" + actorName + "', targetName:'" + targetName + "', typeMod:" + typeMod +
    ", stab:" + stab + " },'system');\n```";
  api.sendMessage(msg, undefined, [], []);
}

// ─── DAMAGE ROLL ─────────────────────────────────────────────────
function handleDamage(total, metadata) {
  const moveName   = metadata.moveName   || "Move";
  const moveType   = metadata.moveType   || "";
  const actorName  = metadata.actorName  || "Pokémon";
  const targetName = metadata.targetName || "Target";
  const stab       = metadata.stab || false;

  const typeCol = TYPE_COLORS[moveType] || "#888";
  const typeTag = moveType ? "[color=" + typeCol + "][" + moveType + "][/color]" : "";

  let finalDamage = total;
  if (stab) finalDamage += 3;

  let out = "## " + moveName + " " + typeTag + " — Damage\n";
  out += "**" + actorName + "** → **" + targetName + "**\n";
  out += "Rolled: **" + total + "**";
  if (stab) out += " + 3 (STAB) = **" + finalDamage + "**";
  else out += "\n**Final Damage: " + finalDamage + "**";

  out += "\n\n*Apply " + finalDamage + " damage to " + targetName + "*";

  // Auto-apply damage to targeted token
  const targets = api.getTargets();
  if (targets && targets.length > 0 && finalDamage > 0) {
    const target = targets[0];
    const targetToken = target.token;
    const targetRec = target.record;
    if (targetRec && targetRec.data) {
      const curHp = parseInt(targetRec.data.hp_current || 0, 10);
      const newHp = Math.max(0, curHp - finalDamage);
      api.setValuesOnRecord(targetRec, { "data.hp_current": newHp });
      out += "\n[color=#e24b4a]" + (targetRec.name || targetName) + ": " + curHp + " → " + newHp + " HP[/color]";
    } else if (targetToken && targetToken._id) {
      api.getRecord("pokemon", targetToken._id, function(rec) {
        if (rec && rec.data) {
          const curHp = parseInt(rec.data.hp_current || 0, 10);
          const newHp = Math.max(0, curHp - finalDamage);
          api.setValuesOnRecord(rec, { "data.hp_current": newHp });
          out += "\n[color=#e24b4a]" + (rec.name || targetName) + ": " + curHp + " → " + newHp + " HP[/color]";
        }
        api.sendMessage(out, undefined, [], []);
      });
      return;
    }
  }
  api.sendMessage(out, undefined, [], []);
}

// ─── CAPTURE ROLL ────────────────────────────────────────────────
function handleCapture(total, metadata) {
  const pokemonName   = metadata.pokemonName   || "Wild Pokémon";
  const captureTarget = metadata.captureTarget || 50;
  const ballName      = metadata.ballName      || "Poké Ball";

  let out = "## Capture Attempt!\n";
  out += "**" + ballName + "** thrown at **" + pokemonName + "**\n";
  out += "**Roll:** " + total + " (need ≤ " + captureTarget + ")\n\n";

  if (total <= captureTarget) {
    out += "### ✅ Caught!\n" + pokemonName + " was caught!";
  } else {
    const diff = total - captureTarget;
    out += diff <= 10
      ? "### ❌ So Close!\n" + pokemonName + " broke free! (missed by " + diff + ")"
      : "### ❌ Escaped!\n" + pokemonName + " broke free!";
  }
  api.sendMessage(out, undefined, [], []);
}

// ─── SKILL CHECK ─────────────────────────────────────────────────
function handleSkill(total, metadata) {
  const skillName = metadata.skillName || "Skill";
  const actorName = metadata.actorName || "Trainer";
  const dc = metadata.dc || 0;

  let out = "## " + skillName + " Check\n";
  out += "**" + actorName + "** rolled **" + total + "**";
  if (dc > 0) {
    out += " (DC " + dc + ")\n";
    out += total >= dc ? "\n✅ **Success!**" : "\n❌ **Failure** (missed by " + (dc - total) + ")";
  } else {
    out += "\n*(GM sets DC)*";
  }
  api.sendMessage(out, undefined, [], []);
}

// ─── SAVING THROW ────────────────────────────────────────────────
function handleSave(total, metadata) {
  const saveName   = metadata.saveName   || "Save";
  const actorName  = metadata.actorName  || "Pokémon";
  const saveTarget = metadata.saveTarget || 10;

  let out = "## " + saveName + "\n";
  out += "**" + actorName + "** rolls **" + total + "** (need ≥ " + saveTarget + ")\n\n";
  out += total >= saveTarget
    ? "✅ **Success** — affliction resisted or cured!"
    : "❌ **Failure** — affliction continues.";
  api.sendMessage(out, undefined, [], []);
}

// ─── GENERIC FALLBACK ────────────────────────────────────────────
function handleGeneric(total, metadata) {
  const rollName  = metadata.rollName  || "Roll";
  const actorName = metadata.actorName || "";
  let out = "## " + rollName + "\n";
  out += actorName ? "**" + actorName + "** rolled **" + total + "**" : "**Result:** " + total;
  api.sendMessage(out, undefined, [], []);
}
