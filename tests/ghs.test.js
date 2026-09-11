import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { convertirArchive, exporterTarifs } from '../src/ghs/index.js';
import { lireCsv } from '../src/commun/csv.js';
import { construireZip, dossierTemp } from './_util.js';

const latin1 = (s) => Buffer.from(s, 'latin1');

const GHS_PUB = 'GHS-NRO;CMD-COD;DCS-MCO;GHM-NRO;GHS-LIB;SEU-BAS;SEU-HAU;GHS-PRI;EXB-FORFAIT;EXB-JOURNALIER;EXH-PRI;DATE-EFFET\r\n'
  + '22;"01";"C";"01C031";"Craniotomies pour traumatisme, âge supérieur à 17 ans, niveau 1";0;11;4203,57;0;0;124,33;"01/01/2026"\r\n'
  + '25;"01";"C";"01C034";"Craniotomies pour traumatisme, âge supérieur à 17 ans, niveau 4";12;124;18251,79;0;455,54;33,1;"01/01/2026"\r\n';
const GHS_PRI = 'GHS-NRO;CMD-COD;DCS-MCO;GHM-NRO;GHS-LIB;SEU-BAS;SEU-HAU;GHS-PRI;EXB-FORFAIT;EXB-JOURNALIER;EXH-PRI;DATE-EFFET\r\n'
  + '22;"01";"C";"01C031";"Craniotomies";0;0;1800,57;0;0;0;"01/03/2025"\r\n';
const GHT_PRI = 'GHT-NRO;GHT-LIB;GHT-PRI;DATE-EFFET\r\n1;"GHT1";67,3;"01/01/2026"\r\n';
const SUP_PUB = 'CODE;TARIF\r\nREA;1034,68\r\nSTF;503,04\r\n';

function archive() {
  return construireZip([
    { nom: 'ghs_pub.csv', contenu: latin1(GHS_PUB), deflate: true },
    { nom: 'ghs_pri.csv', contenu: latin1(GHS_PRI) },
    { nom: 'ght_pri.csv', contenu: latin1(GHT_PRI), deflate: true },
    { nom: 'sup_pub.csv', contenu: latin1(SUP_PUB) },
    { nom: 'lisez-moi.txt', contenu: 'ignoré' },
  ]);
}

test('convertirArchive décode le latin1, les virgules décimales et les dates', () => {
  const r = convertirArchive(archive());
  assert.equal(r.ghs.length, 3);
  const pub = r.ghs.find((l) => l.secteur === 'public' && l.ghs === '25');
  assert.equal(pub.libelle, 'Craniotomies pour traumatisme, âge supérieur à 17 ans, niveau 4');
  assert.equal(pub.tarif, 18251.79);
  assert.equal(pub.seuil_bas, 12);
  assert.equal(pub.exb_journalier, 455.54);
  assert.equal(pub.exh_journalier, 33.1);
  assert.equal(pub.date_effet, '2026-01-01');
  assert.equal(pub.ghm, '01C034');
  const pri = r.ghs.find((l) => l.secteur === 'prive');
  assert.equal(pri.tarif, 1800.57);
  assert.equal(pri.date_effet, '2025-03-01');
  assert.deepEqual(r.ght, [{ secteur: 'prive', ght: '1', libelle: 'GHT1', tarif: 67.3, date_effet: '2026-01-01' }]);
  assert.deepEqual(r.supplements, [{ secteur: 'public', code: 'REA', tarif: 1034.68 }, { secteur: 'public', code: 'STF', tarif: 503.04 }]);
});

test('exporterTarifs écrit les CSV et le JSON depuis une archive locale', async () => {
  const dossier = dossierTemp();
  const zip = join(dossier, 'ghs_web_test.zip');
  writeFileSync(zip, archive());
  const sortie = join(dossier, 'sortie');
  const resume = await exporterTarifs({ source: zip, sortie, annee: 2026 });
  assert.equal(resume.ghs, 3);
  assert.deepEqual(resume.datesEffet, ['2025-03-01', '2026-01-01']);
  for (const f of ['ghs.csv', 'ght.csv', 'supplements.csv', 'tarifs.json', 'tarifs-resume.json']) {
    assert.ok(existsSync(join(sortie, f)), `fichier manquant : ${f}`);
  }
  const ghs = lireCsv(readFileSync(join(sortie, 'ghs.csv'), 'utf8'));
  assert.equal(ghs.length, 3);
  assert.equal(ghs[0].tarif, '4203.57');
  const json = JSON.parse(readFileSync(join(sortie, 'tarifs.json'), 'utf8'));
  assert.equal(json.resume.campagne, 2026);
  assert.equal(json.ghs[0].tarif, 4203.57);
});
