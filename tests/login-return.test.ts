import test from 'node:test';
import assert from 'node:assert/strict';
import { safeCallback } from '../src/utils/navigation.ts';
test('sign-in returns to the booking flow in the active locale', () => {
  assert.equal(safeCallback('/booking', 'en'), '/booking');
  assert.equal(safeCallback('/ja/booking', 'th'), '/th/booking');
});
test('sign-in never follows external, encoded or unsupported redirect destinations', () => {
  for (const value of ['https://evil.example', '//evil.example', '/\\evil.example', '/%2f%2fevil.example', '/api/auth/signout', '/booking?returnTo=https://evil.example', null]) {
    const path = safeCallback(value, 'en');
    assert.ok(path === '/profile' || path === '/booking');
    assert.ok(!path.includes('evil'));
  }
});
