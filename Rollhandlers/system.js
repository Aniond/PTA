// ═══════════════════════════════════════════════════════════════
// PTA3 Roll Handler — system.js
// Handles: accuracy checks, damage, capture, skill checks, saves
// Cross-sheet: reads target Pokemon type and calculates weakness
// ═══════════════════════════════════════════════════════════════

// ─── FULL PTA3 TYPE CHART ────────────────────────────────────────
// Values: 2 = super effective, 0.5 = not very effective, 0 = immune, 1 = normal
// Format: TYPE_CHART[attackingType][defendingType] = multiplier
const TYPE_CHART = {
  Normal:   { Rock:0.5, Ghost:0, Steel:0.5 },
  Fire:     { Fire:0.5, Water:0.5, Grass:2, Ice:2, Bug:2, Rock:0.5, Dragon:0.5, Steel:2 },
  Water:    { Fire:2, Water:0.5, Grass:0.5, Ground:2, Rock:2, Dragon:0.5 },
  Grass:    { Fire:0.5, Water:2, Grass:0.5, Poison:0.5, Ground:2, Flying:0.5, Bug:0.5, Rock:2, Dragon:0.5, Steel:0.5 },
  Electric: { Water:2, Grass:0.5, Electric:0.5, Ground:0, Flying:2, Dragon:0.5 },
  Ice:      { Fire:0.5, Water:0.5, Grass:2, Ice:0.5, Ground:2, Flying:2, Dragon:2, Steel:0.5 },
  Fighting: { Normal:2, Ice:2, Poison:0.5, Flying:0.5, Psychic:0.5, Bug:0.5, Rock:2, Ghost:0, Dark:2, Steel:2, Fairy:0.5 },
  Poison:   { Grass:2, Poison:0.5, Ground:0.5, Rock:0.5, Ghost:0.5, Steel:0, Fairy:2 },
  Ground:   { Fire:2, Grass:0.5, Poison:2, Flying:0, Bug:0.5, Rock:2, Steel:2, Electric:2 },
  Flying:   { Grass:2, Electric:0.5, Fighting:2, Bug:2, Rock:0.5, Steel:0.5 },
  Psychic:  { Fighting:2, Poison:2, Psychic:0.5, Dark:0, Steel:0.5 },
  Bug:      { Fire:0.5, Grass:2, Fighting:0.5, Flying:0.5, Psychic:2, Ghost:0.5, Dark:2, Steel:0.5, Fairy:0.5 },
  Rock:     { Fire:2, Ice:2, Fighting:0.5, Ground:0.5, Flying:2, Bug:2, Steel:0.5 },
  Ghost:    { Normal:0, Psychic:2, Ghost:2, Dark:0.5 },
  Dragon:   { Dragon:2, Steel:0.5, Fairy:0 },
  Dark:     { Fighting:0.5, Psychic:2, Ghost:2, Dark:0.5, Fairy:0.5 },
  Steel:    { Fire:0.5, Water:0.5, Grass:0.5, Ice:2, Rock:2, Steel:0.5, Fairy:2,
              Normal:0.5, Flying:0.5, Psychic:0.5, Bug:0.5, Dragon:0.5, Dark:0.5,
              Fighting:0.5, Poison:0, Ground:1, Electric:0.5 },
  Fairy:    { Fire:0.5, Fighting:2, Poison:0.5, Dragon:2, Dark:2, Steel:0.5 }
};

// ─── TYPE COLORS (for chat output) ───────────────────────────────
const TYPE_COLORS = {
  Normal:"#a8a878", Fire:"#f08030", Water:"#6890f0", Grass:"#78c850",
  Electric:"#f8d030", Ice:"#98d8d8", Fighting:"#c03028", Poison:"#a040a0",
  Ground:"#e0c068", Flying:"#a890f0", Psychic:"#f85888", Bug:"#a8b820",
  Rock:"#b8a038", Ghost:"#705898", Dragon:"#7038f8", Dark:"#705848",
  Steel:"#b8b8d0", Fairy:"#ee99ac"
};

// ─── CALCULATE TYPE MULTIPLIER ────────────────────────────────────
function getTypeMultiplier(attackType, defType1, defType2) {
  if (!attackType) return 1;
  const chart = TYPE_CHART[attackType] || {};
  let mult = 1;
  if (defType1) mult *= (chart[defType1] !== undefined ? chart[defType1] : 1);
  if (defType2) mult *= (chart[defType2] !== undefined ? chart[defType2] : 1);
  return mult;
}

// ─── STAB BONUS ───────────────────────────────────────────────────
function hasSTAB(attackType, attackerType1, attackerType2) {
  return attackType && (attackType === attackerType1 || attackType === attackerType2);
}

