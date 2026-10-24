# OSRS Wiki combat engine

Upstream: https://github.com/weirdgloop/osrs-dps-calc

Pinned commit: `98e4fac38b580901cc3f8d485bbaa48bbb3277ed`, retrieved 24 October 2026.

`src/` contains the upstream calculator, equipment handling, scaling, prayer and
potion definitions. Combat formulas are unchanged. `src/lib/Equipment.ts` indexes
immutable equipment aliases and item IDs for repeated calculations; this lookup
change is marked in that file and preserves canonical IDs. `adapter.ts` connects its inputs to the United
Gimps planner. The calculator and adapter are distributed under GPL-3.0; see
[LICENSE](LICENSE). The readable corresponding source is served here alongside
the compiled calculator, and is also tracked in the public site repository.

`cdn/json/` contains the upstream OSRS Wiki equipment, monster and spell data.
Equipment includes the complete upstream catalogue. Monsters are filtered to the
planner's encounters, including alternate phases and encounter adds. Game data is from
the [OSRS Wiki](https://oldschool.runescape.wiki/), under
[CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/).
The data retains upstream stats; no missing stats are invented. `tradeable.json`
is derived from the OSRS Wiki price API mapping retrieved on 24 October 2026:
https://prices.runescape.wiki/api/v1/osrs/mapping. Existing explicit ownership
rules take precedence; items outside that GE mapping default to personal stock.

Build from the site repository root with `pnpm install --frozen-lockfile` then
`node scripts/build_gear_dps.js`. The build removes unused web UI code and stubs
UI-only image imports. Mathematical engine files remain unchanged. Next.js build-time environment checks
are defined explicitly for the standalone browser build. Browser
output is `docs/assets/gear-dps-engine.js`. The project lockfile pins the build
dependencies; d3-array, Axios and lodash.mergewith retain their package licences.

Integration assumptions and verification are documented in
[GEAR-DPS.md](../../GEAR-DPS.md).
