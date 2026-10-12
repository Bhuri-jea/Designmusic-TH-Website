import test from 'node:test';
import assert from 'node:assert/strict';
import { captureGoogleSubject, subjectFromToken, type IdentityToken } from '../src/lib/server/identity.ts';

test('captures Google providerAccountId and keeps it when verified email changes', () => {
  const signedIn = captureGoogleSubject({ sub: 'old-subject' } as IdentityToken, { provider: 'google', providerAccountId: 'google-123' });
  assert.equal(signedIn.googleSubject, 'google-123');
  const refreshed = captureGoogleSubject(signedIn, { provider: 'google', providerAccountId: 'google-123' });
  assert.equal(refreshed.googleSubject, 'google-123');
  assert.equal(subjectFromToken(refreshed), 'google-123');
});

test('ignores other providers and browser-supplied subject values', () => {
  const existing: IdentityToken = { googleSubject: 'google-123' };
  assert.equal(captureGoogleSubject(existing, { provider: 'github', providerAccountId: 'attacker' }, { googleSubject: 'replace-me' }).googleSubject, 'google-123');
  assert.equal(captureGoogleSubject({} as IdentityToken, { provider: 'github', providerAccountId: 'attacker' }, { googleSubject: 'replace-me' }).googleSubject, undefined);
});

