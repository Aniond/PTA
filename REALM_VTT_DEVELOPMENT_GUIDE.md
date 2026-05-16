# Realm VTT Ruleset Development Guide
## Hard-won knowledge from building the Kult: Divinity Lost 4th Edition ruleset

This document is a complete reference for building rulesets on Realm VTT using the ruleset compiler. It captures everything discovered during a full production ruleset build — including bugs, confirmed patterns, API details, and things that seem like they should work but don't.

**Contact:** Sean (Realm VTT developer) is active on Discord and extremely helpful. Ask him before building complex workarounds. Reference his SWRPG and PF2e rulesets for real-world examples.

---

## Environment Setup

```
ruleset-compiler-main/
├── src/
│   ├── cli.js          ← main CLI entry point
│   ├── compiler.js
│   ├── records.js      ← CSV import handler
│   └── csv.js          ← CSV parser
└── your-ruleset/
    ├── ruleset.config.json   ← NOTE: dot not underscore
    ├── common.js
    ├── characters-main.html
    ├── rollhandlers/
    │   └── system.js
    └── wizards/
        └── characters/
```

### Compile commands
```bash
# Compile and push to Realm VTT
node ..\src\cli.js rulesets -e email@example.com -p password .

# Import records from CSV into a campaign
node ..\src\cli.js records import_file.csv -c <campaignId> -e email -p password

# Dry run — prints payload without uploading
node ..\src\cli.js records import_file.csv -c <campaignId> -e email -p password --dry-run
```

### Get your campaign ID from invite code
The CLI uses an internal campaign ID, not the invite code shown in the UI.
```javascript
// get_campaign_id.js — run: node get_campaign_id.js <inviteCode> <email> <password>
const [,, inviteCode, email, password] = process.argv;
async function main() {
  const loginRes = await fetch("https://utilities.realmvtt.com/authentication", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ strategy: "local", email, password })
  });
  const { accessToken: token } = await loginRes.json();
  const res = await fetch(
    `https://utilities.realmvtt.com/campaigns?inviteCode=${encodeURIComponent(inviteCode)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const { data } = await res.json();
  console.log("Campaign ID:", data[0]?._id);
}
main();
```

---

## ruleset.config.json Structure

**CRITICAL:** The file must be named `ruleset.config.json` (dot, not underscore).

```json
{
  "name": "My Ruleset",
  "description": "Description here",
  "version": 1,
  "records": [
    {
      "name": "Characters",
      "type": "characters",
      "minX": 650,
      "minY": 800,
      "tabs": [
        { "name": "Main", "file": "characters-main.html" },
        { "name": "Notes", "file": "characters-notes.html" }
      ],
      "hideFromCompendium": false,
      "isList": false,
      "icon": "",
      "filters": {}
    }
  ],
  "settings": {
    "otherSettings": {
      "commonScript": { "file": "common.js" }
    },
    "rollTypes": [
      { "name": "system", "file": "rollhandlers/system.js" }
    ]
  }
}
```

### Standard record vs List record

**Standard record** — has its own window, appears in compendium browser:
```json
{
  "name": "Player Moves",
  "type": "player_moves",
  "minX": 400, "minY": 500,
  "tabs": [{ "name": "Main", "file": "player-moves-list.html" }],
  "hideFromCompendium": false,
  "isList": false,
  "icon": "", "filters": {},
  "compendium": [ ...entries... ]
}
```

**List record** — embedded inside other records, NOT visible in compendium browser on its own:
```json
{
  "name": "Gear List",
  "type": "gear_list",
  "isList": true,
  "singleRow": false,
  "showAddButton": true,
  "showDeleteButton": true,
  "addButtonText": "Add Item",
  "newItemName": "Item",
  "emptyListText": "No items yet",
  "disableDrop": false,
  "allowedListTypes": ["gear"],
  "tabs": [{ "name": "Main", "file": "gear-list.html" }]
}
```

**IMPORTANT DISCOVERY:** List records do NOT appear in the Compendium dropdown menu even with hideFromCompendium: false. To get records into the compendium browser, they must be standard records (isList: false). The solution is TWO record types — one standard (compendium browser) and one list (embedding in sheets), with allowedListTypes referencing the standard type.

### Compendium entries
Pre-populate a compendium by adding an array to the record:
```json
{
  "type": "player_moves",
  "hideFromCompendium": false,
  "compendium": [
    {
      "name": "Engage in Combat",
      "data": {
        "move_attr": "+Violence",
        "move_trigger": "When you engage an opponent...",
        "move_success": "You inflict damage and avoid counterattack."
      }
    }
  ]
}
```

### CSV Import for bulk records
The CSV format (from csv.js source):
- Column 1: recordType (must match a type in your config)
- Column 2: name
- Column 3+: any field name becomes data.fieldName

```csv
recordType,name,move_attr,move_trigger,move_success
player_moves,Engage in Combat,+Violence,When you engage an opponent...,You inflict damage.
player_moves,Avoid Harm,+Reflexes,When you try to avoid harm...,Completely unharmed.
```

---

## SES JavaScript Sandbox — CRITICAL

Realm VTT runs all ruleset JavaScript in a Secure ECMAScript (SES) sandbox. This is NOT standard browser JS.

### Blocked — will silently fail or throw:
```javascript
document.getElementById()       // BLOCKED
document.querySelector()        // BLOCKED
document.querySelectorAll()     // BLOCKED
document.activeElement          // BLOCKED
window.*                        // BLOCKED
?.                              // Optional chaining BLOCKED
`template ${literals}`          // Template literals BLOCKED
() => {}                        // Arrow functions BLOCKED in some contexts
const / let                     // May fail in wizard contexts — use var
```

### Works:
```javascript
document.write()     // Parse-time only (initial render, not after)
api.*                // All Realm API methods
record               // Current record data
data                 // Current record's data object (shorthand in list context)
event                // Current event object
value                // Current field value (in onchange context)
dataPath             // Path to current data in lists
```

### Safe ES5 patterns:
```javascript
// Safe null check — no optional chaining
var val = record && record.data && record.data.myField;

