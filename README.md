# Monkey Brewery: OPM 301

A cozy 2D browser game for learning OPM 301 (Operations Management, Production part) by running Bruno's brewery.

## Play

- **Mac or Windows, no install:** double-click `PLAY Monkey Brewery.html` (or `dist/index.html`). It opens in Chrome, Safari or Edge. Progress is saved in that browser.
- **From GitHub:** click **Code → Download ZIP**, unzip it, and double-click `PLAY Monkey Brewery.html`. No install or build needed; the playable game is in `dist/`.
- **Share with classmates:** upload the whole `dist` folder to any static host (GitHub Pages, Netlify, a university web space). From there it can be installed as an app via the browser's "Install" button and works offline.

## New in v0.4

- **World 4, Barrel Cellar (aggregate planning), 8 levels:** production/cost tables over time, laid out like the lecture: $d_t$, $X_t$, $L_t$, $O_t$, $B_t$, inventory, overtime and backlog costs, and a sum column.
  - Uses the lecture example: 8 periods, $c = 750$, $k^l = 22$, $k^o = 72$. Chase costs 59,760, level 33,220, and the optimum 30,940.
  - Also covers the price shock ($k^o = 32$ / 112) and backlog ($k^b = 18$ → 30,700).
  - A chart shows production (striped = overtime), demand ticks, the capacity line and inventory.
  - **Beat the Planner** is a mission: type the plan and submit it. Par comes from an exact solver (min-cost flow). Par = perfect, beating the best simple rule = good enough, a shortage = too little.
- **World 5, Kettle Room (lot sizing with setup costs), 7 levels:** setup toggles $\Gamma_t$ and setup costs $s$.
  - Uses the lecture example: 10 periods, $c = 150$, $s = 100$, $k^l = 1$. Lot-for-lot costs 1,000, lot size = capacity 900, and the optimum 580.
  - Also covers effective production time (83.33%), the big-M model, sensitivity questions (answered by the solver) and two products.
  - An exact dynamic program gives par.
- **Models & notation:** the lecture's models in the slides' notation (indices, parameters, decision variables, objective, constraints), with a note on why each constraint exists.
  - Models: project selection, aggregate planning with and without backlog, lot sizing, and multi-product lot sizing.
  - Plus a symbol table and a formula sheet grouped by topic.
- **Sandbox → Season planner / Lot sizing:** free tables with editable $c$, $k^l$, $k^o$, $k^b$, $s$ and demand. The Factory Yard's new "Plan a season with this hall" link opens the season planner at your hall's capacity.
- **Formula fixes:**
  - Formulas shrink to fit their box instead of being cut off.
  - Long ones are split over two lines.
  - Punctuation stays next to its formula.
  - Chart legends no longer break KaTeX.
  - Art text uses an embedded Nunito subset, so it looks the same on Mac and Windows.
- Wide tables and charts scroll inside their card on phones.

## What was in v0.3

- **Production line (the heart of the game):** mash, then ferment, then bottle, with 0.5 s transfers. It is pipelined: as soon as the mash tun hands a batch over, it starts the next one. The timing comes straight from the model: time = batch ÷ capacity × 3600 (0.1 L at 60 / 40 / 50 L/h gives 6 s / 9 s / 7.2 s).
  - Waiting batches pile up in front of the bottleneck. The buffer is unlimited by default, or you pick **My size**. With a full buffer, the machine before it is **blocked**.
  - You can add a 2nd machine per stage, change capacities and order size, and play at 1× / 2× / 4× (playback only; simulated times stay the same).
  - Charts: batches waiting over time, machine time split into working / blocked / idle, and KPIs (output rate, steady pace, process capacity). A table compares your runs.
- **World 1, Tasting Lounge:** OPM basics and the Variability Cube (course axes: uncertainty horizontal, dynamics vertical, heterogeneity depth).
- **World 2, Brewhouse:** process analysis, with 7 levels built around the production line and the lecture's knife-line numbers (26 min, 6/h, 80/100/50/20/10 %).
- **Factory Yard (new world 7):** a top-down production hall in a simple Factorio style. Choose from six machines (small or large, per stage), place them in the mash, ferment and bottle zones, add barrels as buffers, and watch batches ride the conveyor from the grain silo to the shipping truck.
  - The capacity chart updates as you build: stage capacity against demand, plus the process capacity.
  - **Test the shift** runs 90 simulated minutes: a 30-minute warm-up, then one measured hour. Machines that are blocked turn red, and work piles up in front of the bottleneck.
  - 4 missions (30, 60, 90 and 80 L/h). Each has a budget and limited floor space. The goal is to meet demand at the lowest cost, and a solver knows the cheapest plan: cheapest = perfect, within 15% = good enough, overbuilt = too much, short of demand = too little.
  - **Free build** has no budget and lets you set any demand.
- **Outcomes and cutscenes:** perfect (beach), good enough (banana), too much, too little (pink slip), bottleneck fail (wort surfing) and wrong classification. Cutscenes can be skipped, and each one is followed by a "What happened?" card with the numbers.
- **Study desk:** flashcards with spaced repetition, a formula sheet and a glossary. Also included: sandbox, mastery, settings (theme, soda mode, reduced motion, skip cutscenes, practice mode that unlocks everything).
- **Design (v0.3):** one slim top bar with navigation (no floating dock), a dimmed room backdrop, and clean inked cards.
- Worlds 3 and 6, Exam drill, Duel, Study room and Leaderboard show "coming soon".

## Develop

```bash
npm install
npm run dev          # local dev server
npm test             # formula, simulation and content tests
npm run build        # builds dist/ (single-file index.html + dist/assets)
npm run import-assets  # re-copy art from ../Monkey-Brewery-Redesign-v2
python3 scripts/embed-svg-fonts.py   # re-run after import-assets (needs fonttools + brotli)
```

- Game content (levels, questions, hints, worked solutions) lives in `src/content/world*.ts`. A new lecture means adding a new world file.
- The formulas are in `src/engine/opm.ts`. The production-line simulation is `src/engine/line.ts` (a discrete-event model; tests in `line.test.ts`).
- The Factory Yard engine (machines, missions, best-plan solver) is in `src/engine/factory.ts`, and its sprites are in `src/components/factory/`.
- Planning (worlds 4 + 5) is in `src/engine/planning.ts`: table evaluation, chase/level/lot-for-lot rules, exact solvers and verdicts (tests reproduce every lecture number in `planning.test.ts`). The tables and charts are in `src/components/planning/PlanTable.tsx`, and the lecture models are in `src/content/models.ts`.
- Text in `src/content` can contain inline formulas written as `$...$`, plus `**bold**` and `*italic*`.
- The art comes from the Astra v2 package. Machine artwork is extracted into `src/components/production/art.ts`.
