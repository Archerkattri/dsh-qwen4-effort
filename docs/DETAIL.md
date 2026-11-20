# Qwen4 effort levels

Fills the official effort levels into Qwen4 models on the Qwen Token Plan routes
you already configured. No new provider is created.

## Official levels (Alibaba Cloud Model Studio, Nov 2026)

| Model | Levels | Default |
|---|---|---|
| `qwen4-max-preview` | low, medium, xhigh | xhigh |
| `qwen4-max` family | low, high, xhigh | high |

## What it does

- Scans the profile's `llm-pi-ai` configuration at activation.
- For each `qwen4*` model without `reasoningEfforts`, adds its family's official
  levels and the Qwen wire switches (`thinkingFormat: qwen`,
  `supportsDeveloperRole: false`, `supportsStore: false`,
  `supportsReasoningEffort: true`, `supportsStrictMode: true`).
- On an all-Qwen4 route with no `reasoning:` default, sets the documented
  default (`xhigh` for all-preview, `high` otherwise). Mixed routes untouched.
- Leaves existing declarations (including `reasoningEfforts: false`) and all
  other providers untouched; writes through the config editor.

## Install

```bash
dsh plugin --profile <your-profile> add github:archerkattri/dsh-qwen4-effort
```

Restart DSH once if the plugin manager reports a restart requirement. Then
select your Qwen4 model and use the composer's Effort menu.

## Configuration

Optional row config: `setup: false` to disable, `modelPrefixes` (default
`[qwen4]`), and `routes` to limit which provider routes are filled.

## Limitations

- Requires Qwen4 models already added to a Token Plan route with a `sk-sp-` key.
- Runs at activation; restart after adding new Qwen4 models.
- The config editor rewrites the edited entry; back up hand-written comments.
- `qwen4-max-preview` is Token Plan only and retires after 2026-11-25.
