# Pokémon Tabletop Adventures 3 — Realm VTT Ruleset

A complete ruleset implementation of **Pokémon Tabletop Adventures 3 (PTA3)** for [Realm VTT](https://www.realmvtt.com).

![Status](https://img.shields.io/badge/status-in%20development-yellow)
![Realm VTT](https://img.shields.io/badge/Realm_VTT-compatible-blue)

## Features

- 🎨 **Trainer Sheet** — Full character sheet with color-coded stats, 17 skills with roll buttons, Origin/Class features, Skill Talents, Owned Pokémon, Honors, Inventory
- 🐉 **Pokémon Stat Block** — Type badges (live-rendered), color-coded stats (ATK/DEF/SpATK/SpDEF/SPD), 3 move slots, Passives & Skills, Biology section
- 📚 **Compendium** — 962 Pokémon, 87 moves, 45 abilities imported and filterable
- 🔍 **Dynamic Filters** — Filter Pokémon by Type, Stage, Size; Moves by Type/Category; Abilities by Category/Trigger
- 🎲 **Roll Handler** — Full 18×18 PTA3 type chart, STAB bonus, automatic cross-sheet damage application
- ⚡ **Type Weakness System** — When a Pokémon attacks, the roll handler reads the target's types via `api.getRecord()` and applies super-effective / not-very-effective / immunity multipliers automatically

## Setup

### Prerequisites

- [Realm VTT](https://play.realmvtt.com) account
- Node.js installed
- [Sean's ruleset-compiler](https://github.com/seansps/ruleset-compiler) cloned

### Install

1. Clone this repo into your `ruleset-compiler` folder:
   ```bash
   cd ruleset-compiler-main
   git clone https://github.com/Aniond/PTA.git PTA
   ```

2. Compile the ruleset into your account:
   ```bash
   cd PTA
   node ..\src\cli.js rulesets -e your@email.com -p yourPassword .
   ```

3. Import the compendium data into your campaign:
   ```bash
   node ..\src\cli.js records pta3_pokemon_full.csv -c <campaignID> -e your@email.com -p yourPassword
   node ..\src\cli.js records pta3_moves.csv -c <campaignID> -e your@email.com -p yourPassword
   node ..\src\cli.js records pta3_abilities.csv -c <campaignID> -e your@email.com -p yourPassword
   ```

4. Open your campaign in Realm VTT — Pokémon Tabletop Adventures 3 ruleset is ready to go.

## File Structure

```
PTA/
├── ruleset.config.json       # Main config with record types, tabs, filters
├── character-main.html       # Trainer sheet (Main tab)
├── character-notes.html      # Trainer sheet (Notes tab)
├── npc-main.html             # NPC sheet
├── pokemon-main.html         # Pokémon stat block sheet
├── moves-main.html           # Move compendium entry (WIP)
├── abilities-main.html       # Ability compendium entry (WIP)
├── common.js                 # Shared helpers (type color lookup, etc.)
├── rollhandlers/
│   └── system.js             # Roll handler with full type matchup logic
├── pta3_pokemon_full.csv     # 962 Pokémon stat blocks
├── pta3_moves.csv            # 87 moves
└── pta3_abilities.csv        # 45 abilities
```

## Type Matchup System

The roll handler implements PTA3's full type chart. When a Pokémon uses an attacking move on a targeted token:

1. Accuracy check rolled (1d20 + ATK Mod or SpATK Mod)
2. On hit, handler reads target's `poke_type1` and `poke_type2`
3. Looks up move type vs target types in `TYPE_CHART`
4. Applies multiplier (×0, ×0.5, ×1, ×2, ×4) and STAB bonus (+3 if move type matches attacker's type)
5. Posts color-coded effectiveness label to chat
6. Auto-applies final damage to target's `hp_current` via `api.setValuesOnRecord()`

## Roadmap

- [ ] Move compendium entry sheet (`moves-main.html`)
- [ ] Ability compendium entry sheet (`abilities-main.html`)
- [ ] Embedded Pokémon party list on trainer sheet (drag-and-drop)
- [ ] Character creation wizard
- [ ] Legendary Pokémon import (from GM Guide)
- [ ] Capture mechanic automation

## Credits

- **PTA3 system** by Pokemon Tabletop United community
- **Realm VTT** by Sean Schnell ([@seansps](https://github.com/seansps))
- Built using [seansps/ruleset-compiler](https://github.com/seansps/ruleset-compiler)

## Fan Content Notice

This is an unofficial fan implementation. PTA3 is a fan-made tabletop system. Pokémon and all related names, designs, and intellectual property are owned by Nintendo / Game Freak / The Pokémon Company. No copyright infringement is intended.

## License

MIT — feel free to fork, modify, and share.
