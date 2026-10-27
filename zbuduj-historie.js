// ============================================================
//  JEDNORAZOWE ZBUDOWANIE HISTORII BOSSOW (2.99.30)
//
//  Przechodzi cala historie statystyk z tibiamaps (archiwum od
//  2022-08-23 i repo glowne od 2025-12-06) oraz nasze pliki z data/,
//  dla WSZYSTKICH swiatow, i zapisuje same ubicia bossow do
//  historia/<swiat>.json. Pelnych plikow nie kopiujemy (kilkanascie GB).
//
//  Repo zrodlowe klonowane czesciowo (bez tresci plikow), potem po
//  jednym swiecie: tylko jego folder, przetworzenie, nastepny.
//  Odpalany recznie: Actions, "Zbuduj historie bossow".
// ============================================================
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const H = require('./historia.js');

const ZRODLA = [
    'https://github.com/tibiamaps/tibia-kill-stats-from-2022-08-23-to-2025-12-04.git',
    'https://github.com/tibiamaps/tibia-kill-stats.git'
];
const sh = (cmd, cwd) => execSync(cmd, { cwd: cwd, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }).toString();

const szukaj = H.dopasowanie();
const historie = {};
const h = (swiat) => historie[swiat] || (historie[swiat] = { swiat: swiat, pob: [], b: {} });
const PLIK = /^(\d{4}-\d{2}-\d{2})\.json$/;

function przetworzFolder(swiat, katalog) {
    let ile = 0;
    if (!fs.existsSync(katalog)) return 0;
    fs.readdirSync(katalog).forEach(f => {
        const m = f.match(PLIK);
        if (!m) return;
        try {
            const tresc = JSON.parse(fs.readFileSync(path.join(katalog, f), 'utf8'));
            if (H.dopisz(h(swiat), tresc, m[1], szukaj)) ile++;
        } catch (e) { /* uszkodzony plik: pomijamy */ }
    });
    return ile;
}

for (const url of ZRODLA) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zrodlo-'));
    console.log('Klonuje ' + url);
    sh('git clone -q --filter=blob:none --no-checkout --depth 1 ' + url + ' src', tmp);
    const src = path.join(tmp, 'src');
    sh('git sparse-checkout init --cone', src);
    const galaz = sh('git rev-parse --abbrev-ref HEAD', src).trim() || 'main';
    const swiaty = sh('git ls-tree --name-only HEAD data/', src).split('\n')
        .map(s => s.trim().replace(/^data\//, '')).filter(Boolean);
    // TYLKO=thyria,antica: test na kilku swiatach.
    const tylko = (process.env.TYLKO || '').split(',').map(x => x.trim()).filter(Boolean);
    const wybrane = tylko.length ? swiaty.filter(s => tylko.indexOf(s) !== -1) : swiaty;
    console.log('  swiatow: ' + wybrane.length + ' z ' + swiaty.length);
    wybrane.forEach((swiat, i) => {
        sh('git sparse-checkout set data/' + swiat, src);
        if (i === 0) sh('git checkout -q ' + galaz, src);
        const ile = przetworzFolder(swiat, path.join(src, 'data', swiat));
        console.log('  ' + swiat + ': ' + ile + ' dni');
    });
    fs.rmSync(tmp, { recursive: true, force: true });
}

// Nasze wlasne pliki (od 27.10.2026) na koncu: uzupelniaja luki tibiamaps.
if (fs.existsSync('data')) {
    fs.readdirSync('data').forEach(swiat => { przetworzFolder(swiat, path.join('data', swiat)); });
}

Object.keys(historie).forEach(s => H.zapisz(historie[s]));
console.log('Zapisane historie: ' + Object.keys(historie).length);
