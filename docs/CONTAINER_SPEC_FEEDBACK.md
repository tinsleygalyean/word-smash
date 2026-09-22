# Handoff: requested clarifications to the Third-Party Game Developer Spec §6

**To:** Curious Reader container & data teams
**From:** Word Smash team
**Date:** 2026-09-06
**Spec under review:** Third-Party Game Developer Specification **v1.7**
(2026-08-19), section 6 — *Data reporting: the `cr_event` contract*

We implemented §6 in full for Word Smash and audited it against the spec. The
contract worked as written; these four items are places where the spec is
**silent or ambiguous**, and each one either cost us real debugging or is a
latent data bug for the next team. Items 2 and 3 are documentation changes;
items 1 and 4 each need a small container change as well.

Nothing here blocks Word Smash shipping. Items 3 and 4 do, however, mean that
two of the four numbers in our lifetime summary document are currently not
answerable — see each section for what we send today.

| # | Request | Kind | Priority |
|---|---|---|---|
| 1 | Make oversize/invalid envelopes visible to the game developer | Container + spec | **High** |
| 2 | Codify `sub_app_id` = the game's slug | Spec only | Medium |
| 3 | State how `summary_data` behaves for a multi-language install | Spec only | **High** |
| 4 | No way to express "furthest level reached" — `replace` cannot take a max | Container + spec | **High** |

---

## 1. A game cannot tell that its envelope was rejected

**What the spec says now.** §6.1: *"One envelope per message. **Max 64 KB** per
message (oversize is rejected whole)."* §6.5 lists "exceed 64 KB" under MUST
NOT. The §7d checklist asks the developer to confirm *"Envelope sizes stay far
below 64 KB."*

**The problem.** §6.1 also requires reporting be fire-and-forget and never
awaited, and `postMessage` returns nothing. So a game that exceeds the cap — or
sends a malformed envelope, or an unlisted `collection` — gets **no signal at
all**. The event silently never lands. The §7d checklist asks the developer to
verify size, but gives them no mechanism beyond eyeballing a logged JSON string
in a browser run, which will not catch a payload that only grows large on a real
device with real content.

This is the one part of §6 where a mistake is both easy and invisible. Compare
§1, which handles the analogous case well: an outbound network call *"shows up
in the container's diagnostic log as a `NETGUARD_BLOCK` entry."* Reporting
rejections deserve the same treatment.

**Requested change.**

1. **Container:** when an envelope is rejected — oversize, malformed, unknown
   `collection`, missing required field — write a diagnostic-log entry naming
   the reason, the `sub_app_id`, and the byte size. A `CR_EVENT_REJECT` entry
   parallel to `NETGUARD_BLOCK` would fit the existing model exactly.
2. **Spec §6.1:** state that rejections are silent to the game and name the
   diagnostic-log entry a developer should look for.
3. **Spec §6.4:** add a size guard to the reference implementation, so the
   default a team copies is already safe. Something like:

   ```ts
   const json = JSON.stringify({ type: 'cr_event', payload });
   // 64 KB cap (§6.1). Oversize is rejected whole and silently, so drop it
   // here where a developer can at least see why.
   if (new Blob([json]).size > 64 * 1024) {
     console.warn('cr_event dropped: over the 64 KB cap', payload.data?.type);
     return;
   }
   window.ReactNativeWebView.postMessage(json);
   ```

4. **Spec §7d:** replace *"Envelope sizes stay far below 64 KB"* with a check a
   developer can actually perform — e.g. confirm the guard exists, and confirm
   no `CR_EVENT_REJECT` entries appear during the in-container pass.

