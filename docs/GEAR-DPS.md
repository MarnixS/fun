# Gear DPS and editable loadouts

The Experimental Team Gear Planner uses the OSRS Wiki combat engine pinned at
`98e4fac38b580901cc3f8d485bbaa48bbb3277ed`. Its corresponding source, licence,
equipment data and integration adapter are served under `vendor/osrs-dps/`.

## Inputs and results

- Each player uses their own saved WOM levels, capped at the in-game base level
  of 99. Unknown combat levels produce an explicit unavailable result.
- Equipped items supply their actual offensive, defensive and damage bonuses.
  Powered staves, attack speed, target size, weaknesses, weapon effects, crystal,
  void, Inquisitor and other supported sets use the upstream rules.
- A boss selects its actual NPC. Raids and composite encounters expose their
  targets and variants. Automatic mode maps gear phases to their relevant NPC,
  for example Olm's melee claw, magic claw and head. Each result names its target.
  Every raid has a separate encounter selector: CoX bosses/combat rooms and
  puzzles, all six ToB encounters, and ToA bosses and path challenges. Selecting
  a room narrows the phase list and rebuilds suitable combat methods and gear.
  Puzzle-only rooms explain why combat DPS is unavailable. Manual equipment is
  saved separately per raid room. Normal DT2 encounters default to post-quest
  targets; Awakened variants require an explicit target choice.
- Results show active-attacking DPS, maximum attack damage and accuracy. They do
  not estimate whole-fight duration, movement, phase downtime or missed inputs.
  Muspah's prayer shield instead shows its sapphire-bolt switch and an explicit
  unavailable result: ordinary HP DPS does not measure prayer-shield damage.
- Team defaults and per-player overrides control potions, offensive prayers,
  ammo, spells, melee style, Soulreaper stacks, Mark of Darkness and the Kandarin
  hard diary. Raid-only potions are restricted to their activities.
- Raid scaling uses selected players' saved combat, HP and Mining levels. Party
  size, ToA raid/path levels, current target HP and defence reductions are editable.
- Defence reductions represent successful attacks already landed, not attempts
  or automatic effects of owning a spec weapon. The engine applies curse, maul,
  warhammer, Arclight/Emberlight and BGS in that order and respects NPC floors.
- Ammo and charges/repairs are maintained assumptions. Automatic ammo must be
  compatible with the weapon; special cases include blowpipe darts, ballista
  javelins, Karil's bolt racks and Dorgeshuun bone bolts. Prayer unlocks and every
  crafting/quest prerequisite cannot be established from a Collection Log.

## Defaults and finite supply

Defaults compare feasible weapons, refine their leading DPS candidates and test
set combinations, including partial crystal sets. Armour choices improve by
coordinate search, retaining relevant set effects rather than pruning them as
ordinary stat items. This is an iterative search, not an exhaustive global
optimiser over every possible team and switch combination.

Identical DPS does not make items interchangeable: max-hit rounding can hide
bonuses. Ties compare damage/Strength, accuracy, prayer and defence bonuses.
Inquisitor's plateskirt's +2 Strength, +12 crush and +2 Prayer therefore remain
visible to allocation; a regression test verifies that it can equip the stronger
account while Blood Moon tassets pass down to a weaker account.

Players receive stock in the displayed priority. Main setups precede phase
switches and specials. A held item may be reused by the same player across
phases; different simultaneous players need separate physical copies. Recipes
and dismantles use the same stock engine as the supply ledger. Each candidate
rebuilds its reservations, so replacing armour releases its previous ingredients.

## Slot editor

All eleven OSRS equipment slots are selectable and searchable. The picker uses
the complete upstream equipment catalogue and shows explicit availability text:

- **Green:** available after reserving other players' gear, including a possible
  complete craft under the selected assumptions.
- **Orange:** acquired but allocated, consumed, restricted by levels, or personal
  to another player. Complete recipes whose ingredients are exhausted also count.
- **Red:** neither available stock nor a complete visible crafting route exists.

Choosing an orange item can reallocate an automatic later-priority setup. When
physical supply is still insufficient, the slot is labelled hypothetical. Red
choices also remain selectable for comparison. Hypothetical items affect their
player's theoretical DPS but never inflate stock, debit missing ingredients or
cause negative quantities. Ammunition assumptions use a separate neutral badge.

Manual choices are stored by encounter, player, phase and slot. A slot, player,
or encounter can return to DPS defaults without clearing bank corrections.
The member filter uses the website's existing shared selection and banner state.
Deselected members still contribute tradeable stock.

## Verification and maintenance

`pnpm test:gear` covers the original allocation/recipe invariants, independent
upstream roll fixtures, player levels, prayer and potion changes, compatible
ammunition, defence floors, raid scaling, phase mapping, the Inquisitor hand-down,
manual shortages, hypothetical stock isolation and interactive slot editing.
The bundle is also executed without Node globals to verify standalone browsers.

`pnpm build:gear-dps` rebuilds the calculator. CI checks its exact output against
the readable source. Browser calculations run in a dedicated local worker; stale
requests are discarded when players, stock, gear or modifiers change. The worker
does not send profiles or inventory to an external calculator.

Sources:

- https://github.com/weirdgloop/osrs-dps-calc/tree/98e4fac38b580901cc3f8d485bbaa48bbb3277ed
- https://oldschool.runescape.wiki/w/Damage_per_second
- https://oldschool.runescape.wiki/w/Dragon_warhammer
- https://prices.runescape.wiki/api/v1/osrs/mapping
