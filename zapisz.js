// ============================================================
//  KOPIA STATYSTYK ZABIC (The Hunting Grimoire, 2.99.29)
//
//  Codziennie zapisuje statystyki zabic wszystkich swiatow z TibiaData
//  do data/<swiat>/<RRRR-MM-DD>.json, w tym samym formacie co
//  tibiamaps/tibia-kill-stats. Data pliku = dzien pobrania (UTC),
//  ubicia w srodku sa z doby poprzedniej, tak jak u tibiamaps.
//
//  Odpalany przez GitHub Actions (.github/workflows/zapisz.yml).
//  Bez zaleznosci: Node 20 ma wbudowany fetch.
// ============================================================
const fs = require('fs');
const path = require('path');
const H = require('./historia.js');   // dopisywanie do historia/<swiat>.json (2.99.30)

const API = 'https://api.tibiadata.com/v4';
const DZIS = new Date().toISOString().slice(0, 10);
const spij = (ms) => new Promise(r => setTimeout(r, ms));

async function json(url) {
    for (let proba = 0; proba < 3; proba++) {
        try {
            const r = await fetch(url, { headers: { 'User-Agent': 'tibia-kill-stats-kopia' } });
            if (r.ok) return await r.json();
        } catch (e) { /* ponawiamy */ }
        await spij(3000 * (proba + 1));
    }
    return null;
}

const szukaj = H.dopasowanie();

// Najnowszy plik swiata sprzed podanej daty albo null.
function najnowszyPlik(katalog, przed) {
    if (!fs.existsSync(katalog)) return null;
    const l = fs.readdirSync(katalog).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f.slice(0, 10) < przed).sort();
    return l.length ? path.join(katalog, l[l.length - 1]) : null;
}

async function main() {
    const lista = await json(API + '/worlds');
    const swiaty = (lista && lista.worlds && lista.worlds.regular_worlds || []).map(w => w.name);
    if (!swiaty.length) { console.log('Brak listy swiatow z TibiaData.'); process.exitCode = 1; return; }

    let zapisane = 0, juzBylo = 0, nieswieze = 0, bledy = 0;
    for (const swiat of swiaty) {
        const katalog = path.join('data', swiat.toLowerCase());
        const plik = path.join(katalog, DZIS + '.json');
        if (fs.existsSync(plik)) { juzBylo++; continue; }

        const d = await json(API + '/killstatistics/' + encodeURIComponent(swiat));
        await spij(300);
        const wpisy = d && d.killstatistics && d.killstatistics.entries;
        if (!Array.isArray(wpisy) || !wpisy.length) { bledy++; continue; }

        // NIESWIEZE: te same liczby co w NAJNOWSZYM zapisanym pliku znacza,
        // ze tibia.com albo TibiaData jeszcze nie przeliczyly doby. Nie
        // zapisujemy, druga proba (pozniej w ciagu dnia) to zalatwi.
        // Najnowszy, nie wczorajszy (audyt 28.10): po dniu przerwy
        // wczorajszego pliku nie ma i stare liczby szly pod dzisiejsza data,
        // czyli ubicia przesuwaly sie o dobe.
        const poprzedni = najnowszyPlik(katalog, DZIS);
        if (poprzedni) {
            try {
                const stary = JSON.parse(fs.readFileSync(poprzedni, 'utf8'));
                if (JSON.stringify(stary.killstatistics.entries) === JSON.stringify(wpisy)) { nieswieze++; continue; }
            } catch (e) { /* uszkodzony plik: zapisujemy dzisiejszy */ }
        }

        fs.mkdirSync(katalog, { recursive: true });
        fs.writeFileSync(plik, JSON.stringify(d));
        zapisane++;
        // Historia bossow: dopisujemy dzisiejszy plik.
        try {
            const h = H.wczytaj(swiat.toLowerCase());
            H.dopisz(h, d, DZIS, szukaj);
            H.zapisz(h);
        } catch (e) { console.log('historia ' + swiat + ': ' + e.message); }
    }
    console.log(DZIS + ': zapisane ' + zapisane + ', juz byly ' + juzBylo
        + ', nieswieze ' + nieswieze + ', bledy ' + bledy + ' (swiatow ' + swiaty.length + ')');
}

main();
