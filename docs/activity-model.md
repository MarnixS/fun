# Activity Eras: how the inference works

This model describes the strongest evidence in saved WOM snapshots. It cannot recover actual login time, quests, bankstanding, unrecorded minigames, or the order of activities between snapshots. Model percentages are **activity-weight shares**, never measured playtime.

## Sources and weighting

Rate data retrieved 17 September 2026 from Wise Old Man's public ironman configuration:

- [Boss efficiency rates](https://wiseoldman.net/ehb/ironman): kill counts divided by the corresponding boss rate. Ten Chambers of Xeric completions therefore carry more weight than ten Brutus kills.
- [Skill efficiency configuration](https://github.com/wise-old-man/wise-old-man/blob/master/server/src/api/modules/efficiency/configs/ehp/ironman.ehp.ts): XP changes integrated across level-dependent rate bands.
- [WOM efficiency algorithm](https://github.com/wise-old-man/wise-old-man/blob/master/server/src/api/modules/efficiency/EfficiencyAlgorithm.ts): EHP includes bonus XP allocation and efficient training assumptions. Direct changes in stored EHP are therefore unsuitable as literal historical time measurements.

A frozen local rate table is used for both endpoints. Loading or navigating the website makes no new WOM request and cannot silently change these rates. We intentionally do not reproduce WOM's cross-skill bonus allocation as historical fact. Rates based on zero-time multiskilling use a positive fallback: Woodcutting 60k XP/h, Construction 150k, otherwise 100k. Unknown skills use 100k. Combat skills use 100k XP/h as a comparison proxy; Hitpoints does not independently add weight. These fallbacks are model assumptions, not verified player methods.

WOM does not assign EHB to every skilling boss. Wintertodt, Tempoross and Zalcano use approximate comparison rates of 12, 10 and 20 kills per hour. Other unlisted bosses use 30. Any period containing such a boss is marked as using approximate rates.

## Avoiding double counting

- Boss kills and Slayer are stronger evidence of an activity than the combat XP that accompanies them.
- A deliberately generous allowance of up to 600k combined combat XP per efficient boss-hour, plus four combat XP per Slayer XP, is treated as possibly accompanying those activities. This is a heuristic envelope, **not** an assertion about a boss's actual XP reward. The remaining combat XP retains weight. One incidental kill cannot hide millions of training XP. Different gear, group sizes, XP modifiers and untracked activities remain uncertain.
- Slayer weight overlapping task-only bosses is reduced by at most those bosses' weight. This applies to Sire, Hydra, Araxxor, Cerberus, Grotesque Guardians, Kraken and Thermonuclear Smoke Devil. Additional Slayer stays visible.
- Wintertodt, Tempoross and Zalcano overlap their primary skills. At most twice their boss weight absorbs skill weight, and the combined weight is the larger of the two overlapping signals, not their sum. Excess skill XP stays independent. Hespori does **not** absorb tree-run Farming XP.
- Every observed XP, level and KC gain is retained in the expandable evidence, including supporting XP. The weighting never alters saved data or other pages' statistics.

These are transparent modelling choices, not official WOM labels. A different method or rate can change close classifications. A named focus needs 60% of total model weight. A category needs 65%; a leading activity within that category can be shown as “mainly”. Otherwise the label names the competing categories, or varied skilling/bossing. A clear lead requires 75%, a likely focus 60%; small samples under two weighted hours and incomplete evidence are identified separately.

## Time boundaries and uncertainty

Weekly windows are the default; fortnightly and monthly comparisons are also available. Windows end on actual snapshots, not invented intermediate dates. Neighbouring windows merge only if their classification agrees and at least 70% of their normalized activity weight overlaps. Joined eras are capped at six weeks.

A gap over 21 days stands alone as sparse history. The model may show the accumulated gains, but does not claim a single continuous grind. No gains means **no recorded gains**, not that the player was offline. Unknown/negative baselines and decreasing counters do not invent gains. Duplicate timestamps are resolved deterministically for a given input; equal timestamp conflicts retain the last supplied snapshot.

## Skill contribution charts

The XP and level pies use current saved totals for the selected members. XP share is each member's XP divided by their combined XP in that skill. Level share is the displayed skill level divided by the sum of those levels. Levels are nonlinear with XP, so the two pies answer different questions; neither measures time played. Unknown values are excluded, zero XP contributes no slice, and exact values remain available in the table.
