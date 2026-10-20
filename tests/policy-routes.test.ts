import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { switchLocale } from '../src/utils/navigation.ts';

test('consolidated policy topic links keep their anchors when the site language changes', () => {
  assert.equal(switchLocale('/policies#terms', 'ja'), '/policies#terms');
  assert.equal(switchLocale('/policies#shipping-returns', 'zh-CN'), '/policies#shipping-returns');
  assert.equal(switchLocale('/policies#privacy', 'th'), '/policies#privacy');
});

test('legacy policy routes redirect to their matching consolidated topic', async () => {
  for (const [file, anchor] of [
    ['privacy.astro', 'privacy'],
    ['terms.astro', 'terms'],
    ['shipping-returns.astro', 'shipping-returns'],
  ]) {
    const source = await readFile(new URL('../src/pages/' + file, import.meta.url), 'utf8');
    assert.match(source, /^---\r?\nreturn Astro\.redirect\('\/policies#/);
    assert.match(source, new RegExp(`\\/policies#${anchor}', 301\\)`));
  }
});

test('all policy anchors exist on the one Thai policy route', async () => {
  const source = await readFile(new URL('../src/components/pages/PolicyPage.astro', import.meta.url), 'utf8');
  for (const anchor of ['terms', 'shipping-returns', 'privacy']) assert.match(source, new RegExp(`id="${anchor}"`));
});
