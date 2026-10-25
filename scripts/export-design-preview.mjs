import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.join(repo,'mockups/joy-perfection'),site=path.join(root,'site');
const origin=process.env.PREVIEW_SOURCE_URL??'http://127.0.0.1:4350';
const harness=process.env.PREVIEW_HARNESS_URL??'http://127.0.0.1:4349';
for(const value of [origin,harness]){const url=new URL(value);if(!['127.0.0.1','localhost'].includes(url.hostname)||url.protocol!=='http:')throw Error('Preview sources must be local HTTP servers');}
const cli=process.env.PLAYWRIGHT_CLI_JS??path.join(process.env.APPDATA??'','npm/node_modules/@playwright/cli/playwright-cli.js');
const session='design-export-20261021';
const locales=['en','th','ja','zh-CN'];
const publicPaths=['/','/about','/product','/product/shakuhachi','/product/saxophone-end-plug','/product/siliconepads','/product/woodwindaccessories','/repair-services','/booking','/login','/signup','/cancel','/cart-cancelled','/success'];
const routes=locales.flatMap(locale=>publicPaths.map(route=>({locale,route:locale==='en'?route:`/${locale}${route==='/'?'':route}`,kind:'public'})));
routes.push({locale:'th',route:'/policies',kind:'public'});
for(const locale of locales){for(const [route,view] of [['/profile','profile'],['/profile/bookings','bookings'],['/profile/orders','orders'],['/cart','cart']])routes.push({locale,route:locale==='en'?route:`/${locale}${route}`,kind:'account',view});if(['en','th'].includes(locale))for(const [route,view] of [['/admin','admin'],['/admin/products','products'],['/admin/shipping','shipping']])routes.push({locale,route:locale==='en'?route:`/${locale}${route}`,kind:'seller',view});}
const snapshotPath=route=>{const parts=route.split('/').filter(Boolean),locale=locales.includes(parts[0])?parts.shift():'en';return `/site/${locale}/${parts.length?parts.join('/')+'/':''}index.html`;};
const targets=new Map(routes.map(row=>[row.route,snapshotPath(row.route)]));
const requested=process.env.PREVIEW_ROUTES?.split(',').map(value=>value.trim()).filter(Boolean);
const resume=process.env.PREVIEW_RESUME==='1',refresh=process.env.PREVIEW_REFRESH_ROUTES?.split(',')??[];
const captureRoutes=requested?routes.filter(row=>requested.includes(row.route)):routes;
if(requested&&captureRoutes.length!==requested.length)throw Error('PREVIEW_ROUTES contains an unknown route');
targets.set('/privacy',snapshotPath('/policies')+'#privacy');targets.set('/terms',snapshotPath('/policies')+'#terms');targets.set('/shipping-returns',snapshotPath('/policies')+'#shipping-returns');
const esc=value=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function run(args){return execFileSync(process.execPath,[cli,`-s=${session}`,...args],{cwd:repo,encoding:'utf8',maxBuffer:32*1024*1024,timeout:120000,windowsHide:true});}
function result(output){const start=output.indexOf('### Result\n');if(start<0)throw Error(output.slice(0,1200));return JSON.parse(output.slice(start+11).split('\n### ')[0].trim());}
function freeze(html,row){
 html=html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'').replace(/\s(?:on\w+)=(?:"[^"]*"|'[^']*')/gi,'').replace(/<form\b([^>]*)>/gi,'<form$1 inert>');
 html=html.replace(/\bhref=(['"])(\/[^'"\s]*)\1/g,(all,quote,value)=>{if(value.startsWith('//')||value.startsWith('/_astro/')||value.startsWith('/images/'))return all;const url=new URL(value,origin),target=targets.get(url.pathname.replace(/\/$/,'')||'/');return target?`href=${quote}${target}${url.hash}${quote}`:all;});
 const plain=row.route.replace(/^\/(?:th|ja|zh-CN)(?=\/|$)/,'')||'/';
 html=html.replace(/<body([^>]*)>/i,(_,attrs)=>`<body${attrs.replace(/ data-design-route="[^"]*"/,'')} data-design-route="${plain}">`).replace('</head>','<link rel="stylesheet" href="/heading-layout.css"></head>');
 const languageLinks=locales.map(locale=>{const route=locale==='en'?plain:`/${locale}${plain==='/'?'':plain}`;return `<a href="${targets.get(route)??snapshotPath(locale==='en'?'/':`/${locale}`)}" style="color:inherit;margin-left:12px;text-decoration:underline">${esc({en:"English",th:"ภาษาไทย",ja:"日本語","zh-CN":"中文"}[locale])}</a>`;}).join('');
 const notice=`<aside data-preview-notice style="position:fixed;bottom:10px;left:10px;right:10px;z-index:9999;background:#f4e8c8;color:#241c17;padding:8px 14px;font:12px/1.45 system-ui;border:1px solid #bba474;border-radius:6px"><a href="/directory.html" style="color:inherit;text-decoration:underline">Preview directory</a> · ${row.kind==='public'?'Snapshot of the local website.':'Interface preview with empty example data; no customer records.'} Forms and payment actions are disabled.<span data-preview-languages>${languageLinks}</span></aside>`;
 return html.replace(/<head([^>]*)>/i,'<head$1><meta name="robots" content="noindex,nofollow"><style>html{scroll-behavior:auto!important}body{margin:0} [data-aos]{opacity:1!important;transform:none!important}.aos-init{opacity:1!important}form{pointer-events:none}</style>').replace(/<body([^>]*)>/i,`<body$1>${notice}`).replace(/<\/body>/i,'<script src="/preview-interactions.js" defer></script><script src="/preview.js" defer></script></body>');
}
await fs.mkdir(site,{recursive:true});
await fs.copyFile(path.join(repo,'scripts/preview-interactions.js'),path.join(root,'preview-interactions.js'));
await fs.copyFile(path.join(repo,'src/styles/heading-layout.css'),path.join(root,'heading-layout.css'));
const previous=await fs.readFile(path.join(root,'index.html'),'utf8');if(previous.includes('data-page="home"'))await fs.copyFile(path.join(root,'index.html'),path.join(root,'reference.html'));
await fs.cp(path.join(repo,'.runtime/node-production-build/client/_astro'),path.join(site,'_astro'),{recursive:true,filter:source=>!/\.(?:js|mjs|map)$/i.test(source)});
run(['open','about:blank']);
const manifest=requested?JSON.parse(await fs.readFile(path.join(site,'manifest.json'),'utf8')).pages.filter(row=>!requested.includes(row.route)):[];
try{
 for(const row of captureRoutes){
  if(resume&&!refresh.includes(row.route)){try{const existing=await fs.readFile(path.join(root,snapshotPath(row.route)),'utf8');manifest.push({...row,file:snapshotPath(row.route),title:existing.match(/<title>([\s\S]*?)<\/title>/i)?.[1]??row.route});continue;}catch{}}
  const url=row.kind==='public'?origin+row.route:`${harness}/?view=${row.view}&lang=${row.locale}&preview=1`;
  const code=`async page=>{await page.setViewportSize({width:1440,height:1000});await page.unroute('**/api/**');await page.route('**/api/**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'static_preview_only'})}));await page.goto(${JSON.stringify(url)},{waitUntil:'networkidle'});await page.locator('#main-content').waitFor();await page.evaluate(()=>document.fonts.ready);${row.view==='cart'?"await page.locator('nav button').last().click();await page.getByRole('dialog').waitFor();":''}await page.evaluate(()=>{document.documentElement.lang=${JSON.stringify(row.locale)};for(const el of document.querySelectorAll('[data-aos]'))el.removeAttribute('data-aos');for(const input of document.querySelectorAll('input')){input.setAttribute('value',input.value);input.toggleAttribute('checked',input.checked);}for(const select of document.querySelectorAll('select'))for(const option of select.options)option.toggleAttribute('selected',option.selected);for(const area of document.querySelectorAll('textarea'))area.textContent=area.value;});return {html:await page.content(),title:await page.title()};}`;
  const captured=result(run(['run-code',code]));
  const target=path.join(root,snapshotPath(row.route));await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,freeze(captured.html,row));
  manifest.push({...row,file:snapshotPath(row.route),title:captured.title});console.log(`Exported ${row.locale} ${row.route}`);
  await fs.writeFile(path.join(site,'manifest.json'),JSON.stringify({generatedAt:new Date().toISOString(),pages:manifest},null,2));
 }
}finally{run(['close']);}
await fs.writeFile(path.join(site,'manifest.json'),JSON.stringify({generatedAt:new Date().toISOString(),source:'local website source; public snapshots and empty authenticated interface examples',pages:manifest},null,2));
const directory=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Design Music · Website preview directory</title><style>body{margin:0;background:#f4f0e8;color:#27201d;font:16px/1.5 system-ui}main{max-width:1300px;margin:auto;padding:50px 24px}h1{font:clamp(36px,6vw,70px)/1.1 Georgia,serif}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:22px}section{background:#fffcf6;padding:24px;border:1px solid #d7cdbd;border-radius:16px}a{display:block;padding:10px 0;color:#45362b;text-underline-offset:4px}small{color:#6c6258}h2{font:30px Georgia,serif}header{margin-bottom:35px}</style></head><body><main><header><small>DESIGN MUSIC · LOCAL DESIGN REVIEW</small><h1>Website preview</h1><p>Rendered from the current website source. Public wording stays in its original language. Account and seller pages use empty interface examples. Forms, email and payments are disabled.</p><a href="/reference.html#directory">Earlier visual reference</a></header><div class="grid">${locales.map(locale=>`<section><h2>${esc({en:'English',th:'ไทย',ja:'日本語','zh-CN':'简体中文'}[locale])}</h2>${manifest.filter(row=>row.locale===locale).map(row=>`<a href="${row.file}">${esc(row.route)}</a>`).join('')}</section>`).join('')}</div></main></body></html>`;
await fs.writeFile(path.join(root,'directory.html'),directory);await fs.copyFile(path.join(root,snapshotPath('/')),path.join(root,'index.html'));console.log(`Saved ${manifest.length} pages. Preview: http://127.0.0.1:4333/`);
