from pathlib import Path

root = Path(r'd:\MyDocument\Design_music\Website\Designmusic-TH-Website')

files = {
    root/'src/pages/cart-cancelled.astro': [
        ("import { XCircle } from 'lucide-svelte';\n", ""),
        ('        <XCircle class="w-20 h-20 text-white" />\n', '        <svg viewBox="0 0 24 24" aria-hidden="true" class="w-20 h-20 text-white">\n          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7" />\n          <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />\n        </svg>\n'),
    ],
    root/'src/layouts/ProductLayout.astro': [
        ("import { ArrowLeft } from 'lucide-svelte';\n", ""),
        ('      <ArrowLeft /> {backLabel}\n', '      <svg viewBox="0 0 24 24" aria-hidden="true" class="w-4 h-4">\n        <path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />\n      </svg>\n      {backLabel}\n'),
    ],
    root/'src/pages/profile.astro': [
        ("import { User, Mail, Phone, Calendar, LogOut } from 'lucide-svelte';\n", ""),
        ('      <button id="signout-btn" class="btn btn-ghost text-red-400 hover:text-red-300 gap-2"><LogOut /> Sign Out</button>\n', '      <button id="signout-btn" class="btn btn-ghost text-red-400 hover:text-red-300 gap-2">\n        <svg viewBox="0 0 24 24" aria-hidden="true" class="w-4 h-4">\n          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />\n          <path d="M16 17l5-5-5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />\n          <path d="M21 12H9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />\n        </svg>\n        Sign Out\n      </button>\n'),
        ('              <label for="name" class="text-xs font-medium tracking-widest uppercase text-neutral-400 flex items-center gap-2"><User /> Full Name</label>\n', '              <label for="name" class="text-xs font-medium tracking-widest uppercase text-neutral-400 flex items-center gap-2">\n                <svg viewBox="0 0 24 24" aria-hidden="true" class="w-4 h-4"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-7 8a7 7 0 0 1 14 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>\n                Full Name\n              </label>\n'),
        ('              <label for="email" class="text-xs font-medium tracking-widest uppercase text-neutral-400 flex items-center gap-2"><Mail /> Email Address (Google)</label>\n', '              <label for="email" class="text-xs font-medium tracking-widest uppercase text-neutral-400 flex items-center gap-2">\n                <svg viewBox="0 0 24 24" aria-hidden="true" class="w-4 h-4"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5zm0 0 8 6 8-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>\n                Email Address (Google)\n              </label>\n'),
        ('              <label for="phone" class="text-xs font-medium tracking-widest uppercase text-neutral-400 flex items-center gap-2"><Phone /> Phone Number</label>\n', '              <label for="phone" class="text-xs font-medium tracking-widest uppercase text-neutral-400 flex items-center gap-2">\n                <svg viewBox="0 0 24 24" aria-hidden="true" class="w-4 h-4"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07A19.5 19.5 0 0 1 3.07 12.8 19.86 19.86 0 0 1 0 4.18 2 2 0 0 1 2 2h3a2 2 0 0 1 2 1.72 12.77 12.77 0 0 0 .7 4.87 2 2 0 0 1-.3 2.23L2.24 10a16 16 0 0 0 11.77 11.77l.18-.18a2 2 0 0 1 2.23-.3 12.77 12.77 0 0 0 4.87.7A2 2 0 0 1 22 16.92z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>\n                Phone Number\n              </label>\n'),
        ('          <h2 class="text-lg font-serif text-white mb-6 flex items-center gap-2"><Calendar /> Appointments</h2>\n', '          <h2 class="text-lg font-serif text-white mb-6 flex items-center gap-2">\n            <svg viewBox="0 0 24 24" aria-hidden="true" class="w-5 h-5"><path d="M7 2v3M17 2v3M3 9h18M5 5h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>\n            Appointments\n          </h2>\n'),
    ],
    root/'src/pages/success.astro': [
        ("import { CheckCircle } from 'lucide-svelte';\n", ""),
        ('        <CheckCircle />\n', '        <svg viewBox="0 0 24 24" aria-hidden="true" class="w-20 h-20 text-white">\n          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7" />\n          <path d="M8 12.5l2.5 2.5 5.5-6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />\n        </svg>\n'),
    ],
    root/'src/pages/product/siliconepads.astro': [
        ("import { CheckCircle2 } from 'lucide-svelte';\n", ""),
        ('        <CheckCircle2 /> Product feature\n', '        <svg viewBox="0 0 24 24" aria-hidden="true" class="w-5 h-5 text-neutral-400"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7" /><path d="M8 12.5l2.5 2.5 5.5-6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>\n        Product feature\n'),
    ],
    root/'src/pages/product/woodwindaccessories.astro': [
        ("import { ArrowLeft, Shield, Zap } from 'lucide-svelte';\n", ""),
        ('      <ArrowLeft /> Back to Products\n', '      <svg viewBox="0 0 24 24" aria-hidden="true" class="w-4 h-4"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>\n      Back to Products\n'),
        ('              <Zap />\n', '              <svg viewBox="0 0 24 24" aria-hidden="true" class="w-5 h-5"><path d="M13 2L4 13h6l-1 9 9-11h-6l1-9z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>\n'),
        ('              <Shield />\n', '              <svg viewBox="0 0 24 24" aria-hidden="true" class="w-5 h-5"><path d="M12 3l7 3v6c0 4.5-2.8 8.7-7 11-4.2-2.3-7-6.5-7-11V6l7-3zm-1 6h2v4h-2zm0 5h2v2h-2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>\n'),
    ],
    root/'src/pages/ja/booking.astro': [
        ("import { ArrowLeft } from 'lucide-svelte';\n", ""),
        ('      <ArrowLeft /> サービスに戻る\n', '      <svg viewBox="0 0 24 24" aria-hidden="true" class="w-4 h-4"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>\n      サービスに戻る\n'),
    ],
    root/'src/pages/ja/product/siliconepads.astro': [
        ("import { CheckCircle2 } from 'lucide-svelte';\n", ""),
        ('        <CheckCircle2 /> 製品の効果\n', '        <svg viewBox="0 0 24 24" aria-hidden="true" class="w-5 h-5 text-neutral-400"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7" /><path d="M8 12.5l2.5 2.5 5.5-6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>\n        製品の効果\n'),
    ],
    root/'src/pages/ja/product/woodwindaccessories.astro': [
        ("import { ArrowLeft, Shield, Zap } from 'lucide-svelte';\n", ""),
        ('      <ArrowLeft /> 製品一覧に戻る\n', '      <svg viewBox="0 0 24 24" aria-hidden="true" class="w-4 h-4"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>\n      製品一覧に戻る\n'),
        ('              <Zap />\n', '              <svg viewBox="0 0 24 24" aria-hidden="true" class="w-5 h-5"><path d="M13 2L4 13h6l-1 9 9-11h-6l1-9z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>\n'),
        ('              <Shield />\n', '              <svg viewBox="0 0 24 24" aria-hidden="true" class="w-5 h-5"><path d="M12 3l7 3v6c0 4.5-2.8 8.7-7 11-4.2-2.3-7-6.5-7-11V6l7-3zm-1 6h2v4h-2zm0 5h2v2h-2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>\n'),
    ],
    root/'src/pages/th/booking.astro': [
        ("import { ArrowLeft } from 'lucide-svelte';\n", ""),
        ('      <ArrowLeft /> กลับไปยังบริการ\n', '      <svg viewBox="0 0 24 24" aria-hidden="true" class="w-4 h-4"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>\n      กลับไปยังบริการ\n'),
    ],
    root/'src/pages/th/product/siliconepads.astro': [
        ("import { CheckCircle2 } from 'lucide-svelte';\n", ""),
        ('        <CheckCircle2 /> ข้อดีที่โดดเด่น\n', '        <svg viewBox="0 0 24 24" aria-hidden="true" class="w-5 h-5 text-neutral-400"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7" /><path d="M8 12.5l2.5 2.5 5.5-6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>\n        ข้อดีที่โดดเด่น\n'),
    ],
    root/'src/pages/th/product/woodwindaccessories.astro': [
        ("import { ArrowLeft, Shield, Zap } from 'lucide-svelte';\n", ""),
        ('      <ArrowLeft /> กลับไปยังผลิตภัณฑ์\n', '      <svg viewBox="0 0 24 24" aria-hidden="true" class="w-4 h-4"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>\n      กลับไปยังผลิตภัณฑ์\n'),
        ('              <Zap />\n', '              <svg viewBox="0 0 24 24" aria-hidden="true" class="w-5 h-5"><path d="M13 2L4 13h6l-1 9 9-11h-6l1-9z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>\n'),
        ('              <Shield />\n', '              <svg viewBox="0 0 24 24" aria-hidden="true" class="w-5 h-5"><path d="M12 3l7 3v6c0 4.5-2.8 8.7-7 11-4.2-2.3-7-6.5-7-11V6l7-3zm-1 6h2v4h-2zm0 5h2v2h-2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>\n'),
    ],
    root/'src/pages/zh-CN/booking.astro': [
        ("import { ArrowLeft } from 'lucide-svelte';\n", ""),
        ('      <ArrowLeft /> 返回服务\n', '      <svg viewBox="0 0 24 24" aria-hidden="true" class="w-4 h-4"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>\n      返回服务\n'),
    ],
    root/'src/pages/zh-CN/product/siliconepads.astro': [
        ("import { CheckCircle2 } from 'lucide-svelte';\n", ""),
        ('        <CheckCircle2 /> 优点\n', '        <svg viewBox="0 0 24 24" aria-hidden="true" class="w-5 h-5 text-neutral-400"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7" /><path d="M8 12.5l2.5 2.5 5.5-6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>\n        优点\n'),
    ],
    root/'src/pages/zh-CN/product/woodwindaccessories.astro': [
        ("import { ArrowLeft, Shield, Zap } from 'lucide-svelte';\n", ""),
        ('      <ArrowLeft /> 返回产品\n', '      <svg viewBox="0 0 24 24" aria-hidden="true" class="w-4 h-4"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>\n      返回产品\n'),
        ('              <Zap />\n', '              <svg viewBox="0 0 24 24" aria-hidden="true" class="w-5 h-5"><path d="M13 2L4 13h6l-1 9 9-11h-6l1-9z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>\n'),
        ('              <Shield />\n', '              <svg viewBox="0 0 24 24" aria-hidden="true" class="w-5 h-5"><path d="M12 3l7 3v6c0 4.5-2.8 8.7-7 11-4.2-2.3-7-6.5-7-11V6l7-3zm-1 6h2v4h-2zm0 5h2v2h-2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>\n'),
    ],
}

for file_path, edits in files.items():
    text = file_path.read_text(encoding='utf-8')
    for old, new in edits:
        if old in text:
            text = text.replace(old, new)
        else:
            print(f'Pattern not found in {file_path}: {old[:60]!r}')
    file_path.write_text(text, encoding='utf-8')
    print(f'Updated {file_path.name}')
