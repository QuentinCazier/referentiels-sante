/**
 * Nomenclatures des objets de santé (NOS) publiées par l'Agence du Numérique
 * en Santé : tables de référence (TRE), jeux de valeurs (JDV) et associations
 * (ASS). Chaque table est publiée en XML SVS, en JSON FHIR et dans un format
 * texte « .tabs » à séparateur « ; », que l'on lit ici.
 *
 *   ligne 1 : en-tête du descripteur de fichier
 *   ligne 2 : descripteur (OID, type, nom, description, URL, dates)
 *   ligne 3 : en-tête des colonnes de données
 *   lignes suivantes : les données
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { telecharger } from '../commun/telecharger.js';
import { dateIso } from '../commun/dates.js';
import { EcrivainCsv } from '../commun/csv.js';

export const URL_NOS = 'https://mos.esante.gouv.fr/NOS';

/** Tables utilisées par ce projet (clé courte vers nom officiel). */
export const TABLES = {
  categorieEtablissement: 'TRE_R66-CategorieEtablissement',
  agregatCategorieNiv1: 'TRE_R63-AgregatCategorieEtablissementNiv1',
  agregatCategorieNiv2: 'TRE_R64-AgregatCategorieEtablissementNiv2',
  associationAgregatCategorie: 'ASS_X10-AgregatCategorieEtablissement',
  statutJuridique: 'TRE_R72-FinessStatutJuridique',
  agregatStatutNiv1: 'TRE_R68-FinessAgregatStatutJuridiqueNiv1',
  agregatStatutNiv2: 'TRE_R69-FinessAgregatStatutJuridiqueNiv2',
  espic: 'TRE_R73-ESPIC',
  modeFixationTarifaire: 'TRE_R74-ModeFixationTarifaire',
  departement: 'TRE_G09-DepartementOM',
  region: 'TRE_R30-RegionOM',
  activiteSanitaireRegulee: 'TRE_R274-ActiviteSanitaireRegulee',
  modaliteActivite: 'TRE_R275-ModaliteActivite',
  formeActivite: 'TRE_R276-FormeActivite',
  equipementMaterielLourd: 'TRE_R272-EquipementMaterielLourd',
  typeFermeture: 'TRE_R286-TypeFermeture',
  autoriteEnregistrement: 'TRE_R60-AutoriteEnregistrement',
};

export function urlTable(nom) {
  return `${URL_NOS}/${nom}/${nom}.tabs`;
}

const nettoyerEntete = (s) => s.trim().replace(/^<|>$/g, '');

/**
 * Analyse un fichier .tabs. Renvoie le descripteur, les colonnes et les lignes
 * brutes (objets clés par nom de colonne).
 */
export function parserTabs(texte) {
  const lignes = texte.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lignes.length < 3) throw new Error('fichier .tabs incomplet');
  // La description du descripteur peut contenir des retours à la ligne : l'en-tête
  // des colonnes de données est la première ligne suivante qui commence par « < ».
  let indexEntete = lignes.findIndex((l, i) => i >= 1 && l.trimStart().startsWith('<'));
  if (indexEntete < 0) indexEntete = 2;
  const entetesDescripteur = lignes[0].split(';').map(nettoyerEntete);
  const valeursDescripteur = lignes.slice(1, indexEntete).join(' ').split(';');
  const descripteur = Object.fromEntries(entetesDescripteur.map((e, i) => [e, valeursDescripteur[i] ?? '']));
  const colonnes = lignes[indexEntete].split(';').map(nettoyerEntete);
  const donnees = lignes.slice(indexEntete + 1).map((l) => {
    const v = l.split(';');
    return Object.fromEntries(colonnes.map((c, i) => [c, (v[i] ?? '').trim()]));
  });
  return { descripteur, colonnes, lignes: donnees };
}

/**
 * Transforme une TRE ou un JDV en liste de concepts normalisés :
 * { code, libelle, libelleCourt, libelleLong, dateDebut, dateFin, dateMaj, actif }
 * Les TRE portent trois libellés et des dates ; les JDV (jeux de valeurs) se
 * limitent souvent à OID, code et un seul libellé.
 */
export function conceptsDepuisTabs(texte) {
  const { descripteur, lignes } = parserTabs(texte);
  const concepts = lignes.map((l) => ({
    code: l.Code,
    libelle: l['Libellé adapté'] || l['Libellé'] || l['Libellé long'] || l['Libellé court'] || '',
    libelleCourt: l['Libellé court'] || null,
    libelleLong: l['Libellé long'] || null,
    dateDebut: dateIso(l['Date valid']),
    dateFin: dateIso(l['Date fin']),
    dateMaj: dateIso(l['Date MàJ']),
    actif: !l['Date fin'],
  }));
  return {
    nom: descripteur['Nom fichier']?.replace(/\.tabs$/, '') ?? null,
    oid: descripteur.OID ?? null,
    description: descripteur.Description ?? null,
    dateMaj: dateIso(descripteur['Date MàJ']),
    concepts,
  };
}

/**
 * Index code vers libellé, en privilégiant le concept encore actif.
 * `champ` choisit le libellé : 'libelle' (adapté), 'libelleLong' ou 'libelleCourt'.
 */
export function indexLibelles(table, champ = 'libelle') {
  const index = new Map();
  for (const c of table.concepts) {
    if (!index.has(c.code) || c.actif) index.set(c.code, c[champ] ?? c.libelle);
  }
  return index;
}

/**
 * Télécharge (avec cache) puis charge une table. `nom` est le nom officiel
 * (TRE_R66-CategorieEtablissement) ou une clé de TABLES.
 */
export async function chargerTable(nom, { cache = '.cache', forcer = false, journal } = {}) {
  const officiel = TABLES[nom] ?? nom;
  const chemin = join(cache, 'nos', `${officiel}.tabs`);
  await telecharger(urlTable(officiel), chemin, { forcer, journal });
  return conceptsDepuisTabs(readFileSync(chemin, 'utf8'));
}

/** Charge une association (ASS) sous forme de lignes brutes. */
export async function chargerAssociation(nom, { cache = '.cache', forcer = false, journal } = {}) {
  const officiel = TABLES[nom] ?? nom;
  const chemin = join(cache, 'nos', `${officiel}.tabs`);
  await telecharger(urlTable(officiel), chemin, { forcer, journal });
  return parserTabs(readFileSync(chemin, 'utf8'));
}

/**
 * Exporte des tables en CSV et JSON dans `sortie`. Renvoie un résumé.
 */
export async function exporterTables(noms, { sortie = 'data/nos', cache, forcer, journal } = {}) {
  const { writeFileSync, mkdirSync } = await import('node:fs');
  mkdirSync(sortie, { recursive: true });
  const resume = [];
  for (const nom of noms) {
    const officiel = TABLES[nom] ?? nom;
    const table = await chargerTable(officiel, { cache, forcer, journal });
    const base = join(sortie, officiel);
    writeFileSync(`${base}.json`, JSON.stringify(table, null, 1) + '\n');
    const csv = new EcrivainCsv(`${base}.csv`, ['code', 'libelle', 'libelleCourt', 'libelleLong', 'dateDebut', 'dateFin', 'actif']);
    for (const c of table.concepts) await csv.ecrire(c);
    await csv.fermer();
    resume.push({ table: officiel, concepts: table.concepts.length, dateMaj: table.dateMaj });
  }
  return resume;
}
