import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { lireEnteteDbf, lireDbf, chargerDbf, decoderCp850 } from '../src/commun/dbf.js';
import { analyserXml, texteDe, enfants, enfant, chercher, decoderEntites } from '../src/commun/xml.js';
import { construireDbf } from './_dbf.js';
import { dossierTemp } from './_util.js';

const CHAMPS = [
  { nom: 'CODE', type: 'C', longueur: 7 },
  { nom: 'LIBELLE', type: 'C', longueur: 40 },
  { nom: 'PRIX', type: 'N', longueur: 7, decimales: 2 },
  { nom: 'DT_EFFET', type: 'D', longueur: 8 },
  { nom: 'ACTIF', type: 'L', longueur: 1 },
];

test('decoderCp850 restitue les accents de la page de code DOS', () => {
  assert.equal(decoderCp850(Buffer.from([0x61, 0x64, 0x68, 0x82, 0x72, 0x65, 0x6e, 0x74])), 'adhérent');
  assert.equal(decoderCp850(Buffer.from([0x31, 0xf8])), '1°');
  assert.equal(decoderCp850(Buffer.from([0x85, 0x87, 0x88, 0x93, 0x96])), 'àçêôû');
});

test('lireDbf lit en-tête, types et ignore les enregistrements supprimés', async () => {
  const dossier = dossierTemp();
  const chemin = join(dossier, 'test.dbf');
  writeFileSync(chemin, construireDbf(CHAMPS, [
    { CODE: 'ZBQK002', LIBELLE: 'Radiographie du thorax', PRIX: '21.28', DT_EFFET: '20100201', ACTIF: 'T' },
    { CODE: 'SUPPR', LIBELLE: 'supprimé', PRIX: '1', DT_EFFET: '20000101', ACTIF: 'F' },
    { CODE: 'AAFA002', LIBELLE: 'Exérèse de tumeur cérébrale', PRIX: '', DT_EFFET: '', ACTIF: '' },
  ], { supprimes: [1] }));

  const entete = lireEnteteDbf(chemin);
  assert.equal(entete.nombre, 3);
  assert.deepEqual(entete.champs.map((c) => c.nom), ['CODE', 'LIBELLE', 'PRIX', 'DT_EFFET', 'ACTIF']);
  assert.equal(entete.champs[2].decimales, 2);

  const lignes = await chargerDbf(chemin);
  assert.equal(lignes.length, 2);
  assert.deepEqual(lignes[0], { CODE: 'ZBQK002', LIBELLE: 'Radiographie du thorax', PRIX: 21.28, DT_EFFET: '2010-02-01', ACTIF: true });
  assert.deepEqual(lignes[1], { CODE: 'AAFA002', LIBELLE: 'Exérèse de tumeur cérébrale', PRIX: null, DT_EFFET: null, ACTIF: null });

  const brutes = [];
  for await (const l of lireDbf(chemin, { brut: true })) brutes.push(l);
  assert.equal(brutes[0].PRIX, '  21.28');
});

test('lireDbf reste correct quand un enregistrement chevauche deux morceaux du flux', async () => {
  const dossier = dossierTemp();
  const chemin = join(dossier, 'gros.dbf');
  const champs = [{ nom: 'N', type: 'N', longueur: 6 }, { nom: 'TXT', type: 'C', longueur: 250 }];
  const lignes = Array.from({ length: 2000 }, (_, i) => ({ N: String(i), TXT: `ligne ${i} é` }));
  writeFileSync(chemin, construireDbf(champs, lignes));
  const lues = await chargerDbf(chemin);
  assert.equal(lues.length, 2000);
  assert.deepEqual(lues[1999], { N: 1999, TXT: 'ligne 1999 é' });
});

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ClaML SYSTEM "ClaML.dtd">
<!-- commentaire -->
<ClaML version="2.0.0">
  <Meta name="lang" value="fr"/>
  <Class code="I21" kind="category">
    <SuperClass code="I20-I25"/>
    <SubClass code="I21.0"/>
    <Rubric kind="preferred"><Label xml:lang="fr">Infarctus aigu &amp; r&#233;cent <Reference code="I23">I23.-</Reference></Label></Rubric>
    <Rubric kind='exclusion'><Label><Fragment type="list">infarctus :</Fragment><Fragment>ancien</Fragment></Label></Rubric>
    <Note><![CDATA[a < b]]></Note>
  </Class>
</ClaML>`;

test('analyserXml construit l’arbre, décode entités et CDATA', () => {
  const racine = analyserXml(XML);
  assert.equal(racine.nom, 'ClaML');
  assert.equal(racine.attributs.version, '2.0.0');
  const classe = enfant(racine, 'Class');
  assert.equal(classe.attributs.code, 'I21');
  assert.equal(enfant(classe, 'SuperClass').attributs.code, 'I20-I25');
  const rubriques = enfants(classe, 'Rubric');
  assert.equal(rubriques.length, 2);
  assert.equal(texteDe(enfant(rubriques[0], 'Label')), 'Infarctus aigu & récent I23.-');
  assert.equal(texteDe(enfant(rubriques[1], 'Label')), 'infarctus :ancien');
  assert.equal(texteDe(enfant(classe, 'Note')), 'a < b');
  assert.equal([...chercher(racine, 'SubClass')].length, 1);
  assert.equal(decoderEntites('&lt;a&gt; &#x41; &inconnu;'), '<a> A &inconnu;');
});

test('analyserXml signale un document mal formé', () => {
  assert.throws(() => analyserXml('<a><b></a>'), /fermeture inattendue/);
});
