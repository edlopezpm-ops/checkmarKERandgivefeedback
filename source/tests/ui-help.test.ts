// Verify actual bilingual guide data and rendered dialogs without browser or email effects.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const compile = (source: string) => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
}).outputText.replace(/from (["'])(react(?:\/jsx-runtime)?)\1/g, (_, quote, name) => `from ${quote}${import.meta.resolve(name)}${quote}`);
const moduleUrl = (source: string) => `data:text/javascript;base64,${Buffer.from(compile(source)).toString('base64')}`;
const guideUrl = moduleUrl(readFileSync(new URL('../src/console/help-guides.ts', import.meta.url), 'utf8'));
const source = readFileSync(new URL('../src/console/Help.tsx', import.meta.url), 'utf8')
  .replace("import { useLanguage } from '../i18n';", "const useLanguage = () => ({ language: globalThis.__markerHelpTestLanguage ?? 'en' });")
  .replaceAll("'./help-guides'", JSON.stringify(guideUrl))
  .replace("import './help.css';", '') + '\nexport { HelpDialog };';
const { helpGuides, HelpDialog } = await import(moduleUrl(source));

test('every workflow has concise bilingual steps with a real PNG in both languages', () => {
  assert.deepEqual(Object.keys(helpGuides).sort(), ['overview','products','accounts','space','campaigns','queue','settings','product','account','source','campaign','post','ambiente','agents','profile'].sort());
  assert.deepEqual(helpGuides.queue.title, { en: 'Drafting', es: 'Drafting' });
  for (const [key, guide] of Object.entries(helpGuides) as Array<[string, any]>) {
    assert.ok(guide.steps.length >= 2, key);
    for (const step of guide.steps) {
      assert.match(step.image, /^[a-z0-9-]+\.png$/, `${key}: image is mandatory`);
      for (const language of ['en','es']) {
        assert.ok(guide.title[language].trim());
        assert.ok(step.title[language].trim()); assert.ok(step.text[language].trim());
        assert.ok(step.alt[language].trim());
        const png = readFileSync(new URL(`../public/help/${language}/${step.image}`, import.meta.url));
        assert.equal(png.subarray(0,8).toString('hex'), '89504e470d0a1a0a', step.image);
        assert.ok(png.readUInt32BE(16) > 0 && png.readUInt32BE(20) > 0, step.image);
        assert.doesNotMatch(`${guide.title[language]} ${step.title[language]}`, /Editorial queue|\bQueue\b|\bCola\b/);
      }
    }
  }
});

test('every contextual entry renders its own first illustrated step and accessible navigation', () => {
  for (const language of ['en','es']) {
    globalThis.__markerHelpTestLanguage = language;
    for (const [topic, guide] of Object.entries(helpGuides) as Array<[string, any]>) {
      const html = renderToStaticMarkup(createElement(HelpDialog, { topic, close() {} }));
      assert.match(html, /<dialog[^>]+aria-labelledby=/);
      assert.equal((html.match(/<img\b/g) ?? []).length, 1, topic);
      assert.ok(html.includes(`/help/${language}/${guide.steps[0].image}`), topic);
      const heading = renderToStaticMarkup(createElement('h3', null, guide.steps[0].title[language])).replace('<h3>', '').replace('</h3>', '');
      assert.ok(html.includes(heading), topic);
      assert.match(html, /aria-current="step"/);
      assert.match(html, /aria-live="polite"/);
      assert.match(html, /target="_blank" rel="noopener noreferrer"/);
      assert.doesNotMatch(html, /\/help\/(en|es)\/undefined|alt="undefined"/);
    }
    const all = renderToStaticMarkup(createElement(HelpDialog, { topic:'all', close() {} }));
    assert.ok(all.includes(`/help/${language}/${helpGuides.overview.steps[0].image}`));
    assert.ok(all.includes(language === 'en' ? 'Help topics' : 'Temas de ayuda'));
  }
  delete globalThis.__markerHelpTestLanguage;
});

test('Profile opens its contextual guide and Help remains inside each legacy editor', () => {
  const consoleSource = readFileSync(new URL('../src/console/Console.tsx', import.meta.url), 'utf8');
  assert.match(consoleSource, /<Help topic={tab}/);
  assert.match(consoleSource, /<Help topic={editor\.kind}/);
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /authenticated && <Help topic="all"/);
});
