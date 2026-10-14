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

test('email login replaces a previous Google identity with the verified Supabase ID', () => {
  const next = captureGoogleSubject({ googleSubject: 'previous-google' }, { provider: 'credentials' }, { id: '12345678-1234-4234-8234-123456789abc' });
  assert.equal(next.googleSubject, undefined);
  assert.equal(subjectFromToken(next), 'supabase:12345678-1234-4234-8234-123456789abc');
  assert.equal(subjectFromToken(captureGoogleSubject(next, { provider: 'google', providerAccountId: 'google-456' })), 'google-456');
});

test('invalid email identities cannot keep a previous customer identity', () => {
  assert.equal(subjectFromToken(captureGoogleSubject({ googleSubject: 'previous-google' }, { provider: 'credentials' }, { id: 'email-user' })), undefined);
});

