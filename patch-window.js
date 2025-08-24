const fs = require('fs');
const path = require('path');

function walk(dir, cb) {
  if (!fs.existsSync(dir)) return;
  const names = fs.readdirSync(dir);
  for (let n of names) {
    const full = path.join(dir, n);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, cb);
    else cb(full);
  }
}

function processFile(file) {
  if (!file.match(/\.(js|jsx|ts|tsx)$/)) return;
  let s;
  try { s = fs.readFileSync(file, 'utf8'); } catch (e) { return; }
  const hasDirective = /^\s*["']use\s+(client|server)["'];?/m.test(s);
  const needsPatch = /@supabase\/supabase-js|@react-native-async-storage\/async-storage|window/.test(s);
  let changed = false;
  if (needsPatch && !hasDirective) {
    if (s.startsWith('#!')) {
      const idx = s.indexOf('
');
      const rest = s.slice(idx + 1);
      s = s.slice(0, idx + 1) + '"use client";
' + rest;
    } else {
      s = '"use client";
' + s;
    }
    changed = true;
    console.log('Added "use client" to', file);
  }
  if (/window/.test(s)) {
    const ns = s.replace(/window/g, 'typeof window !== "undefined" && window');
    if (ns !== s) { s = ns; changed = true; console.log('Patched window checks in', file); }
  }
  if (changed) fs.writeFileSync(file, s, 'utf8');
}

const targets = ['app','src','lib','utils','hooks'];
targets.forEach(t => {
  const dir = path.join(process.cwd(), t);
  console.log('Scanning', dir);
  walk(dir, processFile);
});
console.log('Patch complete.');
