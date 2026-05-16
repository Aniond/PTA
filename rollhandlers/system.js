// PTA3 Roll Handler
// Top-level script. Entry: data.roll and data.roll.metadata

var roll = data && data.roll;
var total = (roll && roll.total !== undefined) ? roll.total : 0;
var meta = (roll && roll.metadata) ? roll.metadata : {};
var rollType = meta.rollType || "generic";

if (rollType === "accuracy") {
  handleAccuracy();
} else if (rollType === "damage") {
  handleDamage();
} else if (rollType === "skill") {
  handleSkill();
} else {
  api.sendMessage("Roll: " + total, data.roll, [], []);
}

// ─── SKILL ROLL ────────────────────────────────────────────────
function handleSkill() {
  var skillName = meta.skillName || "Skill";
  var actorName = meta.actorName || (record && record.name) || "Trainer";

  var out = "## " + skillName + "\n";
  out += "**" + actorName + "** rolls **" + skillName + "**\n";
  out += "**Result: " + total + "**";
  if (total >= 20) out += " - Outstanding!";
  else if (total >= 15) out += " - Success";
  else if (total >= 10) out += " - Partial";
  else out += " - Failure";

  api.sendMessage(out, data.roll, [], []);
}

// ─── ACCURACY ROLL ─────────────────────────────────────────────
function handleAccuracy() {
  var moveName = meta.moveName || "Move";
  var moveType = meta.moveType || "";
  var moveCat  = meta.moveCategory || "";
  var actorName = meta.actorName || "Pokemon";
  var damageRoll = meta.damageRoll || "";
  var t1 = meta.attackerType1 || "";
  var t2 = meta.attackerType2 || "";

  var targets = api.getTargets();
  var hasTarget = targets && targets.length > 0;
  var targetToken = hasTarget ? targets[0].token : null;

  var targetData = null;
  var targetName = "Target";
  if (targetToken) {
    if (targetToken.data) {
      targetData = targetToken.data;
    } else if (targetToken.record && targetToken.record.data) {
      targetData = targetToken.record.data;
    }
    targetName = targetToken.name || (targetToken.record && targetToken.record.name) || "Target";
  }

  var defT1 = targetData ? (targetData.poke_type1 || "") : "";
  var defT2 = targetData ? (targetData.poke_type2 || "") : "";

  var defStat = 0;
  var defStatName = "Defense";
  if (targetData) {
    if (moveCat === "Special Attack") {
      defStat = parseInt(targetData.poke_spdef || 0, 10);
      defStatName = "Sp. Defense";
    } else if (moveCat === "Effect") {
      defStat = parseInt(targetData.poke_speed || 0, 10);
      defStatName = "Speed";
    } else {
      defStat = parseInt(targetData.poke_defense || 0, 10);
      defStatName = "Defense";
    }
  }

  var threshold = defStat > 0 ? defStat : 10;
  var isHit = total >= threshold;

  var isCrit = false;
  if (roll && roll.results && roll.results[0]) {
    var firstResult = roll.results[0];
    if (firstResult.rolls && firstResult.rolls[0] === 20) isCrit = true;
  }

  var out = "## " + moveName;
  if (moveType) out += " [" + moveType + "]";
  out += "\n";
  out += "**" + actorName + "** uses **" + moveName + "**";
  if (hasTarget) out += " on **" + targetName + "**";
  out += "\n**Accuracy:** " + total;
  if (hasTarget) out += " vs " + defStatName + " " + threshold;
  out += " - ";
  if (isCrit) out += "CRITICAL HIT!";
  else if (isHit) out += "Hit!";
  else out += "Miss!";
  out += "\n";

  if (isHit && hasTarget && defT1) {
    var matchup = getTypeMatchup(moveType, defT1, defT2);
    out += "\n**Target types:** " + defT1 + (defT2 ? " / " + defT2 : "");
    out += "\n" + describeMatchup(matchup) + "\n";

    if (matchup === "IMMUNE") {
      out += "\nNo damage to " + targetName;
      api.sendMessage(out, data.roll, [], []);
      return;
    }

    var modifiedDamage = damageRoll;
    if (typeof matchup === "number" && matchup !== 0) {
      modifiedDamage = modifyDamageDice(damageRoll, matchup);
    }
    if (isCrit) {
      var critMatch = modifiedDamage.match(/^(\d+)d(\d+)(.*)$/);
      if (critMatch) {
        modifiedDamage = (parseInt(critMatch[1], 10) * 2) + "d" + critMatch[2] + critMatch[3];
        out += "**Critical:** dice doubled!\n";
      }
    }

    var stab = hasSTAB(moveType, t1, t2);
    if (stab) out += "STAB - +3 damage on hit\n";

    out += "\n**Damage to roll:** " + modifiedDamage;
    if (modifiedDamage !== damageRoll) out += " (was " + damageRoll + ")";

    api.sendMessage(out, data.roll, [], []);

    // Chain the damage roll. Pass the token type AND id so the damage handler can refetch.
    if (modifiedDamage) {
      var dmgModifiers = [];
      if (stab) {
        dmgModifiers.push({
          name: "STAB",
          value: 3,
          active: true,
          valueType: "number"
        });
      }
      var targetTokenId = targetToken ? targetToken._id : "";
      var targetRecordType = targetToken ? (targetToken.recordType || "pokemon") : "pokemon";
      api.promptRoll(
        actorName + " - " + moveName + " Damage",
        modifiedDamage,
        dmgModifiers,
        {
          rollType: "damage",
          moveName: moveName,
          moveType: moveType,
          actorName: actorName,
          targetName: targetName,
          targetId: targetTokenId,
          targetRecordType: targetRecordType,
          stab: stab
        },
        "system"
      );
    }
  } else {
    api.sendMessage(out, data.roll, [], []);
  }
}

