import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parserTabs, conceptsDepuisTabs, indexLibelles, urlTable, TABLES } from '../src/nos/index.js';
import { FIXTURES } from './_util.js';

const TEXTE = readFileSync(join(FIXTURES, 'nos-TRE_R66-exemple.tabs'), 'utf8');

test('parserTabs lit descripteur, colonnes et lignes', () => {
  const { descripteur, colonnes, lignes } = parserTabs(TEXTE);
  assert.equal(descripteur['Nom fichier'], 'TRE_R66_CategorieEtablissement.tabs');
  assert.equal(descripteur.OID, '1.2.250.1.213.1.6.1.8');
  assert.deepEqual(colonnes.slice(0, 3), ['OID', 'Code', 'Libellé adapté']);
  assert.equal(lignes.length, 14);
});

test('conceptsDepuisTabs normalise les concepts', () => {
  const table = conceptsDepuisTabs(TEXTE);
  assert.equal(table.nom, 'TRE_R66_CategorieEtablissement');
  assert.equal(table.dateMaj, '2026-05-05');
  const ch = table.concepts.find((c) => c.code === '355');
  assert.equal(ch.libelle, 'Centre hospitalier (CH)');
  assert.equal(ch.libelleCourt, 'C.H.');
  assert.equal(ch.dateDebut, '1979-01-01');
  assert.equal(ch.dateFin, null);
  assert.equal(ch.actif, true);
  const ferme = table.concepts.find((c) => c.code === '001');
  assert.equal(ferme.actif, false);
  assert.equal(ferme.dateFin, '1999-09-15');
});

test('indexLibelles privilégie le concept actif en cas de doublon', () => {
  const table = { concepts: [
    { code: 'X', libelle: 'Ancien', actif: false },
    { code: 'X', libelle: 'Nouveau', actif: true },
    { code: 'Y', libelle: 'Seul', actif: false },
  ] };
  const index = indexLibelles(table);
  assert.equal(index.get('X'), 'Nouveau');
  assert.equal(index.get('Y'), 'Seul');
});

test('urlTable construit l’adresse officielle', () => {
  assert.equal(urlTable(TABLES.categorieEtablissement),
    'https://mos.esante.gouv.fr/NOS/TRE_R66-CategorieEtablissement/TRE_R66-CategorieEtablissement.tabs');
});