// Safe for loops
for (var i = 0; i < arr.length; i++) { ... }

// Safe string building
var msg = "Hello " + name + ", your score is " + score;

// Safe object building
var opts = {};
opts["data." + field] = value;
api.setValues(opts);
```

---

## Native HTML Elements Reference

### Input fields
```html
<namefield field="name" label="Name" size="lg" bold="true" placeholder="..."></namefield>
<stringfield field="notes" label="Notes" size="xs" multiline="true" maxrows="4" placeholder="..."></stringfield>
<numberfield field="count" label="Count" minvalue="0" maxvalue="10" defaultvalue="0" hideControls="true"></numberfield>
<richtextfield field="desc" label="Description" height="80px" placeholder="..."></richtextfield>
<checkbox field="is_active" label="Active"></checkbox>
<dropdown field="type" label="Type" size="xs" placeholder="Select..."
  onload="init();" onchange="onChange();"
  options='[{"label":"Option A","value":"a"},{"label":"Option B","value":"b"}]'>
</dropdown>
```

### Layout elements
```html
<divider label="Section Title" orientation="horizontal" size="md"></divider>

<box field="mySection">
  <!-- content here, hideable via api.setHidden() -->
</box>

<accordion field="isOpen" size="xs" variant="minimal" chevronposition="right">
  <accordion.control>
    <label label="Header text" variant="bold" size="sm"></label>
  </accordion.control>
  <!-- expanded content here -->
</accordion>

<list listtype="gear_list" field="gear"></list>

<portrait field="portrait" width="72" height="72"></portrait>

<canvas field="myCanvas" width="400" height="300"
  style="width:100%; height:300px; display:block;"
  onload="draw();" onresize="draw();" onclick="onClick();"
  onmousemove="onMove();" onmouseleave="onLeave();"
  onrecordchanged="draw();">
