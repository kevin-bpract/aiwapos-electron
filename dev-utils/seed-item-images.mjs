#!/usr/bin/env node
// Seed Frappe Item.image with free LoremFlickr food photos for items
// that are currently missing an image.
//
// Usage:
//   FRAPPE_URL=https://electronpos.tbo365.cloud \
//   FRAPPE_USER=api@gmail.com \
//   FRAPPE_PASS='Frappe!123' \
//   node dev-utils/seed-item-images.mjs [--dry-run] [--overwrite]
//
// Flags:
//   --dry-run    Show what would change without writing.
//   --overwrite  Replace images even if the item already has one.

import process from 'node:process';

const BASE = (process.env.FRAPPE_URL || 'https://electronpos.tbo365.cloud').replace(/\/$/, '');
const USER = process.env.FRAPPE_USER;
const PASS = process.env.FRAPPE_PASS;
const DRY = process.argv.includes('--dry-run');
const OVERWRITE = process.argv.includes('--overwrite');

if (!USER || !PASS) {
  console.error('Set FRAPPE_USER and FRAPPE_PASS env vars.');
  process.exit(1);
}

// Cookie jar
let cookieHeader = '';
function captureCookies(res) {
  const set = res.headers.getSetCookie?.() || [];
  if (!set.length) return;
  const jar = new Map(
    cookieHeader.split('; ').filter(Boolean).map((c) => {
      const i = c.indexOf('=');
      return [c.slice(0, i), c.slice(i + 1)];
    }),
  );
  for (const line of set) {
    const [pair] = line.split(';');
    const i = pair.indexOf('=');
    jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
  cookieHeader = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

async function login() {
  const body = new URLSearchParams({ usr: USER, pwd: PASS }).toString();
  const res = await fetch(`${BASE}/api/method/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    redirect: 'follow',
  });
  captureCookies(res);
  if (!res.ok) throw new Error(`Login failed: HTTP ${res.status}`);
  console.log('Logged in.');
}

async function api(method, path, body) {
  const headers = { Cookie: cookieHeader, Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  captureCookies(res);
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { return text; }
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Map item names to specific keyword queries for better results.
function queryFor(itemName) {
  const n = itemName.toLowerCase();
  const overrides = [
    ['biryani', 'biryani,rice,indian'],
    ['breakfast combo', 'breakfast,platter'],
    ['butter naan', 'naan,bread,indian'],
    ['naan', 'naan,bread'],
    ['buttermilk', 'buttermilk,lassi,drink'],
    ['brownie', 'brownie,icecream,dessert'],
    ['butter chicken', 'butter-chicken,curry'],
    ['signature curry', 'curry,indian,gravy'],
    ['chana masala', 'chana-masala,chickpea,curry'],
    ['cheese ball', 'cheese-balls,fried,snack'],
    ['cheesecake', 'cheesecake,dessert'],
    ['thali', 'thali,indian-meal'],
    ['chicken', 'chicken,curry,indian'],
    ['paneer', 'paneer,indian,curry'],
    ['dosa', 'dosa,south-indian'],
    ['idli', 'idli,south-indian'],
    ['samosa', 'samosa,snack,indian'],
    ['lassi', 'lassi,drink,indian'],
    ['tea', 'tea,chai'],
    ['coffee', 'coffee'],
    ['juice', 'juice,fruit'],
    ['ice cream', 'icecream,dessert'],
    ['pizza', 'pizza'],
    ['burger', 'burger'],
    ['pasta', 'pasta,italian'],
    ['salad', 'salad'],
    ['soup', 'soup'],
    ['rice', 'rice,indian'],
    ['roti', 'roti,bread,indian'],
    ['paratha', 'paratha,indian-bread'],
    ['dal', 'dal,lentil,indian'],
  ];
  for (const [needle, q] of overrides) if (n.includes(needle)) return q;
  // generic food fallback using the item name itself
  const safe = n.replace(/[^a-z0-9 ]+/g, '').trim().split(/\s+/).slice(0, 3).join(',');
  return safe ? `${safe},food` : 'food,dish';
}

function imageUrlFor(itemName) {
  const q = queryFor(itemName);
  // `lock` makes the chosen image stable per item (deterministic from name).
  const lock = Math.abs([...slug(itemName)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0));
  return `https://loremflickr.com/640/480/${encodeURIComponent(q)}?lock=${lock}`;
}

async function fetchAllItems() {
  const out = [];
  let start = 0;
  const page = 200;
  for (;;) {
    const res = await api(
      'GET',
      `/api/method/pos_api.api.get_items?limit_start=${start}&limit_page_length=${page}`,
    );
    const msg = res?.message ?? {};
    const rows = msg.items || msg.products || msg.data || (Array.isArray(msg) ? msg : []);
    out.push(...rows);
    if (rows.length < page) break;
    start += page;
  }
  return out;
}

async function setImage(name, url) {
  // Use frappe.client.set_value — works for any field on the Item doctype.
  const body = new URLSearchParams({
    doctype: 'Item',
    name,
    fieldname: 'image',
    value: url,
  }).toString();
  const headers = {
    Cookie: cookieHeader,
    Accept: 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  const res = await fetch(`${BASE}/api/method/frappe.client.set_value`, {
    method: 'POST',
    headers,
    body,
  });
  captureCookies(res);
  const text = await res.text();
  if (!res.ok) throw new Error(`set_value ${name} -> ${res.status}: ${text.slice(0, 300)}`);
  return text;
}

(async () => {
  await login();
  const items = await fetchAllItems();
  console.log(`Found ${items.length} items.`);
  const targets = items.filter((it) => !it.disabled && (OVERWRITE || !it.image));
  console.log(`Will ${DRY ? 'preview' : 'update'} ${targets.length} items.`);

  let ok = 0, fail = 0;
  for (const it of targets) {
    const docName = it.name || it.item_code;
    const label = it.item_name || docName;
    const url = imageUrlFor(label);
    console.log(`${DRY ? '[dry]' : '[set]'} ${docName}  ::  ${label}  ->  ${url}`);
    if (DRY) continue;
    try {
      await setImage(docName, url);
      ok++;
    } catch (e) {
      fail++;
      console.error(`  FAIL: ${e.message}`);
    }
  }
  if (!DRY) console.log(`Done. updated=${ok} failed=${fail}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