// ─── MULTIPLIER LABEL ─────────────────────────────────────────────
function getEffectivenessLabel(mult) {
  if (mult === 0)   return "⬛ **No Effect!**";
  if (mult >= 4)    return "🔴 **Quadruple Super Effective!!**";
  if (mult >= 2)    return "🟠 **Super Effective!**";
  if (mult <= 0.25) return "🔵 **Barely Effective...**";
  if (mult <= 0.5)  return "🔵 **Not Very Effective...**";
  return "⬜ Normal effectiveness";
}

// ─── MAIN HANDLER ────────────────────────────────────────────────
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

// ─── ACCURACY CHECK ───────────────────────────────────────────────
function handleAccuracy(total, metadata) {
  const moveName    = metadata.moveName    || "Move";
  const moveType    = metadata.moveType    || "";
  const actorName   = metadata.actorName   || "Pokémon";
  const targetName  = metadata.targetName  || "";
  const damageRoll  = metadata.damageRoll  || "";
  const attackerType1 = metadata.attackerType1 || "";
  const attackerType2 = metadata.attackerType2 || "";

  // Accuracy thresholds
  let resultLabel = "";
  if (total >= 20)      resultLabel = "🎯 **Critical Hit!**";
  else if (total >= 11) resultLabel = "✅ **Hit!**";
  else if (total >= 6)  resultLabel = "⚠️ **Glancing Blow**";
  else                  resultLabel = "❌ **Miss!**";

  const typeCol = TYPE_COLORS[moveType] || "#888";
  const typeTag = moveType ? `[color=${typeCol}][${moveType}][/color]` : "";

  let out = `## ${moveName} ${typeTag}\n`;
  out += `**${actorName}** uses **${moveName}**`;
  if (targetName) out += ` on **${targetName}**`;
  out += `\n**Accuracy Check:** ${total} — ${resultLabel}\n`;

  if (total >= 6 && damageRoll) {
    if (total >= 20) out += `\n> Roll damage dice **twice** for Critical Hit!\n`;

    // Check targets for type weakness
    const targets = api.getTargets();
    if (targets && targets.length > 0) {
      const target = targets[0];
      const targetToken = target.token;
      if (targetToken && targetToken._id) {
        // Fetch target record to get their Pokemon types
        api.getRecord("pokemon", targetToken._id, function(targetRecord) {
          if (targetRecord && targetRecord.data) {
            const defType1 = targetRecord.data.poke_type1 || "";
            const defType2 = targetRecord.data.poke_type2 || "";
            const mult = getTypeMultiplier(moveType, defType1, defType2);
            const effectiveness = getEffectivenessLabel(mult);
            const stab = hasSTAB(moveType, attackerType1, attackerType2);

            let dmgMsg = out;
            if (defType1) {
              dmgMsg += `\n**Target types:** ${defType1}${defType2 ? " / " + defType2 : ""}\n`;
              dmgMsg += `${effectiveness}\n`;
              if (mult === 0) {
                dmgMsg += `\n*${moveName} has no effect on ${targetRecord.name || "the target"}!*`;
                api.sendMessage(dmgMsg, undefined, [], []);
                return;
              }
              if (mult !== 1) dmgMsg += `**Damage multiplier: ×${mult}**\n`;
            }
            if (stab) dmgMsg += `✨ **STAB** (+3 damage)\n`;

            // Build damage roll button with multiplier in metadata
            dmgMsg += `\n\`\`\`Roll_Damage\napi.promptRoll('${moveName} Damage', '${damageRoll}', [], { rollType: 'damage', moveName: '${moveName}', moveType: '${moveType}', actorName: '${actorName}', targetName: '${targetRecord.name || targetName}', typeMultiplier: ${mult}, stab: ${stab} }, 'system');\n\`\`\``;
            api.sendMessage(dmgMsg, undefined, [], []);
          } else {
            // No target record found, post without type info
            postAccuracyWithDamageButton(out, moveName, damageRoll, moveType, actorName, targetName, 1, false);
          }
        });
        return; // Wait for async getRecord callback
      }
    }

    // No targeted token — post without type matchup
    postAccuracyWithDamageButton(out, moveName, damageRoll, moveType, actorName, targetName, 1, false);
  } else {
    api.sendMessage(out, undefined, [], []);
  }
}

function postAccuracyWithDamageButton(baseMsg, moveName, damageRoll, moveType, actorName, targetName, mult, stab) {
  let msg = baseMsg;
  msg += `\n\`\`\`Roll_Damage\napi.promptRoll('${moveName} Damage', '${damageRoll}', [], { rollType: 'damage', moveName: '${moveName}', moveType: '${moveType}', actorName: '${actorName}', targetName: '${targetName}', typeMultiplier: ${mult}, stab: ${stab} }, 'system');\n\`\`\``;
  api.sendMessage(msg, undefined, [], []);
}

