// ============================================================
//  HISTORIA BOSSOW: WSPOLNE FUNKCJE (2.99.30)
//
//  historia/<swiat>.json = {
//    swiat, zbudowano,
//    pob: ['RRRR-MM-DD', ...]      doby ubic, dla ktorych byl plik statystyk
//    b:   { boss: { 'RRRR-MM-DD': ile } }   ubicia bossow w tej dobie
//  }
//  Ten sam ksztalt co globalBossyIle w apce. Doba ubicia = data pliku
//  minus jeden dzien (plik z dnia D ma ubicia z doby D-1).
//
//  Dopasowanie nazw jak w nazwy_bossow.js apki: znormalizowana nazwa,
//  bez nawiasu, liczba mnoga, aliasy z bossy.json.
// ============================================================
const fs = require('fs');
const path = require('path');

const norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9]/g, '');
function mnoga(t) {
    const n = norm(t);
    if (/(s|x|z|ch|sh)$/.test(n)) return n + 'es';
    if (/y$/.test(n)) return n.slice(0, -1) + 'ies';
    return n + 's';
}

function dopasowanie() {
    const b = JSON.parse(fs.readFileSync(path.join(__dirname, 'bossy.json'), 'utf8'));
    const mapa = {};
    b.nazwy.forEach(n => {
        const w = [norm(n), norm(String(n).replace(/\s*\([^)]*\)\s*$/, '')), mnoga(n)];
        mapa[w[0]] = n;
        w.slice(1).forEach(x => { if (x && !mapa[x]) mapa[x] = n; });
    });
    Object.keys(b.aliasy || {}).forEach(a => { mapa[norm(a)] = b.aliasy[a]; });
    return (race) => mapa[norm(race)] || null;
}

function dobaZPliku(dataPliku) {
    return new Date(Date.parse(dataPliku + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
}

function wczytaj(swiat) {
    const p = path.join('historia', swiat + '.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch (e) { return { swiat: swiat, pob: [], b: {} }; }
}

// Dopisuje jeden plik statystyk (tresc + data pliku) do historii swiata.
function dopisz(h, plik, dataPliku, szukaj) {
    const wpisy = plik && plik.killstatistics && plik.killstatistics.entries;
    if (!Array.isArray(wpisy)) return false;
    const doba = dobaZPliku(dataPliku);
    if (h.pob.indexOf(doba) === -1) h.pob.push(doba);
    wpisy.forEach(e => {
        if (!(e.last_day_killed > 0)) return;
        const boss = szukaj(e.race);
        if (!boss) return;
        (h.b[boss] || (h.b[boss] = {}))[doba] = e.last_day_killed;
    });
    return true;
}

function zapisz(h) {
    h.pob.sort();
    h.zbudowano = new Date().toISOString();
    const b = {};
    Object.keys(h.b).sort().forEach(k => {
        const d = {};
        Object.keys(h.b[k]).sort().forEach(x => { d[x] = h.b[k][x]; });
        b[k] = d;
    });
    h.b = b;
    fs.mkdirSync('historia', { recursive: true });
    fs.writeFileSync(path.join('historia', h.swiat + '.json'), JSON.stringify(h));
}

module.exports = { dopasowanie, dobaZPliku, wczytaj, dopisz, zapisz };
