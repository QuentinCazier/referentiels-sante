import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formaterRapport, verifierTout } from '../src/verifier/index.js';
import { versionEnVigueur } from '../src/ccam/index.js';
import { VERSIONS_CONNUES, SOURCES } from '../src/cnam/index.js';
import { dictionnairePour, documenterTable } from '../src/cnam/colonnes.js';

test('dictionnairePour retrouve la table quel que soit le numéro de version', () => {
  assert.ok(dictionnairePour('ucd_total_00802_20260907').code_ucd);
  assert.ok(dictionnairePour('ucd_maj_00802_20260907').code_ucd, 'ucd_maj partage le dictionnaire de ucd_total');
  assert.ok(dictionnairePour('nabm_fiche_tot105').code_nabm);
  assert.ok(dictionnairePour('LPP_histo_tot901').tarif);
  assert.equal(dictionnairePour('table_inconnue42'), null);
});

test('documenterTable produit un tableau Markdown avec la source de chaque description', () => {
  const md = documenterTable('lpp_histo_tot901', ['code_tips', 'tarif', 'pecp01', 'colonne_nouvelle']);
  assert.ok(md.startsWith('### lpp_histo_tot901'));
  assert.match(md, /\| code_tips \| code LPP \| déduit du nom et des valeurs \|/);
  assert.match(md, /\| pecp01 \| non documenté \| non documenté \|/);
  assert.match(md, /\| colonne_nouvelle \| non documenté \| non documenté \|/);
});

test('versionEnVigueur retient la dernière version, ou celle en vigueur à une date', () => {
  const lignes = [
    { CODE: 'A', DT: '2005-07-20', V: 'v1' },
    { CODE: 'A', DT: '2010-01-21', V: 'v2' },
    { CODE: 'A', DT: '2024-03-01', V: 'v3' },
    { CODE: 'B', DT: '2022-01-01', V: 'b1' },
  ];
  assert.equal(versionEnVigueur(lignes, 'CODE', 'DT').get('A').V, 'v3');
  assert.equal(versionEnVigueur(lignes, 'CODE', 'DT', '2015-06-30').get('A').V, 'v2');
  assert.equal(versionEnVigueur(lignes, 'CODE', 'DT', '2010-01-21').get('A').V, 'v2', 'date égale incluse');
  assert.equal(versionEnVigueur(lignes, 'CODE', 'DT', '2005-01-01').has('A'), false, 'pas encore créé');
  assert.equal(versionEnVigueur(lignes, 'CODE', 'DT', '2015-06-30').has('B'), false);
});

test('formaterRapport produit une ligne par contrôle et un bilan', () => {
  const texte = formaterRapport({
    resultats: [
      { source: 'ccam', controle: 'page ameli', ok: true, detail: 'version 08400' },
      { source: 'nabm', controle: 'version de repli à jour', ok: false, detail: 'page : 106, repli : 105' },
    ],
    echecs: [{}],
    date: '2026-09-11T00:00:00Z',
  });
  const lignes = texte.split('\n');
  assert.ok(lignes[0].startsWith('OK    '));
  assert.ok(lignes[1].startsWith('ECHEC '));
  assert.ok(lignes[1].includes('page : 106, repli : 105'));
  assert.equal(lignes.at(-1), '2 contrôles, 1 échec(s), 2026-09-11T00:00:00Z');
});

test('verifierTout refuse une source inconnue sans appel réseau', async () => {
  await assert.rejects(() => verifierTout({ sources: ['inexistante'] }), /source inconnue/);
});

test('les versions de repli CNAM couvrent chaque source', () => {
  for (const nom of Object.keys(SOURCES)) {
    assert.ok(VERSIONS_CONNUES[nom], `repli manquant pour ${nom}`);
    assert.ok(VERSIONS_CONNUES[nom].fichiers.length > 0);
    for (const f of VERSIONS_CONNUES[nom].fichiers) assert.match(f.url, /^http:\/\/www\.codage\.ext\.cnamts\.fr\//);
  }
});
