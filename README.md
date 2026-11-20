# dsh-qwen4-effort

Effort levels for **Qwen4 Max** and **Qwen4 Max Preview** on the Qwen Token Plan
routes you already use in **DeepSeek Harness (dsh)**.

## The problem

DSH's bundled pi-ai catalog stops at the Qwen3.8 models. When you add
`qwen4-max` or `qwen4-max-preview` to your `qwen-token-plan-individual` (or any
Qwen Token Plan) provider — through **Settings → Models** or `cordis.patch.yml` —
the entry has no reasoning metadata, so the composer shows **no Effort menu**.

## What this plugin does

On activation it scans your `llm-pi-ai` configuration and, for every Qwen4
model that declares no `reasoningEfforts`, fills in the official levels and the
Qwen wire dialect (`enable_thinking` + `reasoning_effort`, `system` role, no
`store` field, strict tools).

The two Qwen4 models have **different official vocabularies** (Alibaba Cloud
Model Studio, Nov 2026):

| Model | Effort levels | Default | Notes |
|---|---|---|---|
| `qwen4-max-preview` | `low`, `medium`, `xhigh` | `xhigh` | Token Plan only; preview ends 2026-11-25 |
| `qwen4-max` (and snapshots) | `low`, `high`, `xhigh` | `high` | `minimal`→`low`, `medium`→`high`, `max`→`xhigh` |

Sources: [qwen4-max](https://www.alibabacloud.com/help/en/model-studio/qwen4-max),
[qwen4-max-preview](https://www.alibabacloud.com/help/en/model-studio/qwen4-max-preview).

**No new provider is created.** Your existing route keeps its name, key, and
every other model; the Qwen4 entries simply gain an Effort menu.

Non-destructive by design:

- Models that already declare `reasoningEfforts` (including `false`) are left
  exactly as they are.
- Existing `compat` fields win; only missing switches are filled.
- Every other provider and field is preserved.
- The write goes through DSH's config editor into your profile's user layer
  (`cordis.patch.yml`), the same place the Models page writes.

### Default effort

On a route whose models are **all** Qwen4 and that has no `reasoning:` of its
own, the plugin also sets the route default to the documented value (`xhigh`
for an all-preview route, `high` otherwise). Mixed routes (e.g. Qwen + DeepSeek
on one Token Plan route) keep their current behavior: pick an effort in the
composer — the pick is saved with the model for new sessions. With no pick and
no route default, the Qwen dialect sends `enable_thinking: false`.

## Install

From GitHub:

```bash
dsh plugin --profile <your-profile> add github:archerkattri/dsh-qwen4-effort
```

Or open **Plugins → Add plugin** and choose the checked-out directory.

The fill runs shortly after activation and retries around the installer's HMR
transaction; if it reports a restart requirement, restart DSH once. Then pick
your Qwen4 model in the composer and use **Effort**.

## Requirements

- A Qwen Token Plan provider configured in DSH (e.g.
  `qwen-token-plan-individual`) with `qwen4-max` and/or `qwen4-max-preview`
  added as models, and a Token Plan API key (`sk-sp-...`).
- Qwen4 models are Token Plan only; pay-as-you-go keys cannot use them.

## Configuration

The bundle row accepts optional fields:

```yaml
- id: qwen4-effort
  name: 'dsh-qwen4-effort'
  config:
    setup: true            # false disables the automatic fill
    modelPrefixes: [qwen4] # model id prefixes to fill (default: qwen4)
    routes: []             # optional: only fill these provider route keys
```

After the fill, a production model entry looks like:

```yaml
- id: qwen4-max
  name: Qwen4 Max
  contextWindow: 1000000
  maxTokens: 262144
  input: [text, image]
  reasoningEfforts:
    low: low
    high: high
    xhigh: xhigh
  compat:
    supportsStore: false
    supportsDeveloperRole: false
    supportsReasoningEffort: true
    thinkingFormat: qwen
    supportsStrictMode: true
```

## Notes and limitations

- The config editor rewrites the `llm-pi-ai` entry it edits; back up
  `cordis.patch.yml` if you keep hand-written comments there.
- The fill runs at activation, not on every config change. If you add a new
  Qwen4 model later, restart DSH (or toggle the plugin) to fill it.
- Uninstalling the plugin keeps the filled levels; remove `reasoningEfforts`
  from a model to revert it.
- `qwen4-max-preview` retires after its preview window (2026-11-25); the
  production `qwen4-max` is the recommended model afterwards.

## License

MIT