</canvas>
```

### Buttons
```html
<button field="rollBtn" size="xs" label="Roll" variant="outline"
  onclick="myRollFunction();"></button>
```

### Element sizes: xs / sm / md / lg

### Event handlers on elements
```
onload          — fires when element renders
onchange        — fires when value changes
onclick         — fires on click
onmousemove     — fires on mouse move
onmouseleave    — fires when mouse leaves
onresize        — fires when canvas resizes
onrecordchanged — fires when record data changes (any client)
```

---

## api.* Reference

### Values
```javascript
api.setValue("data.fieldName", value);
api.setValues({ "data.field1": val1, "data.field2": val2 });
api.getValue("data.fieldName");
```

### Show/Hide (box elements)
```javascript
api.setHidden("fieldName", true);           // hide one
api.setHidden("fieldName", false);          // show one
api.setHidden(["field1", "field2"], true);  // hide many at once — preferred
api.setHidden(["field1", "field2"], false); // show many at once
```

### Session (per-client temporary state, not persisted)
```javascript
api.setSession("key", value);
api.getSession("key");
```

### Broadcast (sync between clients)
```javascript
api.broadcast("event:name", { data: "payload" });
function onBroadcast(name, data, meta) {
  if (name === "event:name") { /* handle */ }
  // NOTE: fires for ALL open records — always filter by recordId
}
```

### Chat / Messaging
```javascript
api.sendMessage("## Title\nBody text with **markdown**", undefined, [], []);
```

### Dialogs
```javascript
api.showConfirm("Title", "Message", "OK label", "Cancel label",
  function() { /* on OK */ });

api.showSelect("Title", "Message",
  [{ label: "Option A", value: "a" }],
  null,
  function(values) { /* values is array of selected */ });
```

### Animation
```javascript
api.requestAnimationFrame("myDrawFunction(generation);");
api.delay(function() { /* callback */ }, 1200);
```

### Records
```javascript
api.getRecord(recordType, recordId, function(record) { /* callback */ });
api.removeValueFromRecord(sourceRecord, dataPath, index);
```

### Theme colors
```javascript
api.getThemeColor("background")
api.getThemeColor("text")
api.getThemeColor("textDim")
```

### Rolls
```javascript
api.promptRoll("Move Name", "2d10", [modifiers], { metadata: "here" }, "rollHandlerName");
```

---

## Canvas API Reference

```javascript
const c = api.getCanvas("canvasFieldName");
if (!c) return;
const W = c.width, H = c.height;
```

### Drawing
```javascript
c.clearRect(0, 0, W, H)
c.fillRect(x, y, w, h)
c.beginPath()
c.moveTo(x, y)
c.lineTo(x, y)
c.arc(x, y, r, startAngle, endAngle)
c.quadraticCurveTo(cpx, cpy, x, y)
c.roundRect(x, y, w, h, radius)
c.closePath()
c.fill()
c.stroke()
c.fillText(text, x, y)
c.measureText(text).width
```

### Style setters — REQUIRED, direct assignment is blocked
```javascript
c.setFillStyle("#C8902A")
c.setStrokeStyle("rgba(200,144,42,0.5)")
c.setLineWidth(2)
c.setFont("700 14px Georgia, serif")
c.setTextAlign("center")       // "left" | "center" | "right"
c.setTextBaseline("middle")    // "top" | "middle" | "bottom"
c.setGlobalAlpha(0.5)
c.setShadowColor("#C8902A")
c.setShadowBlur(12)
c.setLineDash([5, 3])
c.setFilter("blur(8px)")
c.clearFilter()
```

### Overlay fields (inputs rendered on top of canvas)
```javascript
c.clearOverlayFields();   // ALWAYS call at top of every paint function
c.overlayField(
  { x: fieldX, y: fieldY, w: fieldW, h: fieldH },
  "data.fieldName",
  {
    type: "string",        // "string" | "number"
    variant: "unstyled",
    textAlign: "center",
    options: '[{"label":"+3","value":3}]',  // makes it a dropdown
    placeholder: "edit...",
    style: "font-size:12px; color:#fff; background:transparent;"
  }
);
```

### Tooltips
```javascript
c.clearTooltips();    // call at top of paint
c.tooltip(x, y, w, h, "Tooltip text");
```

### Portrait / Images
```javascript
// record.portrait is a path string like "/images/name.webp"
if (record && record.portrait) {
  c.drawImage(record.portrait, x, y, width, height);
}
```

### Always at top of every paint function:
```javascript
c.clearOverlayFields();
c.clearTooltips();
c.clearRect(0, 0, W, H);
```

---

## Canvas Bugs Discovered (all fixed by Sean)

1. autosize="true" caused canvas content to drift when the page was scrolled.
2. numberfield and stringfield near canvases caused scroll drift.
3. Overlay fields with options: or type:"number" changed value on scroll even when the sheet was locked.

All three were reported and fixed. If you encounter drift issues, fixed pixel dimensions are the workaround:
```html
<canvas field="myCanvas" width="400" height="300"
  style="width:400px; height:300px; display:block; margin:0 auto;">
