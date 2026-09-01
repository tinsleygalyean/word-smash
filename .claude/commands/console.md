---
description: Open the Word Smash console — run the pipeline commands and preview the game in a phone-landscape frame
allowed-tools: Bash, mcp__Claude_Browser__preview_start, mcp__Claude_Browser__navigate, mcp__Claude_Browser__computer, mcp__Claude_Browser__read_console_messages
---

Start the Word Smash console and show it to the user.

1. Check whether it is already running before starting a second copy:

   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://localhost:23522/api/state
   ```

   A `200` means it is already up — skip to step 3.

2. If it is not running, start it in the background and wait for it to answer:

   ```bash
   pnpm game:console -- --no-open
   ```

   Run it with `run_in_background: true`. It stays up until stopped.
   `--no-open` is deliberate: this command opens the Browser pane itself, so the
   script should not also launch the user's external browser.

3. Open `http://localhost:23522/` in the Browser pane with `preview_start`, then
   take one screenshot so the user can see it.

4. Tell the user in one or two lines what they can do: pick a language, run any
   of the four commands, and watch the preview in the phone-landscape frame.
   Do not re-explain the whole pipeline — it is documented in
   `docs/CONTENT_PIPELINE.md`.

$ARGUMENTS may name a language (for example `english`). If given, mention that
they should select it in the dropdown; the console does not take it as a flag.

Notes:

- The console runs the CMS upload as a **dry run only**. If the user asks for a
  real upload, do not try to force it through the console — a live upload is
  `pnpm game:upload -- --live` in a terminal, which requires a typed
  confirmation and the credentials in `.env`. That approval gate is deliberate.
- Never read, print, or echo the contents of `.env`.
- If the port is taken by something else, start it on another port with
  `pnpm game:console -- --no-open --port <n>` and open that instead.
