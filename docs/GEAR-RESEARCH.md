# Gear and DPS research review

Reviewed 25 October 2026. This is a comparison of seven relevant public tools and
their published functionality, followed by item-rule checks. It is not a claim
that every calculator or item effect on the internet has been independently
verified. Runtime arithmetic remains the OSRS Wiki engine, pinned to
`98e4fac38b580901cc3f8d485bbaa48bbb3277ed`; the upstream main revision still
matched when checked for this release.

| Primary source | Useful pattern or evidence | Planner implementation |
| --- | --- | --- |
| [OSRS Wiki calculator](https://tools.runescape.wiki/osrs-dps/) and [source](https://github.com/weirdgloop/osrs-dps-calc) | Actual equipment, target scaling, distributions, conditional effects, specs and calculation traces | Retained the engine; exposed traces, special results and actual hit distributions. Source remains served with the bundle. |
| [GearScape](https://gearscape.net/) | Gear search constrained by stats, exclusions and preferences; compare setups | One-slot DPS previews against the same target, with owned/acquired filters and finite group allocation. No assumption that every account owns the same BIS kit. |
| [RuneTools](https://runetools.com/calculators/dps) | Setup/target comparisons, special energy, defence drains, overkill-aware kill-time presentation | Distinguished snapshot DPS, attack-time estimates and damage-only spec cycles. Published feature descriptions informed the interface; claimed numerical parity was not treated as an independent proof. |
| [CalcOSRS](https://calcosrs.com/combat/dps/) | Roll details, hit distributions, spec results and target reductions | Exact steps and distributions sit inside result details; actual landed drains remain separate from merely owning a spec weapon. |
| [Skillcape](https://skillcape.app/dps) | One target, full equipment, visible rolls and explicit unsupported effects | Controlled same-target comparisons and explicit unavailable/partial/unsupported results. |
| [StatTuner](https://stattuner.com/osrs/) | A/B comparisons that hold target and inputs fixed | Changing a weapon in the picker cannot silently move its preview to a different raid phase. |
| [OSRSPortal](https://www.osrsportal.com/dps-calc) | Published examples of Void, dragonbane, Slayer/Salve, multi-hit weapons and target caps | Useful coverage checklist; its published changelog is older, so it did not replace current Wiki formulas or item data. |

## Item rules checked and implemented

- [Slayer helmet (i)](https://oldschool.runescape.wiki/w/Slayer_helmet_(i)):
  shared black masks can support personal completed headgear; assembly and
  imbuing are separate stated conditions. One finite mask cannot create two
  simultaneous pieces. Imbued helmets support ranged/magic task bonuses; Salve
  does not stack. Charged mask aliases do not create extra copies.
- [Ruby bolts](https://oldschool.runescape.wiki/w/Ruby_bolts_(e)) and
  [diamond bolts](https://oldschool.runescape.wiki/w/Diamond_bolts_(e)):
  current target HP and accuracy change which option is stronger. The scoped
  Auto preset compares compatible variants at the selected HP, while manual
  ammo remains authoritative. A whole-fight bolt-switch policy is not claimed.
- [Lightbearer](https://oldschool.runescape.wiki/w/Lightbearer) and
  [special energy](https://oldschool.runescape.wiki/w/Special_attacks):
  10% natural recovery per 15 seconds with the ring, otherwise 30 seconds.
  Specs replace attack time in the damage-only cycle; they are not added as free
  DPS. Utility, defence-drain benefits and other regeneration sources remain
  separate from that estimate.
- [Dharok](https://oldschool.runescape.wiki/w/Dharok_the_Wretched%27s_equipment),
  [Sunfire runes](https://oldschool.runescape.wiki/w/Sunfire_rune), and
  [Charge](https://oldschool.runescape.wiki/w/Charge):
  the adapter now exposes current player HP and those engine-supported buffs.
  God spells have selectable entries; invalid spell/weapon combinations do not
  produce an apparently valid zero-DPS setup.
- Existing Inquisitor partial sets, Blood Moon attack delays, crystal/void,
  Seeking arrows, Fang, Scythe, dragonbane and other effects remain evaluated by
  the upstream engine. Applied-effect traces show the recorded calculation
  stages; the list is not a claim that every possible game effect is supported.

## Complete-set search and account settings

The engine already evaluated complete-set effects, but the iterative optimiser
could miss them by changing one piece at a time. Reproduced inventories exposed
missed low-HP Dharok, mixed regular/elite melee Void and elite magic Void upgrades.
The search now seeds these combinations, Verac, and Ahrim/Karil with an
[Amulet of the Damned](https://oldschool.runescape.wiki/w/Amulet_of_the_damned).
Set-dependent weapons survive the initial weapon shortlist. Mixed regular/elite
Void grants the base effect; elite-specific damage still requires both elite
body/legs. The engine determines the actual damage rather than a set-name score.

Equipment checks now include [Void](https://oldschool.runescape.wiki/w/Void_Knight_equipment)
(42 combat stats including HP, 22 Prayer), relevant Barrows armour/weapons,
[Inquisitor](https://oldschool.runescape.wiki/w/Inquisitor%27s_armour) (70 Strength,
30 Defence; mace 80 Attack), and
[Blood Moon](https://oldschool.runescape.wiki/w/Blood_Moon_armour) (75 Strength,
50 Defence; macuahuitl also 70 Attack). Elite diary/unlock conditions remain
ownership conditions rather than being inferred from combat levels alone.

Every account has separate combat settings, including one prayer selection per
style. Existing saved team defaults are materialised per account before editing.
The chosen account's settings cannot change another account's buffs. Landed
defence reductions still describe the shared monster. A direct recalculation of
current gear updates damage while the worker searches for better legal gear;
it does not alter the finite inventory. Cards state their actual prayers/boosts.

Two group-confirmed rules are explicit: Big Dog Aura has first refusal on a spare
Shadow after logged owners, and each account owns an
[Ava's accumulator](https://oldschool.runescape.wiki/w/Ava%27s_accumulator).
Accumulators retain their 50 Ranged requirement and explicit stock-zero override.
Personal Vorkath-head assembler crafts still consume one tracked head and check
70 Ranged. These assumptions do not grant other non-log quest rewards.

`test_gear_accounts.js` checks these ownership rules, independent account/style
prayers, immutable refresh and the previously missed complete-set upgrades.
The UI audit also checks legacy migration, persistence, account filtering and
flushing unfinished numeric edits to the correct account.

## Additional checks and combined insights

A dropped lookup in our case-insensitive item compatibility patch affected
upstream no-init subcalculations. The patch now hydrates that lookup from the
copied equipment list, retaining passive effects in nested calculations.

Expected active-attack time uses a backward HP-state dynamic program over the
upstream conditional hit distributions and attack delays. An independent forward
probability propagation test reconstructs a fresh calculator at each HP and
checks agreement. This catches lost equipment effects as HP falls, rather than
only matching one headline DPS number. The estimate includes overkill and the
full killing-attack interval, but excludes movement, mechanics downtime, defence
regeneration, poison/venom additions and special rotations.

The main benefit of combining the tools' approaches is a fair comparison under
real group constraints: stock/owner priority stays intact, a candidate's normal
DPS is visible, and utility such as Lightbearer can be assessed through a separate
spec-cycle estimate. Neither a colourful stock badge nor a high max hit is used
as a substitute for the actual player/gear/target calculation.

Validation: `pnpm test:gear`, including `scripts/test_gear_mechanics.js` for
probability sums, overkill, nested HP effects, Scythe, Dharok, Sunfire, Charge,
spell compatibility, adaptive/locked ammo, special energy, Lightbearer, finite
masks, legacy stock adjustments and immutable same-target comparisons. Static
page generation, resources, script order and exact engine-bundle reproduction
are checked separately.
