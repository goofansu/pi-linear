# pi-linear

Inject Linear issue context into Pi prompts and display a compact Linear issue widget.

## Install

```bash
pi install https://github.com/goofansu/pi-linear
```

After installation, Pi watches for prompts shaped like:

```text
Analyze Linear issue: LIN-123
```

When the prompt matches, the extension fetches the Linear issue, injects its URL, title, description, branch name, and attachment links into the model context, and displays a widget above the editor.

## Configuration

Set `LINEAR_API_KEY` to a Linear personal API key from <https://linear.app/settings/api>.

## Attachment behavior

Linear attachments are injected as linked metadata only:

```md
- Design spec — https://example.com/spec
```

The extension does not download or inline attachment contents.
