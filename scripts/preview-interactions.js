// Static previews allow text editing for translation, never form submission.
document.addEventListener('submit', event => event.preventDefault(), true);
for (const form of document.forms) {
 for (const control of form.querySelectorAll('button, input[type="submit"], input[type="reset"], input[type="button"], input[type="file"]')) control.inert = true;
 form.removeAttribute('inert');
 form.style.pointerEvents = 'auto';
}
for (const control of document.querySelectorAll('input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input[type="number"], textarea')) {
 // Locked snapshot values may be copied, but must not become editable.
 if (control.disabled) { control.disabled = false; control.readOnly = true; }
 control.style.userSelect = 'text';
 control.style.webkitUserSelect = 'text';
}