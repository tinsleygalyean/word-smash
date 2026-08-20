# Word Smash — Design Handoff Package

For the Replit/AI build agent. Read alongside the three source documents in the build prompt (container spec, GDD v3.0, levels spreadsheet) — those take precedence on anything functional or packaging-related.

## Contents

- `DESIGN-SPEC.md` — the design contract: layout geometry, palette, type, every gameplay moment's motion/feel rules, timings, budgets, persistence. Start here.
- `screens/` — 16 annotated PNGs, one per moment. Blue dots/dashed lines are annotations, not game art. Numbered per the index at the end of DESIGN-SPEC.md.
- `hammer-strike-sketch/` — an interactive HTML sketch of the hammer strike gesture (open `Hammer Strike Sketch.dc.html` directly in a desktop browser; drag the hammer to the plaque, hold through the swing, or release early to cancel). **It is a feel reference only — do not port its code**; it uses network fonts and synth audio that the production game must not.

## How to use

1. Implement against DESIGN-SPEC.md rule by rule; the PNGs disambiguate anything words leave open.
2. Reproduce the hammer-strike feel from the sketch using the tuning values in DESIGN-SPEC §3.
3. Where this package is silent, fall back to the GDD; where it conflicts with the container spec or GDD's functional requirements, those win — log the conflict in DECISIONS.md.