**Why it matters.** Word Smash payloads are ~300 bytes, so we are far from the
cap today. But `data` is explicitly open-ended (§6.2: *"New fields may be added
anytime without coordination"*), so any game that starts attaching per-word
detail, error lists, or a session trace can cross 64 KB with no warning and lose
data silently — and would have no way to discover it.

---

## 2. Codify `sub_app_id` = the game's slug

**What the spec says now.** §6.2: *"Stable lowercase game identifier, agreed
with the Curious Learning data team; never changes between releases."*

**The problem.** "Agreed with the data team" makes every new game a
coordination step, and leaves the value arbitrary. In practice there is already
a natural, stable identifier: the **game slug** used for packaging and upload —
the `engineSlug` in §8 and the ZIP name prefix in §5.

**Requested change.** In §6.2, state the convention:

> `sub_app_id` — the game's slug: the same lowercase identifier used as the
> `engineSlug` for packaging and upload (§5, §8). For a game whose engine ZIP is
> `wordsmash-eng.zip`, `sub_app_id` is `wordsmash`. Confirm it with the data
> team, but the slug is the default and it never changes between releases.

**Why it matters.** It removes a negotiation, makes the value predictable for
warehouse queries, and creates an invariant that is mechanically checkable —
`sub_app_id` must equal the engine slug. Word Smash already satisfies it
(`sub_app_id: 'wordsmash'` in the game, `ENGINE_SLUG = "wordsmash"` in both the
packager and the uploader), but only because we chose to; the spec did not ask
for it.

---

## 3. How does `summary_data` behave when two language packs are installed?

**What the spec says now.** §6.3: *"**`summary_data`** — one lifetime-aggregate
document per user per game."* The document key is therefore
`(cr_user_id, sub_app_id)`. §6.3 also gives `data` conventions for
`user_sessions_data` — *"always include `type` … and `lang`"* — but states no
`lang` convention for `summary_data`.

**The problem.** The container ships one engine plus **one language pack per
language** (§5). A single device can therefore have a game installed in two
languages for the same child. With the document keyed only by user and game:

- `user_sessions_data` is fine. Every record carries `lang`, so the warehouse
  can group by language.
- `summary_data` **cannot** separate languages. English and Swahili play merge
  into one lifetime document. Adding `lang` to `data` does not fix this: with
  `"replace"` it records only the most recently played language, and with
  `"add"` it is meaningless.

So `levels_played` for a bilingual child is a number with no defined meaning —
it is neither the English count nor the Swahili count.

**Requested change.** Pick one and document it in §6.3. We have no stake in
which; we need to know which:

- **(a) Key the document by language** — `(cr_user_id, sub_app_id, lang)` — and
  require `lang` in `summary_data.data`. Cleanest for analysis; changes the
  container's document key.
- **(b) Declare `summary_data` cross-language on purpose** and state plainly
  that per-language aggregates must be derived from `user_sessions_data`. No
  container change; needs one explicit sentence so nobody assumes otherwise.
- **(c) Namespace the fields per language** (`levels_played_english`). Works
  within the current contract but we would not recommend it — unbounded field
  names, awkward queries.

**Why it matters.** This is silent data corruption in a lifetime-aggregate
collection: wrong numbers accumulate and cannot be reconstructed after the fact
from the summary document alone. Curious Learning's whole premise is
multi-language deployment, so bilingual children are the norm, not an edge case.

**What we did meanwhile.** We now stamp `lang` on **every** payload in both
collections, including `summary_data` (as `"replace"`), so the language is at
least always present in the record. If you choose **(a)**, our payloads already
carry what you need.

---

## 4. Nothing in `summary_data` can answer "how far did this child get?"

**What the spec says now.** §6.3's worked example is
`{ levels_played: "add", total_time_played: "add", last_level_number: "replace" }`.
Those are the only two merge operations: `"add"` and `"replace"`.

**The problem.** Two distinct questions get conflated by these field names, and
neither field answers the one the programme team will actually ask.

- **`levels_played` is a completion counter and is unbounded.** It is not a
  progress indicator. In Word Smash it exceeds the level count routinely:
  our final level refills its word queue when every word is done, so a child who
  keeps playing at level 10 accumulates `levels_played` 11, 12, 13… while never
  advancing. A progress reset (our `?reset=1`, or the child's app data being
  cleared) restarts at level 1 and keeps adding. A child with
  `levels_played: 47` may have reached level 6.
- **`last_level_number` is the *latest* level, not the *maximum*.** Because it
  merges with `"replace"`, it tracks recency and **can go down**: after a reset
  the next completion writes `1` over a previous `10`. It cannot be used as a
  furthest-progress measure.

So a lifetime document can currently say a child played 47 levels and is on
level 1, and both numbers are correct — while the actual answer, "reached level
6", appears nowhere.

**Requested change.** Either:

- **(a) Add a `"max"` merge operation** alongside `"add"` and `"replace"`. Then a
  game sends `max_level_reached` with `"max"` and the container keeps the
  high-water mark. This is the robust fix: it survives resets, reinstalls, and
  out-of-order syncing, none of which the game can compensate for. It is also
  the natural third operation for a merge-based aggregate store, and would serve
  any game with a notion of progress.
- **(b) If a new operation is out of scope,** say plainly in §6.3 that furthest
  progress must be derived warehouse-side as `MAX(level)` over
  `level_completed` records in `user_sessions_data`, and rename or annotate
  `last_level_number` so nobody reads it as a maximum.

Either way, please add one line to §6.3 stating that `levels_played` counts
completions and is not a progress measure.

**Why we cannot solve this game-side.** We considered sending
`max_level_reached` ourselves with `"replace"`, computing the max locally. It
does not work, and would make things worse: our reset clears all local storage,
so a post-reset session genuinely does not know the child ever reached level 10,
and `"replace"` would then overwrite the stored 10 with a 1. A high-water mark
is only safe if the side that *holds* the history computes it — which is the
container, or the warehouse. We have therefore sent nothing rather than send
something misleading.

**What we do send today.** `levels_played` (add, `1` per completion),
`last_level_number` (replace), and every `level_completed` record in
`user_sessions_data` carries its `level` — so option **(b)** is already
computable from our data, and option **(a)** would need one extra field from us.

---

## For completeness: two bugs on our side, not yours

Raised only because both came from the spec being read reasonably but wrongly,
so a worked example in §6.3 may help the next team.

1. **We sent the level number where a delta was required.** §6.3's example shows
   `"levels_played": 1` with `"add"`, but the prose does not say that `add`
   fields must be per-event deltas. We passed the level number, so finishing
   levels 1–10 reported `levels_played: 55`. Fixed.
2. **We re-sent a lifetime total as an `add` delta.** Our `words_completed`
   passed a cumulative map size, so lifetime totals grew quadratically —
   330 instead of 60 over ten levels. Fixed.

A single explicit sentence in §6.3 — *"every `add` field carries the delta for
this event, never a running total"* — would prevent both. We would happily
review a draft.

---

## Next step

Happy to jump on a call, or to open a PR against the spec with the §6.1, §6.2,
§6.3 and §7d wording if you would rather review a diff. Items **1** and **4**
need container work; **2** and **3** are documentation decisions.

Our implementation is in
[`artifacts/word-smash/src/game/events.ts`](../artifacts/word-smash/src/game/events.ts)
if a reference is useful, with the contract's own rules covered by test cases
TC-EVT-01..06 in [`docs/specs/TESTSPEC.md`](specs/TESTSPEC.md).