```

---

## Dynamic Content Pattern

```html
<script>
function showHideFields() {
  var type = record && record.data && record.data.item_type;
  api.setHidden(["section_weapon", "section_armor", "section_tool"], true);
  if (type === "weapon") api.setHidden("section_weapon", false);
  else if (type === "armor") api.setHidden("section_armor", false);
  else api.setHidden("section_tool", false);
}
</script>

<dropdown field="item_type" label="Type" size="xs"
  onload="showHideFields();"
  onchange="showHideFields();"
  options='[{"label":"Weapon","value":"weapon"},{"label":"Armor","value":"armor"}]'>
</dropdown>

<box field="section_weapon">
  <!-- weapon fields -->
</box>
<box field="section_armor">
  <!-- armor fields -->
</box>
```

Key facts:
- All boxes are visible by default — always hide all first then show one
- box field attribute maps directly to api.setHidden("fieldName", bool)
- Works in both sheet tabs and wizard steps
- Dynamic key trick: api.setHidden("desc_" + value.toLowerCase().replace(/ /g,"_"), false)

---

## Roll Handler Pattern

**CRITICAL:** Roll handler files are executed as **top-level scripts**, NOT as `handleResult()` functions. The dev guide previously documented this incorrectly. The roll handler is fired when a roll with a matching rollType completes, and the file runs from top to bottom.

### Entry point
- `data.roll` — the roll result object (contains `.total`, `.results`, `.metadata`)
- `data.roll.metadata` — whatever metadata you passed to `api.promptRoll`
- `record` — the record the roll fired from
- All `common.js` functions are available

```javascript
// rollhandlers/system.js
// Runs as a top-level script. No function wrapper.

var roll = data && data.roll;
var total = (roll && roll.total !== undefined) ? roll.total : 0;
var meta = (roll && roll.metadata) ? roll.metadata : {};
var moveName = meta.moveName || "Roll";
var characterName = (record && record.name) || "Character";

var tierLabel, outcomeText;
if (total >= 15) {
  tierLabel = "Success";
  outcomeText = "You succeed completely.";
} else if (total >= 10) {
  tierLabel = "Partial";
  outcomeText = "You succeed, but with complications.";
} else {
  tierLabel = "Failure";
  outcomeText = "You fail.";
}

var message =
  "**" + characterName + "** — **" + moveName + "**\n" +
  "Total: **" + total + "** — " + tierLabel + "\n" +
  outcomeText;

