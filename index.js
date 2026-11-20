/**
 * `dsh-qwen4-effort`
 *
 * Gives Qwen4 models their official reasoning-effort levels on the Qwen Token
 * Plan routes you already configured in DeepSeek Harness.
 *
 * DSH's bundled pi-ai catalog stops at the Qwen3.8 models, so a `qwen4-max` or
 * `qwen4-max-preview` entry you add by hand (Settings → Models, or
 * cordis.patch.yml) has no reasoning metadata and the composer shows no Effort
 * menu. This plugin scans the profile's `llm-pi-ai` configuration and, for
 * every Qwen4 model that declares no `reasoningEfforts`, fills in the official
 * levels and the Qwen wire-compatibility switches.
 *
 * Official levels (Alibaba Cloud Model Studio, Nov 2026):
 *   - qwen4-max-preview: low, medium, xhigh — default xhigh (Token Plan only)
 *   - qwen4-max family:  low, high, xhigh   — default high
 *     (minimal maps to low, medium to high, max to xhigh)
 *
 * It never creates a provider, never touches models that already declare
 * efforts (including `reasoningEfforts: false`), and preserves every other
 * provider and field. The write goes through the config editor into the
 * profile's user layer.
 *
 * Plain JavaScript, no runtime imports.
 */

export const name = 'qwen4-effort'

/** Official effort levels of the Qwen4-Max-Preview model (default xhigh). */
export const PREVIEW_EFFORTS = {
  low: 'low',
  medium: 'medium',
  xhigh: 'xhigh',
}

/** Official effort levels of the production Qwen4-Max family (default high). */
export const PRODUCTION_EFFORTS = {
  low: 'low',
  high: 'high',
  xhigh: 'xhigh',
}

/** Qwen Token Plan wire dialect for hand-declared Qwen4 models. */
export const QWEN4_COMPAT = {
  supportsStore: false,
  supportsDeveloperRole: false,
  supportsReasoningEffort: true,
  thinkingFormat: 'qwen',
  supportsStrictMode: true,
}

const DEFAULT_PREFIXES = ['qwen4']
const PREVIEW_PREFIX = 'qwen4-max-preview'

function matches(id, prefixes) {
  return typeof id === 'string' && prefixes.some((prefix) => id.startsWith(prefix))
}

function effortsFor(id) {
  return id.startsWith(PREVIEW_PREFIX) ? PREVIEW_EFFORTS : PRODUCTION_EFFORTS
}

function defaultFor(id) {
  return id.startsWith(PREVIEW_PREFIX) ? 'xhigh' : 'high'
}

/** Fill one model entry; returns the patched entry or null when untouched. */
export function patchModel(model, prefixes) {
  if (!model || !matches(model.id, prefixes)) return null
  // An explicit declaration (levels or `false`) is the user's answer; keep it.
  if (model.reasoningEfforts !== undefined) return null
  return {
    ...model,
    reasoningEfforts: { ...effortsFor(model.id) },
    // Existing compat fields win; only missing switches are filled.
    compat: { ...QWEN4_COMPAT, ...(model.compat ?? {}) },
  }
}

/** Patch one provider route; returns the patched route or null when untouched. */
export function patchRoute(route, prefixes) {
  if (!route || typeof route !== 'object') return null
  let changed = false
  const next = { ...route }

  if (Array.isArray(route.models)) {
    next.models = route.models.map((model) => {
      const patched = patchModel(model, prefixes)
      if (patched) changed = true
      return patched ?? model
    })
  }

  if (route.modelOverrides && typeof route.modelOverrides === 'object') {
    const overrides = { ...route.modelOverrides }
    for (const [id, override] of Object.entries(route.modelOverrides)) {
      const patched = patchModel({ id, ...override }, prefixes)
      if (patched) {
        const { id: _id, ...fields } = patched
        overrides[id] = fields
        changed = true
      }
    }
    if (changed) next.modelOverrides = overrides
  }

  // Honor the documented default effort only on a route made entirely of
  // Qwen4 models with no default of its own; a mixed route keeps its behavior.
  if (changed && next.reasoning === undefined && Array.isArray(next.models) && next.models.length > 0) {
    const ids = next.models.map((model) => model?.id).filter((id) => typeof id === 'string')
    if (ids.length === next.models.length && ids.every((id) => matches(id, prefixes))) {
      next.reasoning = ids.every((id) => id.startsWith(PREVIEW_PREFIX)) ? 'xhigh' : 'high'
    }
  }

  return changed ? next : null
}

/**
 * Compute the user-layer providers dict with Qwen4 efforts filled in.
 * Returns null when nothing needs to change.
 */
export function planFill(currentProviders, inheritedProviders, options = {}) {
  const prefixes = Array.isArray(options.modelPrefixes) && options.modelPrefixes.length > 0
    ? options.modelPrefixes
    : DEFAULT_PREFIXES
  const routeFilter = Array.isArray(options.routes) && options.routes.length > 0
    ? new Set(options.routes)
    : null

  const effective = { ...(inheritedProviders ?? {}), ...(currentProviders ?? {}) }
  const next = { ...(currentProviders ?? {}) }
  let changed = false

  for (const [route, profile] of Object.entries(effective)) {
    if (routeFilter && !routeFilter.has(route)) continue
    const patched = patchRoute(profile, prefixes)
    if (patched) {
      next[route] = patched
      changed = true
    }
  }
  return changed ? next : null
}

function retryable(error) {
  const message = String(error && error.message ? error.message : error)
  return message.includes('HMR transactions cannot be nested')
}

async function fillOnce(editor, options, logger) {
  const entry = editor.entries().find((candidate) => candidate?.options?.id === 'llm-pi-ai')
  if (!entry) {
    logger?.warn?.('qwen4-effort: no llm-pi-ai entry in this profile; nothing to fill')
    return
  }

  let inherited = {}
  let override = entry?.options?.config ?? {}
  if (typeof editor.configuration === 'function') {
    try {
      const snapshot = editor.configuration().find((item) => item.entry === entry)
      inherited = snapshot?.inherited ?? {}
      override = snapshot?.override ?? override
    } catch {
      // Fall back to the live entry config.
    }
  }

  const nextProviders = planFill(override?.providers, inherited?.providers, options)
  if (!nextProviders) return

  await editor.edit(entry, (current) => ({
    ...current,
    providers: { ...(current?.providers ?? {}), ...nextProviders },
  }))
  logger?.info?.('qwen4-effort: filled Qwen4 effort levels on existing routes')
}

export function apply(ctx, config = {}) {
  if (config?.setup === false) return

  const editor = ctx.get('configEditor')
  if (!editor) {
    ctx.logger?.warn?.('qwen4-effort: config editor unavailable; add reasoningEfforts to your Qwen4 models manually')
    return
  }

  const attempt = (tries = 0) => {
    fillOnce(editor, config ?? {}, ctx.logger).catch((error) => {
      if (retryable(error) && tries < 40) {
        setTimeout(() => attempt(tries + 1), 1500)
        return
      }
      ctx.logger?.error?.('qwen4-effort: could not fill effort levels: ' + String(error?.message ?? error))
    })
  }

  // Activation runs inside the installer's HMR transaction, and timers inherit
  // its AsyncLocalStorage store — which would make every config edit look
  // nested. Schedule outside that store so the edit queues normally.
  const hmr = ctx.get('hmr')
  const schedule = () => setTimeout(() => attempt(), 600)
  if (hmr?.executing?.exit) hmr.executing.exit(schedule)
  else schedule()
}
