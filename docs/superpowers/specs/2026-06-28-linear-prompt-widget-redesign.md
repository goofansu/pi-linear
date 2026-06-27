# Linear Prompt Widget Redesign

## Goal

Rewrite `pi-linear` as a focused prompt-context extension modeled after `prompt-url-widget.ts`. When a user starts a prompt with a Linear issue reference, the extension fetches that issue, injects the issue details into model context, and shows a compact widget in the TUI.

## Trigger

The extension recognizes user prompts matching this shape:

```text
Analyze Linear issue: LIN-123
```

Matching should be case-insensitive for the prefix and should trim surrounding whitespace. The issue id is the first non-whitespace token after the colon, so `Analyze Linear issue: LIN-123 please review` targets `LIN-123`.

The extension does not trigger on arbitrary issue ids in normal prose.

## Context Injection

On `before_agent_start`, when the trigger matches, the extension fetches the issue through `@linear/sdk` using `LINEAR_API_KEY` and injects one custom message into the turn context.

The injected message contains Markdown with:

- issue URL
- identifier and title
- branch name, if present
- description, or `No description.` when absent
- attachments as a list of `title — url`, when present

Attachment contents are not downloaded. Attachments are treated as linked metadata only.

## Visible UI

When a matching prompt is detected, the extension sets a widget above the editor similar to `prompt-url-widget.ts`.

The loaded widget displays:

- issue identifier and title
- branch name, if present
- attachment count, if greater than zero
- issue URL

While loading, the widget may show the issue id. If loading fails, the widget shows a compact error state.

The extension also sets the session name when the current session name is empty or still the raw fallback name. The preferred format is:

```text
Linear: LIN-123 Fix login redirect
```

## Scope

Remove the broad multi-action `linear` tool. The redesigned package is a single focused extension for Linear issue prompt context and display.

Keep the package dependency on `@linear/sdk`; keep `typebox` only if still needed after the rewrite.

## Error Handling

- If `LINEAR_API_KEY` is missing, warn on `session_start` and show a clear error state for matching prompts.
- If Linear fetch fails, show a notification/widget error and allow the original prompt to continue without injected issue details.
- Errors must not block unrelated prompts.

## Session Restore

On `session_start`, rebuild UI state only when `ctx.hasUI` is true. Inspect prior user messages in the active session branch with `ctx.sessionManager.getBranch()`, iterate backward by index, and stop at the first matching user prompt. This avoids scanning inactive branches and avoids allocating a reversed copy of the entries.

If the latest matching user prompt is found, rebuild the widget and session name by fetching the issue again. If no match exists, clear the Linear widget. Do not fetch Linear during restore unless a matching prompt is found.

## Tests

Tests should cover:

- prompt matching and non-matching inputs
- Markdown context formatting, including branch name and attachments
- missing description fallback
- widget/session behavior with an injected mock Linear client
- missing API key warning
- fetch failure behavior
- absence of the old `linear` tool registration
