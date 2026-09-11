import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { lireCsv } from '../src/commun/csv.js';
import { codeActivite, statutActivite, capacite, lignesActivites } from '../src/finess/activites.js';
import { libellesVides } from '../src/finess/libelles.js';
import { convertirActivites } from '../src/finess/convertir.js';
import { FIXTURES, dossierTemp } from './_util.js';

const FLUX = join(FIXTURES, 'finess-activites-exemple.json');
const DOCUMENT = JSON.parse(readFileSync(FLUX, 'utf8'));

test('codeActivite suit les règles de construction de l’ANS', () => {
  assert.equal(codeActivite({ codeNature: 'ASR', caracteristiquesSpecifiques: { typeActiviteASR: { activiteSanitaireRegulee: 'R4', modaliteActivite: 'N2', formeActivite: '01' } } }), 'ASR_R4_N2_01');
  assert.equal(codeActivite({ codeNature: 'EML', caracteristiquesSpecifiques: { typeActiviteEML: { typeEmlId: '05602' } } }), 'EML_05602');
  assert.equal(codeActivite({ codeNature: 'ASDR', caracteristiquesSpecifiques: { typeActiviteASDR: { activiteSanitaireDiverseRegulee: '824', modeFonctionnement: '09', public: '990' } } }), 'ASDR_824_09_990');
  assert.equal(codeActivite({ codeNature: 'AMM', caracteristiquesSpecifiques: { typeActiviteAMM: { activiteAMM: '01', modaliteAMM: '02', mentionAMM: null, ptsAMM: 'A', declarationAMM: null } } }), 'AMM_01_02__A_');
  assert.equal(codeActivite({ codeNature: 'XYZ' }), 'XYZ');
  assert.equal(codeActivite(null), null);
});

test('statutActivite distingue inactive, mise en œuvre et non mise en œuvre', () => {
  assert.equal(statutActivite({ caracteristiquesGeneriques: { etatObjet: 'I' } }), 3);
  assert.equal(statutActivite({ caracteristiquesGeneriques: { etatObjet: 'A' }, evenement: [] }), 2);
  assert.equal(statutActivite({ caracteristiquesGeneriques: { etatObjet: 'A' }, evenement: [
    { codeEvenement: '12', dateEvenement: '2020-01-01' }, { codeEvenement: '15', dateEvenement: '2021-01-01' },
  ] }), 2);
  assert.equal(statutActivite({ caracteristiquesGeneriques: { etatObjet: 'A' }, evenement: [
    { codeEvenement: '15', dateEvenement: '2020-01-01' }, { codeEvenement: '12', dateEvenement: '2021-01-01' }, { codeEvenement: '010', dateEvenement: '2022-01-01' },
  ] }), 1);
});

test('capacite ne somme que les capacités totales du statut demandé', () => {
  const caps = [
    { statutCapacite: '09', nombre: '4' },
    { statutCapacite: '09', nombre: '2', modeFinancement: 'X' },
    { statutCapacite: '01', nombre: '10' },
    { statutCapacite: '09', nombre: 'abc' },
  ];
  assert.equal(capacite(caps, '09'), 4);
  assert.equal(capacite(caps, '01'), 10);
  assert.equal(capacite(null, '01'), 0);
});

test('lignesActivites relie une activité exercée à son autorisation', () => {
  const pmej = DOCUMENT.pmej.find((p) => p.numFiness === '010000156');
  const lignes = lignesActivites(pmej, libellesVides(), '2026-04-01');
  const nbAutorisees = pmej.activitesAutorisees.length;
  const nbExercees = pmej.ege.reduce((n, e) => n + e.activitesExercees.length, 0);
  assert.equal(lignes.length, nbAutorisees + nbExercees);
  const exercee = lignes.find((l) => l.niveau === 'exercee' && l.id_activite === '9482');
  assert.equal(exercee.finess_et, '010780195');
  assert.equal(exercee.code_activite, 'ASR_R4_N2_01');
  assert.equal(exercee.capacite_installee, 4);
  assert.equal(exercee.statut, 2);
  assert.equal(exercee.identifiant_autorisation, '9481');
  const autorisation = lignes.find((l) => l.niveau === 'autorisee' && l.id_activite === '9481');
  assert.ok(autorisation, 'l’autorisation 9481 doit être présente');
  assert.equal(exercee.capacite_autorisee, autorisation.capacite_autorisee);
  assert.equal(lignes.every((l) => l.date_flux === '2026-04-01'), true);
});

test('convertirActivites écrit le CSV et le résumé', async () => {
  const sortie = dossierTemp();
  const resume = await convertirActivites({ entree: FLUX, sortie, libelles: libellesVides() });
  const attenduA = DOCUMENT.pmej.reduce((n, p) => n + p.activitesAutorisees.length, 0);
  const attenduE = DOCUMENT.pmej.reduce((n, p) => n + p.ege.reduce((m, e) => m + e.activitesExercees.length, 0), 0);
  assert.equal(resume.activitesAutorisees, attenduA);
  assert.equal(resume.activitesExercees, attenduE);
  const lignes = lireCsv(readFileSync(join(sortie, 'activites.csv'), 'utf8'));
  assert.equal(lignes.length, attenduA + attenduE);
  assert.ok(lignes.every((l) => ['autorisee', 'exercee'].includes(l.niveau)));
  assert.ok(lignes.every((l) => ['1', '2', '3'].includes(l.statut)));
});
