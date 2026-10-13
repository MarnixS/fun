# Goal selection and metric links

Goals offers a visible chooser for every saved WOM skill and boss, including
zero and unranked boss counters. Players can enter an arbitrary target amount,
choose a Collection Log total or exact catalogue item, or write a quest/custom
goal with optional manual progress. Suggested milestones can fill a draft.

The chooser opens the existing protected shared editor. Publishing still
requires the player edit code and preserves the API’s version check and save
semantics. Existing saved goals and edit codes are untouched. There remains
one shared goal per player. Failed publishing retains the selected draft.

Level and XP goals link to Current Stats with the metric and player in the
address; their corresponding charts open automatically. Boss goals link to
KC comparison with the exact boss and player selected, including zero-count
bosses. Those views offer matching Set goal links back to the chooser.
Linked comparison scopes update the banner without rewriting the saved
member filter. Skill-level charts use the individual skill’s level, while
the existing total-level charts retain their overall metric.

Run `node scripts/run_site_audit.js audit_goal_choices.js` for the complete
chooser → protected save → level/KC view → goal chooser flow. It covers all
seven goal types, every tracked skill/boss, target validation, suggested drafts,
failed saves and selection-aware banner state. Existing shared-goal API and UI
tests also verify authorization, concurrency and secret exclusion.

Time Records uses `/time-records`. `xp-records.html` remains an alias with the
new canonical URL; query and fragment state are retained. The record model,
time windows and original icon are unchanged. KC comparison’s current title,
heading and menu have no beta marker; older News entries retain dated history.
