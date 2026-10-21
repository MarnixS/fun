# Historical skill snapshots

Owner-supplied screenshots are imported into the shared WOM-shaped snapshot history. All pages use that same history, including Time Machine, Timeline, Stat Progress, records and milestone reconstruction. Current profiles remain the latest genuine WOM profiles.

Defaults for future screenshots:

- Player: **Big Dog Aura**, unless the owner specifies another member. Older account names in the RuneLite title do not change that mapping.
- XP: the **minimum XP required for the base skill level**, using the shared OSRS level table. Never generate random XP.
- Date: the owner's date takes precedence over the screenshot overlay. A date without a time has day precision; midnight is only its storage key.
- Read the base level below the slash, not a temporarily boosted or drained current value.
- An obscured skill can retain its closest earlier known value from either a screenshot or a WOM snapshot when instructed. Record the source date and mark it as assumed; retain the independently visible total level, and expose any levels that cannot be assigned to individual skills.
- Do not invent boss kills, activity scores, ranks, Sailing levels before release, or efficiency hours.

Edit `docs/data/historical-snapshots.json`, then run:

```sh
node scripts/import_historical_snapshots.js
node scripts/test_historical_snapshots.js
```

The importer is deterministic, checks all 23 historical skills and visible totals, updates snapshot counts, and is safe to run repeatedly. Genuine snapshots at the same timestamp remain authoritative. Both the shared refresh merger and the full-history backfill retain old screenshot rows.

XP ranges preserve the uncertainty hidden by minimum-XP display values. Record proofs subtract the maximum possible starting counter from the minimum possible ending counter. Later real observations tighten those ranges. Date-only observations allow any time within their day before selecting a record window. These rules prevent estimated baselines from manufacturing guaranteed records.
