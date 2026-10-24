import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

test('preview text remains editable and native submissions are blocked without intercepting clipboard shortcuts', () => {
 const listeners = new Map<string, { callback: (event: any) => void; capture?: boolean }>();
 const action = { inert: false };
 const form = { querySelectorAll: () => [action], inert: true, style: { pointerEvents: 'none' }, removeAttribute(name: string) { if (name === 'inert') this.inert = false; } };
 const input = { style: { userSelect: 'none', webkitUserSelect: 'none' } };
 const document = { forms: [form], querySelectorAll: () => [input], addEventListener(name: string, callback: (event: any) => void, capture?: boolean) { listeners.set(name, { callback, capture }); } };
 const helper = new URL('../scripts/preview-interactions.js', import.meta.url);
 vm.runInNewContext(existsSync(helper) ? readFileSync(helper, 'utf8') : '', { document });
 assert.equal(form.inert, false, 'inert prevents mouse selection and keyboard copy/paste');
 assert.equal(form.style.pointerEvents, 'auto');
 assert.equal(action.inert, true, 'preview action buttons remain inactive');
 assert.equal(input.style.userSelect, 'text');
 assert.equal(input.style.webkitUserSelect, 'text');
 assert.equal(listeners.has('keydown'), false);
 assert.equal(listeners.has('copy'), false);
 assert.equal(listeners.has('paste'), false);
 let prevented = false;
 listeners.get('submit')?.callback({ preventDefault() { prevented = true; } });
 assert.equal(prevented, true, 'preview forms must never submit to a server');
 assert.equal(listeners.get('submit')?.capture, true);
});

test('exported previews include the copy helper while stripping application code and keeping forms usable', () => {
 const exporter = readFileSync(new URL('../scripts/export-design-preview.mjs', import.meta.url), 'utf8');
 const source = exporter.slice(exporter.indexOf('function freeze('), exporter.indexOf('\nawait fs.mkdir(site'));
 const context: any = { input: '<html><head></head><body><form action="/api/save"><input value="Copy me"><button>Save</button></form><script>fetch("/api/payment")</script></body></html>' };
 vm.runInNewContext('const origin="http://localhost:4350", targets=new Map(), locales=["en"], esc=v=>v, snapshotPath=()=>"/site/en/index.html";'+source+'; result=freeze(input,{route:"/product",kind:"public"});', context);
 assert.doesNotMatch(context.result, /fetch\("\/api\/payment"\)/);
 assert.match(context.result, /<form[^>]*\binert\b/, 'forms stay inactive until the submission blocker loads');
 assert.match(context.result, /src="\/preview-interactions\.js"/);
 assert.match(context.result, /Forms and payment actions are disabled/);
 assert.match(exporter, /copyFile\(path\.join\(repo,'scripts\/preview-interactions\.js'\)/);
});
test('disabled preview text can be copied while intentional read-only values remain protected', () => {
 const editable = { disabled: false, readOnly: false, style: {} };
 const disabled = { disabled: true, readOnly: false, style: {} };
 const readonly = { disabled: false, readOnly: true, style: {} };
 const document = { forms: [], querySelectorAll: () => [editable, disabled, readonly], addEventListener() {} };
 vm.runInNewContext(readFileSync(new URL('../scripts/preview-interactions.js', import.meta.url), 'utf8'), { document });
 assert.equal(editable.disabled, false);
 assert.equal(editable.readOnly, false, 'normal fields still accept typing and paste');
 assert.equal(disabled.disabled, false, 'disabled text must become selectable');
 assert.equal(disabled.readOnly, true, 'locked fields must not appear editable');
 assert.equal(readonly.readOnly, true);
});