// ─── DAMAGE ROLL ───────────────────────────────────────────────
function handleDamage() {
  var moveName = meta.moveName || "Move";
  var moveType = meta.moveType || "";
  var actorName = meta.actorName || "Pokemon";
  var targetName = meta.targetName || "Target";
  var targetId = meta.targetId;
  var targetRecordType = meta.targetRecordType || "pokemon";

  var out = "## " + moveName;
  if (moveType) out += " [" + moveType + "]";
  out += " - Damage\n";
  out += "**" + actorName + "** to **" + targetName + "**\n";
  out += "**Final Damage: " + total + "**";

  // Try to find the target via current targets first (most reliable)
  var targets = api.getTargets();
  var targetToken = null;
  if (targets && targets.length > 0) {
    // Match by id if possible
    for (var i = 0; i < targets.length; i++) {
      if (targets[i].token && targets[i].token._id === targetId) {
        targetToken = targets[i].token;
        break;
      }
    }
    // If no exact match, use the first target as fallback
    if (!targetToken && targets[0]) {
      targetToken = targets[0].token;
    }
  }

  if (targetToken) {
    // Apply damage directly to the token (Sean's pattern from genesys common.js)
    var curHp = parseInt(
      (targetToken.data && targetToken.data.hp_current) ||
      (targetToken.record && targetToken.record.data && targetToken.record.data.hp_current) ||
      0, 10
    );
    var newHp = Math.max(0, curHp - total);
    api.setValuesOnRecord(targetToken, { "data.hp_current": newHp });
    out += "\n\n" + (targetToken.name || targetName) + ": " + curHp + " HP -> " + newHp + " HP";
    if (newHp === 0) out += "\n**" + (targetToken.name || targetName) + " fainted!**";
    api.sendMessage(out, data.roll, [], []);
  } else if (targetId) {
    // Fallback: try to fetch the record by id and type
    api.getRecord(targetRecordType, targetId, function(targetRec) {
      if (targetRec && targetRec.data) {
        var curHp = parseInt(targetRec.data.hp_current || 0, 10);
        var newHp = Math.max(0, curHp - total);
        api.setValuesOnRecord(targetRec, { "data.hp_current": newHp });
        out += "\n\n" + (targetRec.name || targetName) + ": " + curHp + " HP -> " + newHp + " HP";
        if (newHp === 0) out += "\n**" + (targetRec.name || targetName) + " fainted!**";
        api.sendMessage(out, data.roll, [], []);
      } else {
        api.sendMessage(out, data.roll, [], []);
      }
    });
  } else {
    api.sendMessage(out, data.roll, [], []);
  }
}
