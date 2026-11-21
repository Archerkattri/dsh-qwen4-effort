import assert from 'node:assert/strict'
import { apply, planFill, patchRoute, PREVIEW_EFFORTS, PRODUCTION_EFFORTS } from '../index.js'

// Production and preview models expose different official vocabularies.
assert.deepEqual(Object.keys(PRODUCTION_EFFORTS), ['low', 'high', 'xhigh'])
assert.deepEqual(Object.keys(PREVIEW_EFFORTS), ['low', 'medium', 'xhigh'])

// A hand-declared route with no efforts gets filled; non-Qwen4 and already
// declared models are untouched.
const plan = planFill({
  'qwen-token-plan-individual': {
    models: [
      { id: 'qwen4-max-preview' },
      { id: 'qwen4-max' },
      { id: 'qwen3.8-max', name: 'untouched' },
      { id: 'qwen4-max-0902', reasoningEfforts: false },
      { id: 'qwen4-max-0903', reasoningEfforts: { low: 'low' } },
    ],
  },
}, {})

const models = plan['qwen-token-plan-individual'].models
assert.deepEqual(models[0].reasoningEfforts, { low: 'low', medium: 'medium', xhigh: 'xhigh' })
assert.deepEqual(models[1].reasoningEfforts, { low: 'low', high: 'high', xhigh: 'xhigh' })
assert.equal(models[2].name, 'untouched')
assert.equal(models[2].reasoningEfforts, undefined)
assert.equal(models[3].reasoningEfforts, false)
assert.deepEqual(models[4].reasoningEfforts, { low: 'low' })
assert.equal(models[1].compat.thinkingFormat, 'qwen')
assert.equal(models[1].compat.supportsDeveloperRole, false)
assert.equal(models[1].compat.supportsReasoningEffort, true)

// Existing compat fields win over the defaults this plugin fills in.
const customCompat = planFill({ r: { models: [{ id: 'qwen4-max', compat: { thinkingFormat: 'custom' } }] } }, {})
assert.equal(customCompat.r.models[0].compat.thinkingFormat, 'custom')
assert.equal(customCompat.r.models[0].compat.supportsStore, false)

// Mixed routes keep their own default; an all-Qwen4 route gains the documented one.
const mixed = planFill({ r: { models: [{ id: 'qwen4-max' }, { id: 'deepseek-v4-pro' }] } }, {})
assert.equal(mixed.r.reasoning, undefined)
const purePreview = planFill({ r: { models: [{ id: 'qwen4-max-preview' }] } }, {})
assert.equal(purePreview.r.reasoning, 'xhigh')
const pureProd = planFill({ r: { models: [{ id: 'qwen4-max' }] } }, {})
assert.equal(pureProd.r.reasoning, 'high')

// No-op when nothing needs filling.
assert.equal(planFill({ r: { models: [{ id: 'qwen4-max', reasoningEfforts: { low: 'low' } }] } }, {}), null)
assert.equal(patchRoute({ models: [{ id: 'qwen3.8-max' }] }, ['qwen4']), null)

// modelOverrides are filled too.
const overrides = planFill({ r: { modelOverrides: { 'qwen4-max': { name: 'custom' } } } }, {})
assert.deepEqual(overrides.r.modelOverrides['qwen4-max'].reasoningEfforts, { low: 'low', high: 'high', xhigh: 'xhigh' })
assert.equal(overrides.r.modelOverrides['qwen4-max'].name, 'custom')

// Applying with setup disabled must not touch the config editor.
let editorTouched = false
const ctx = {
  get: (name) => {
    if (name === 'configEditor') {
      return {
        entries: () => {
          editorTouched = true
          return []
        },
        configuration: () => [],
      }
    }
    return undefined
  },
  logger: { warn() {}, info() {}, error() {} },
}
apply(ctx, { setup: false })
await new Promise((resolve) => setTimeout(resolve, 30))
assert.equal(editorTouched, false)

console.log('smoke: dsh-qwen4-effort ok')