// IMPORTANT: pass data.roll as the second arg so the roll details show in chat
api.sendMessage(message, data.roll, [], []);
```

### Triggering a roll

```javascript
api.promptRoll(
  "Roll Title",                                   // shown in roll prompt
  "1d10",                                         // dice formula
  [                                                // modifiers: ARRAY OF OBJECTS, not numbers
    { name: "ATK Mod", value: 5, active: true, valueType: "number" }
  ],
  { rollType: "attack", moveName: "...", recordId: record._id },  // metadata
  "system"                                        // rollType name — must match config rollTypes[].name
);
```

**Modifier format is critical.** Each modifier MUST be an object with `{ name, value, active, valueType }`. Passing raw numbers like `[5]` will fail silently — the dice will roll but the handler will never fire.

### For tokens specifically

When the record is a linked token (e.g. `record.linked !== undefined`), use `api.promptRollForToken` instead:

```javascript
if (record.linked === undefined) {
  api.promptRoll("Title", "1d10", modifiers, metadata, "system");
} else {
  api.promptRollForToken(record, "Title", "1d10", modifiers, metadata, "system");
}
```

### Chaining rolls (e.g. accuracy → damage)

Call `api.promptRoll` again from inside the handler with a different rollType in metadata, then branch on `meta.rollType` at the top of the file.

### Registering multiple roll types

Sean's pattern in production rulesets uses one file per rollType (`attack.js`, `damage.js`, `skill.js`), each registered separately in config:

```json
"rollTypes": [
  { "name": "attack", "file": "rollhandlers/attack.js" },
  { "name": "damage", "file": "rollhandlers/damage.js" },
  { "name": "skill",  "file": "rollhandlers/skill.js" }
]
```

A single combined handler file (`system.js`) with switching logic also works — both patterns are valid.

Receiving results on the sheet:
```javascript
function onChatMessage(msg, roll) {
  if (!roll) return;
  if (!msg.roll || !msg.roll.metadata) return;
  if (msg.roll.metadata.recordId !== record._id) return;
  var total = roll.total;
  var color = total >= 15 ? "#1D9E75" : total >= 10 ? "#C8902A" : "#E24B4A";
  // React to result — flash canvas, update portrait glow, etc.
  api.delay(function() { /* clear flash */ }, 1200);
}
```

---

## Accordion Pattern

```html
<!-- Wrap in div for custom styling — accordion ignores inline style attr -->
<div style="background:rgba(13,10,5,0.85);
            border:1px solid rgba(200,144,42,0.2);
            border-left:3px solid #C8902A;
            border-radius:2px; margin-bottom:2px; overflow:hidden;">
  <accordion field="is_open" size="xs" variant="minimal" chevronposition="right">
    <accordion.control>
      <namefield field="name" label="" bold="true" size="sm"
        placeholder="Item name..."></namefield>
    </accordion.control>
    <div style="padding:6px 0 4px 0; border-top:1px solid rgba(200,144,42,0.15);">
      <stringfield field="description" label="Description" size="xs"
        multiline="true" maxrows="3" placeholder="..."></stringfield>
    </div>
  </accordion>
</div>
```

Note: The style attribute on accordion itself is ignored by Realm. Always wrap in a div.

---

## Portrait on Canvas

```javascript
function drawPortrait(glowColor) {
  var c = api.getCanvas("portraitCanvas");
  if (!c) return;
  var W = c.width, H = c.height, pad = 3;
  c.clearRect(0, 0, W, H);
  if (glowColor) {
    c.setShadowColor(glowColor);
    c.setShadowBlur(16);
    c.setStrokeStyle(glowColor);
    c.setLineWidth(3);
    c.beginPath(); c.roundRect(1, 1, W-2, H-2, 3); c.stroke();
    c.setShadowBlur(0);
  }
  if (record && record.portrait) {
    c.drawImage(record.portrait, pad, pad, W-pad*2, H-pad*2);
  }
  c.setStrokeStyle(glowColor || "rgba(200,144,42,0.3)");
  c.setLineWidth(glowColor ? 2 : 1);
  c.beginPath(); c.roundRect(pad, pad, W-pad*2, H-pad*2, 3); c.stroke();
}
```

Replace portrait field element with canvas:
```html
<canvas field="portraitCanvas" width="72" height="72"
  style="width:72px; height:72px; display:block;"
  onload="drawPortrait();"
  onrecordchanged="drawPortrait();">
