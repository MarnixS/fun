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
- A single panel always edits one selected account. Potions, ammo, spells, melee
  style, HP, Soulreaper stacks and other buffs are independent per account. Each
  account has separate melee, ranged and magic prayers. Raid-only potions are
  restricted to their activities; defence reductions describe the shared monster.
- Raid scaling uses selected players' saved combat, HP and Mining levels. Party
  size, ToA raid/path levels, current target HP and defence reductions are editable.
- Defence reductions represent successful attacks already landed, not attempts
  or automatic effects of owning a spec weapon. The engine applies curse, maul,
  warhammer, Arclight/Emberlight and BGS in that order and respects NPC floors.
- Ammo and charges/repairs are maintained assumptions. Automatic ammo must be
  compatible with the weapon; special cases include blowpipe darts, ballista
  javelins, Karil's bolt racks and Dorgeshuun bone bolts. This group explicitly
  treats every prayer unlock as permanent for every account. Logged Dexterous,
  Arcane and other prayer scrolls are displayed as evidence, not consumed or
  allocated as equipment. Base Prayer/Defence requirements still apply. Other
  crafting/quest prerequisites remain stated assumptions.

## Defaults and finite supply

Defaults compare feasible weapons, refine their leading DPS candidates and test
set combinations, including partial crystal, all three Void styles and regular/elite
mixes, low-HP Dharok, Verac, and Ahrim/Karil with an Amulet of the Damned.
Set-dependent weapons survive the initial shortlist. Known Void, Barrows,
Inquisitor and Blood Moon equipment requirements are checked. Armour choices improve by
coordinate search, retaining relevant set effects rather than pruning them as
ordinary stat items. This is an iterative search, not an exhaustive global
optimiser over every possible team and switch combination.

Identical DPS does not make items interchangeable: max-hit rounding can hide
bonuses. Ties compare damage/Strength, accuracy, prayer and defence bonuses.
Inquisitor's plateskirt's +2 Strength, +12 crush and +2 Prayer therefore remain
visible to allocation; a regression test verifies that it can equip the stronger
account while Blood Moon tassets pass down to a weaker account.

Logged owners get first use of their gear and crafting materials, including
phase switches. Spare copies and unused owned items can then be borrowed in the
displayed order, with Big Dog Aura first for a spare Shadow after its logged owner.
An unused or ineligible preferred loan is released for the other accounts. The initial owner pass reserves one wearable copy per selected
owner and protects ingredient stock; personal components cannot be assembled
for a teammate before their selected owner has first refusal. Loan improvements
rebuild a complete player’s reservations while retaining all other accounts’
physical equipment. Raid party scaling stays fixed during this pass. A held item may be reused by the same player across
phases; different simultaneous players need separate physical copies. Recipes
and dismantles use the same stock engine as the supply ledger. Each candidate
rebuilds its reservations, so replacing armour releases its previous ingredients.

## Slot editor

All eleven OSRS equipment slots are selectable and searchable. The compact
icon panel uses the supplied OSRS equipment image and its slot coordinates,
without exposing unrelated game tabs. Slot names and availability remain in
accessible labels, tooltips and the equipment details list. The picker uses
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

## Non-log rewards

Add non-log gear opens account-specific stock confirmation. MA2 and Mage Arena
II aliases resolve to the same imbued god cape row; its Saradomin, Guthix and
Zamorak variants do not create extra copies. The cape requires 75 Magic. An
explicit personal quantity makes it available only to that account. Shortcuts
also cover Barrows gloves, dragon defender and Ava’s assembler. Blank restores
the unknown log estimate and zero excludes the reward. Optional baseline gear
is still a separate, visible assumption.

## Assembler and blessing inference

Every account owns a normal Ava’s accumulator, as explicitly confirmed for this
group. It requires 50 Ranged, is independent of optional baseline quest/shop
equipment, and can be removed by setting its personal remaining stock to zero.

A personal Vorkath head supports Ava’s assembler via the coin purchase route:
one head, 75 mithril arrows, and either an accumulator or 4,999 coins. Only the
head is a scarce tracked input; coins and common arrows remain stated conditions.
The head is consumed once, a confirmed existing assembler reserves its historical
head, and the cape cannot be created for a teammate using another account’s head.
Crafting can still be disabled and equipping requires 70 Ranged.

Owned god blessings enter automatic ammo-slot selection when that slot is free,
including melee, magic, crystal bows and blowpipes. Ordinary bows and crossbows retain required ammo unless an equipped Dizana’s
quiver stores their arrows or bolts. The worn slot can then hold a blessing; the
engine still receives the stored ammunition’s bonuses and the blessing’s Prayer
bonus. Ballistae, atlatls and Karil’s bolt racks cannot use this quiver exception. Blowpipe darts are
loaded internally and do not overwrite a worn blessing. Each blessing remains
finite, and logged-owner priority applies. Rada’s diary blessings require explicit
personal stock confirmation. Prayer bonus breaks equal-DPS ties; blessings do
not create a damage or accuracy multiplier. Calculation details show total
Equipment Prayer bonus.

