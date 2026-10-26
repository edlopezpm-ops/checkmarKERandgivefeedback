import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as analytics from '../src/core/analytics.ts';

const source = ts.transpileModule(readFileSync(new URL('../src/console/AnalyticsSettings.tsx', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const configuration = () => ({ schema_version: 1, source_id: 'marker-owner-production', product: 'marker', environment: 'production', version: 1, enabled: true, issued_at: new Date().toISOString(), expires_at: new Date(Date.now() + 300000).toISOString(), events: ['commercial_interest_selected'], fields: ['category'], purposes: ['optional_analytics', 'onsite_personalized_ads'], destinations: [], retention_days: 30, restriction_reason: null });
function nodes(node) { if (!node) return []; if (Array.isArray(node)) return node.flatMap(nodes); if (typeof node !== 'object') return []; return [node, ...nodes(node.props?.children)]; }
function textOf(node) { if (node == null || typeof node === 'boolean') return ''; if (Array.isArray(node)) return node.map(textOf).join(''); if (typeof node === 'object') return textOf(node.props?.children); return String(node); }
function fixture({ gpc = false, expired = false, configured = true } = {}) {
  const calls = [], hooks = [], effects = [];
  let cursor = 0, output;
  const react = {
    useState(initial) { const index = cursor++; hooks[index] ??= { value: typeof initial === 'function' ? initial() : initial }; return [hooks[index].value, next => { hooks[index].value = typeof next === 'function' ? next(hooks[index].value) : next; }]; },
    useEffect(effect, dependencies) { const index = cursor++; if (!hooks[index]) { hooks[index] = { dependencies }; effects.push(effect); } },
  };
  const exports = {};
  runInNewContext(source, { exports, Date, navigator: { globalPrivacyControl: gpc }, crypto, require(name) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (name === '../core/analytics') return analytics;
    if (name === '../i18n') return { useLanguage: () => ({ language: 'en' }) };
    if (name === './ErrorNotice') return { ErrorNotice: 'error-notice' };
    if (name === '../core/client') return { async request(url, body) {
      calls.push({ url, body });
      if (!configured && body) throw new Error('not configured');
      if (url === '/api/analytics') return { console_url: 'https://aekr.io/analytics', source_id: 'marker-owner-production', status: configured ? 'active' : 'not_configured', desired_version: configured ? 1 : null, applied_version: configured ? 1 : null, configuration: configured ? configuration() : null };
      if (url === '/api/analytics/preferences' && body) return { permission_ref: 'fixture_permission' };
      if (url === '/api/analytics/preferences') return { preferences: expired ? [{ purpose: 'onsite_personalized_ads', status: 'expired', permission_ref: 'expired_permission', categories: ['marketing'], recipients: [], gpc: false, expires_at: new Date(Date.now() - 1000).toISOString() }] : [] };
      if (url === '/api/analytics/audiences') return { audiences: [] };
      throw new Error('unexpected request');
    } };
    throw new Error('Unexpected import ' + name);
  } });
  function render() { cursor = 0; output = exports.default(); while (effects.length) effects.shift()(); return output; }
  render();
  return { calls, render, async flush() { await new Promise(resolve => setImmediate(resolve)); render(); }, text() { return textOf(output); }, find(predicate) { const node = nodes(output).find(predicate); assert.ok(node); return node; } };
}

test('navigator-only GPC propagates the central exclusion automatically on load without a manual click', async () => {
  const f = fixture({ gpc: true }); await f.flush();
  assert.equal(f.calls[0].url, '/api/analytics/preferences');
  assert.equal(f.calls[0].body.purpose, 'onsite_personalized_ads'); assert.equal(f.calls[0].body.status, 'withdrawn'); assert.equal(f.calls[0].body.gpc, true);
  assert.equal(f.calls.filter(call => call.body).length, 1);
  assert.ok(f.text().includes('GPC is present'));
});

test('expired central preference is displayed as expired and cannot enable the interest action', async () => {
  const f = fixture({ expired: true }); await f.flush();
  f.find(node => node.type === 'select' && node.props.value === 'optional_analytics').props.onChange({ target: { value: 'onsite_personalized_ads' } }); f.render();
  assert.ok(f.text().includes('Recorded status: expired'));
  assert.equal(f.find(node => node.type === 'button' && textOf(node) === 'Record this declared interest').props.disabled, true);
  assert.equal(f.calls.some(call => call.url === '/api/analytics/events'), false);
});

test('navigator-only GPC with an unconfigured connection still shows its closed source state', async () => {
  const f = fixture({ gpc: true, configured: false }); await f.flush();
  assert.ok(f.text().includes('Connection not configured; optional collection is off.'));
  assert.equal(f.text().includes('Checking connection'), false);
  assert.equal(f.calls.filter(call => call.body).length, 1);
});