</canvas>
```

---

## Drag and Drop

### Simple list-to-list (automatic)
Set on the RECEIVING list record in config:
```json
{ "disableDrop": false, "allowedListTypes": ["gear"] }
```

### Custom onDrop handler
```javascript
function onDrop(type, recordLink, sourceInfo) {
  if (type === "items") {
    api.getRecord(type, recordLink.id, function(droppedRecord) {
      // Use droppedRecord.data
      if (sourceInfo && sourceInfo.type === "list") {
        api.getRecord(sourceInfo.recordType, sourceInfo.recordId,
          function(sourceRecord) {
            api.removeValueFromRecord(sourceRecord, sourceInfo.dataPath, sourceInfo.index);
          }
        );
      }
    });
  }
}
```

Reference: Sean's 5e ruleset character-inventory.html for complete example.

---

## Lifecycle Events

```javascript
function onLoad() { /* sheet opened */ }
function onRecordChanged(event) { /* data changed on any client */ }
function onChatMessage(msg, roll) { /* EVERY chat message — always filter */ }
function onBroadcast(name, data, meta) { /* EVERY broadcast — always filter */ }
function onStepEnd(stepIndex) { /* wizard Next/Finish clicked, 0-based */ }
```

---

## Wizard Notes

Wizard fields save to record.data.wizard.fieldName, NOT record.data.fieldName.

```javascript
// Reading wizard data
var arch = record && record.data && record.data.wizard && record.data.wizard.archetype;

// Copying to final record in onStepEnd
function onStepEnd(stepIndex) {
  var w = (record.data && record.data.wizard) || {};
  api.setValues({
    "data.archetype": w.archetype,
    "data.stability": 10
  });
}
```

Gotchas:
- label elements do NOT fire onload — use dropdown instead
- Wizard field population can be unreliable — test thoroughly
- Consider skipping wizards for complex rulesets — a well-designed sheet is often simpler

---

## Fan Content Policy

Before distributing a licensed TTRPG ruleset:
- Check the publisher's fan content policy
- Paraphrase rulebook text — do not copy verbatim
- Do not reproduce official artwork or graphic design
- Include required attribution in README

Generally safe: mechanic names, move names, attribute names, game structure
Generally not safe: verbatim text, artwork, exact publisher stat blocks

---

## Module Export Workflow

1. Import CSV records into campaign via CLI
2. Open campaign in Realm VTT
3. Click Modules in navigation
4. Configure player vs GM content
5. Click Export
6. To import into another campaign: Modules -> find your module -> Import

---

## Common Gotchas Summary

1. Config file: ruleset.config.json (dot, not underscore)
2. List records: do NOT appear in compendium browser — need standard record type for that
3. hideFromCompendium must be explicitly set to false — not just omitted
4. document.write() only works at parse time, not in event handlers
5. accordion style attribute is ignored — wrap in div instead
6. label elements do NOT fire onload — use dropdown
7. Canvas: always clearOverlayFields() and clearTooltips() at top of paint
8. Optional chaining (?.) is blocked — use && chains
9. Template literals blocked — use string concatenation
10. Campaign ID != invite code — use the get_campaign_id.js script
11. api.setValues() is better than multiple api.setValue() calls
12. onChatMessage and onBroadcast fire for ALL records — always filter by recordId

---

## Resources

- Realm VTT Wiki: https://www.realmvtt.com/wiki/ruleset-editor-and-api
- Ruleset Compiler: https://github.com/seansps/ruleset-compiler
- SWRPG Reference Ruleset: https://github.com/seansps/realmvtt-swrpg
- Kult Ruleset (this project): https://github.com/Aniond/realm-kult-divinity-lost