// ─── DAMAGE ROLL ──────────────────────────────────────────────────
function handleDamage(total, metadata) {
  const moveName   = metadata.moveName   || "Move";
  const moveType   = metadata.moveType   || "";
  const actorName  = metadata.actorName  || "Pokémon";
  const targetName = metadata.targetName || "Target";
  const mult       = metadata.typeMultiplier !== undefined ? metadata.typeMultiplier : 1;
  const stab       = metadata.stab || false;

  const typeCol = TYPE_COLORS[moveType] || "#888";
  const typeTag = moveType ? `[color=${typeCol}][${moveType}][/color]` : "";

  // Apply STAB and type multiplier
  let baseDamage = total;
  let finalDamage = baseDamage;
  if (stab) finalDamage += 3;
  finalDamage = Math.floor(finalDamage * mult);

  let out = `## ${moveName} ${typeTag} — Damage\n`;
  out += `**${actorName}** → **${targetName}**\n`;
  out += `Base roll: **${baseDamage}**`;
  if (stab) out += ` + 3 (STAB) = **${baseDamage + 3}**`;
  if (mult !== 1) {
    out += `\n${getEffectivenessLabel(mult)}`;
    out += `\n**Final Damage: ${finalDamage}** (×${mult})`;
  } else {
    out += `\n**Final Damage: ${finalDamage}**`;
  }
  out += `\n\n*Apply ${finalDamage} damage to ${targetName}'s HP*`;

  // Auto-apply damage to targeted token if possible
  const targets = api.getTargets();
  if (targets && targets.length > 0 && mult > 0) {
    const target = targets[0];
    const targetToken = target.token;
    if (targetToken && targetToken._id) {
      api.getRecord("pokemon", targetToken._id, function(targetRecord) {
        if (targetRecord && targetRecord.data) {
          const curHp = parseInt(targetRecord.data.hp_current || 0, 10);
          const newHp = Math.max(0, curHp - finalDamage);
          api.setValuesOnRecord(targetRecord, { "data.hp_current": newHp });
          out += `\n[color=red]${targetRecord.name || targetName}: ${curHp} → ${newHp} HP[/color]`;
          api.sendMessage(out, undefined, [], []);
        } else {
          api.sendMessage(out, undefined, [], []);
        }
      });
      return;
    }
  }
  api.sendMessage(out, undefined, [], []);
}

// ─── CAPTURE ROLL ─────────────────────────────────────────────────
function handleCapture(total, metadata) {
  const pokemonName   = metadata.pokemonName   || "Wild Pokémon";
  const captureTarget = metadata.captureTarget || 50;
  const ballName      = metadata.ballName      || "Poké Ball";

  let out = `## Capture Attempt!\n`;
  out += `**${ballName}** thrown at **${pokemonName}**\n`;
  out += `**Roll:** ${total} (need ${captureTarget} or lower)\n\n`;

  if (total <= captureTarget) {
    out += `### ✅ Caught!\n${pokemonName} was caught!`;
  } else {
    const diff = total - captureTarget;
    out += diff <= 10
      ? `### ❌ So Close!\n${pokemonName} broke free! (missed by ${diff})`
      : `### ❌ Escaped!\n${pokemonName} broke free!`;
  }
  api.sendMessage(out, undefined, [], []);
}

// ─── SKILL CHECK ─────────────────────────────────────────────────
function handleSkill(total, metadata) {
  const skillName = metadata.skillName || "Skill";
  const actorName = metadata.actorName || "Trainer";
  const dc = metadata.dc || 0;

  let out = `## ${skillName} Check\n`;
  out += `**${actorName}** rolled **${total}**`;
  if (dc > 0) {
    out += ` (DC ${dc})\n`;
    out += total >= dc ? `\n✅ **Success!**` : `\n❌ **Failure** (missed by ${dc - total})`;
  } else {
    out += `\n*(GM sets DC)*`;
  }
  api.sendMessage(out, undefined, [], []);
}

// ─── SAVING THROW ────────────────────────────────────────────────
function handleSave(total, metadata) {
  const saveName   = metadata.saveName   || "Save";
  const actorName  = metadata.actorName  || "Pokémon";
  const saveTarget = metadata.saveTarget || 10;

  let out = `## ${saveName}\n`;
  out += `**${actorName}** rolls **${total}** (need ${saveTarget} or higher)\n\n`;
  out += total >= saveTarget
    ? `✅ **Success** — affliction resisted or cured!`
    : `❌ **Failure** — affliction continues.`;
  api.sendMessage(out, undefined, [], []);
}

// ─── GENERIC FALLBACK ────────────────────────────────────────────
function handleGeneric(total, metadata) {
  const rollName  = metadata.rollName  || "Roll";
  const actorName = metadata.actorName || "";
  let out = `## ${rollName}\n`;
  out += actorName ? `**${actorName}** rolled **${total}**` : `**Result:** ${total}`;
  api.sendMessage(out, undefined, [], []);
}