Sources: [Vorkath’s head](https://oldschool.runescape.wiki/w/Vorkath%27s_head),
[Prayer equipment](https://oldschool.runescape.wiki/w/Prayer_items), and
[Rada’s blessing](https://oldschool.runescape.wiki/w/Rada%27s_blessing), and
[Dizana’s quiver](https://oldschool.runescape.wiki/w/Dizana%27s_quiver).

## DPS evidence

DPS is expected damage per attack divided by expected ticks × 0.6 seconds.
Expected damage includes accuracy and the full hit distribution; a maximum hit
alone is insufficient. Results expose this mean, the actual expected interval,
maximum attack damage and accuracy. Blood Moon’s speed proc changes the expected
interval, rather than always showing the weapon’s base speed. Equipment-name
comparisons are case-insensitive so capitalisation changes in the Wiki data do
not silently disable supported set effects.

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

## Combat panel, Slayer tasks and Seeking arrows (25 October 2026)

Potions, prayers, ammo, task status and advanced player buffs each have one
control in a shared panel, with separate melee/ranged/magic prayer selectors. Its
Account selector always edits one player. Existing saved team defaults and
overrides are materialised per account; changing or resetting one account cannot
alter another account’s combat settings. Scope changes do not alter settings. Equipment-slot edits remain local to that setup; loaded
blowpipe darts and quiver ammo follow the scoped preset. Existing saved player
overrides persist. The first upgrade migrates the former no-prayer default to
Best; subsequent explicit None choices persist. All other skill requirements
remain enforced.

Task status resolves separately for each player in both ownership and loan
passes. Required-task encounters force matching task status. The upstream target
flag gates actual Slayer effects, including raid phases that do not qualify.
Imbued helmets support melee, ranged and magic; Salve never stacks.

All nine Seeking arrow variants are in the equipment catalogue and ammo presets.
Compatible physical stock competes in the default loadout search, with finite
quantities and owner claims. Preset consumables remain an explicit supply
assumption. Arrow tier compatibility is checked before a preset is applied. The
upstream engine adds +20 bow accuracy and raises accurate damage below three to
three without converting misses. Quiver-projected ammo retains the same effect.
Inquisitor's three armour pieces and mace use actual stats; helm/body/legs supply
0.5%/1%/1% additional accuracy and damage on crush, including partial sets.

Defence inputs describe one shared target for the party. Tonalztics landed hits
and Seercull Magic drain are now exposed alongside the existing reductions.
Numbers recalculate on input or change; the active-input count stays visible in
the section summary. The upstream ordering and target floors are unchanged.

Sources: [Seeking arrows](https://oldschool.runescape.wiki/w/Seeking_arrows),
[Inquisitor armour](https://oldschool.runescape.wiki/w/Inquisitor%27s_armour),
[Slayer helmet (i)](https://oldschool.runescape.wiki/w/Slayer_helmet_(i)),
[prayer unlocks](https://oldschool.runescape.wiki/w/Unlockable_content#Prayers),
and the pinned upstream combat/scaling source served with the site.

## Research-driven comparison and analysis (25 October 2026)

[Research review and primary sources](GEAR-RESEARCH.md) compare the Wiki calculator,
GearScape, RuneTools, CalcOSRS, Skillcape, StatTuner and OSRSPortal. The upstream
Wiki main revision was checked again and still matched the vendored revision;
no competing formula engine or guessed item stats were substituted.

- Encounter/phase controls sit with boss selection. Combat inputs remain in one
  account editor; its reset applies only to the selected account. Cards show the
  actual prayer and boosts applied. Combat edits update equipped-gear DPS directly
  while the worker re-optimises finite equipment. The pending search is labelled,
  and the quick refresh does not reallocate stock.
- The equipment picker previews a one-slot change for the same player, equipped
  armour, stats, buffs and exact NPC phase. It shows actual bonuses, normal DPS
  and delta, plus a stock filter. A weapon can change combat style, but cannot
  silently move the comparison to another raid target. Selecting an item still
  reallocates the whole team; a preview never consumes physical stock.
- Final setups expose actual engine calculation steps and recorded applied
  effects. Direct-damage probability plots include misses at zero and separate
  delayed damage. Unsupported engine effects remain explicit modelling notes.
- Active-attack time is a backward HP-state dynamic program over the upstream
  hit distributions and conditional attack delays. It accounts for overkill,
  supported HP-dependent effects (such as ruby bolts and Vardorvis), and variable
  delays. It counts the full interval of the killing attack. Movement, special
  rotations, defence regeneration and other encounter downtime are excluded.
  Targets above 10,000 HP omit this extra estimate. A forward probability
  propagation test uses freshly constructed calculators at every HP to verify
  the result and catch dropped passives in upstream no-init subcalculations.
- Auto ammo compares ruby and diamond bolts at the currently selected target HP.
  Dragon and ordinary tiers remain separate; a manually chosen or physical ammo
  slot takes precedence. The selected bolt is held for the attack-time estimate;
  auto ammo does not simulate a mid-kill switch. The alternatives and their DPS
  are shown, so snapshot DPS is not presented as a whole-fight optimum.
- Special attacks use the reserved weapon, main armour, saved levels, modifiers
  and main target. Results distinguish mean damage, maximum attack damage and
  energy cost. A damage-only cycle uses one spec per natural energy recovery and
  replaces the equivalent normal-attack time; it is not free extra damage.
  Lightbearer changes that recovery to 15 seconds per 10% energy. Debuff gains,
  Death Charge, adrenaline, movement and overlapping burns are excluded. Ring
  previews can show this cycle beside the normal-DPS tradeoff. Unsupported or
  partially implemented specials are labelled rather than silently treated as
  fully supported.
- Current player HP, Sunfire runes, Charge, and Wilderness Forinthry Surge are
  scoped inputs. God spells were added to the spell selector; invalid ammo and
  spell/weapon combinations produce an unavailable result.
- Black masks are shared tradeable ingredients, including charged log aliases.
  One mask can support an imbued mask or personal Slayer helmet under the
  potential-craft setting. Crafting, Slayer unlock and imbuing costs remain
  explicit extra conditions. Finished headgear stays personal. Owner priority,
  confirmed-finished-craft reservations and legacy personal mask adjustments
  preserve the finite supply.
