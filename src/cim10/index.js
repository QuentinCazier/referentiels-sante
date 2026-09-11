/**
 * CIM-10 FR à usage PMSI (ATIH) depuis les fichiers ClaML publiés chaque
 * année. ClaML (Classification Markup Language) est un XML : une balise
 * Class par chapitre, bloc ou catégorie, avec ses sous-classes et des
 * rubriques (libellé préféré, inclusions, exclusions, notes).
 *
 * La classification appartient à l'OMS et à l'ATIH : l'outil convertit le
 * fichier téléchargé à la source, il ne redistribue rien.
 */

import { join } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { telecharger } from '../commun/telecharger.js';
import { lireZip } from '../commun/zip.js';
import { analyserXml, chercher, enfants, texteDe } from '../commun/xml.js';
import { EcrivainCsv } from '../commun/csv.js';

const BASE = 'https://www.atih.sante.fr/sites/default/files/public/content';

/** Éditions dont le ClaML est publié par l'ATIH. */
export const EDITIONS = {
  2024: `${BASE}/4674/cim10fr2024syst_claml_20231215.zip`,
  2025: `${BASE}/4901/cim10frfm2025syst_claml_20241216_0.zip`,
};

export const PAGE_ATIH = 'https://www.atih.sante.fr/nomenclatures-de-recueil-de-linformation/cim-10';

export const COLONNES_CODES = [
  'code', 'niveau', 'libelle', 'parent', 'chapitre', 'bloc', 'profondeur', 'usage', 'variantes',
  'inclusions', 'exclusions', 'notes', 'definitions', 'nb_sous_classes', 'sous_classes',
];

const NIVEAUX = { chapter: 'chapitre', block: 'bloc', category: 'categorie' };

function rubriques(classe, kind) {
  return enfants(classe, 'Rubric')
    .filter((r) => r.attributs.kind === kind)
    .map((r) => enfants(r, 'Label').map(texteDe).filter(Boolean).join(' '))
    .filter(Boolean);
}

/**
 * Convertit le texte d'un fichier ClaML en liste de codes normalisés.
 * @returns {{ meta: object, codes: object[] }}
 */
export function convertirClaml(xml) {
  const racine = analyserXml(xml);
  const meta = {};
  for (const m of enfants(racine, 'Meta')) meta[m.attributs.name] = m.attributs.value;
  const titre = racine.enfants.find((e) => e.nom === 'Title');
  meta.titre = titre ? texteDe(titre) : null;
  meta.version = titre?.attributs.version ?? null;
  meta.date = titre?.attributs.date ?? null;
  const identifiant = racine.enfants.find((e) => e.nom === 'Identifier');
  meta.autorite = identifiant?.attributs.authority ?? null;
  meta.edition = identifiant?.attributs.uid ?? null;

  const classes = [...chercher(racine, 'Class')];
  const parCode = new Map();
  for (const c of classes) {
    const superClasse = enfants(c, 'SuperClass')[0]?.attributs.code ?? null;
    const sousClasses = enfants(c, 'SubClass').map((s) => s.attributs.code);
    const variantes = new Set();
    for (const r of enfants(c, 'Rubric')) for (const l of enfants(r, 'Label')) if (l.attributs.variants) variantes.add(l.attributs.variants);
    if (c.attributs.variants) variantes.add(c.attributs.variants);
    parCode.set(c.attributs.code, {
      code: c.attributs.code,
      niveau: NIVEAUX[c.attributs.kind] ?? c.attributs.kind,
      libelle: rubriques(c, 'preferred')[0] ?? null,
      parent: superClasse,
      chapitre: null,
      bloc: null,
      profondeur: 0,
      usage: c.attributs.usage ?? null,
      variantes: [...variantes].join('|') || null,
      inclusions: rubriques(c, 'inclusion').join(' | ') || null,
      exclusions: rubriques(c, 'exclusion').join(' | ') || null,
      notes: rubriques(c, 'note').join(' | ') || null,
      definitions: rubriques(c, 'definition').join(' | ') || null,
      nb_sous_classes: sousClasses.length,
      sous_classes: sousClasses.join('|') || null,
    });
  }

  // Chapitre, bloc et profondeur par remontée des parents.
  for (const code of parCode.values()) {
    let courant = code;
    let profondeur = 0;
    const visites = new Set();
    while (courant.parent && parCode.has(courant.parent) && !visites.has(courant.parent)) {
      visites.add(courant.parent);
      courant = parCode.get(courant.parent);
      profondeur++;
      if (courant.niveau === 'chapitre' && !code.chapitre) code.chapitre = courant.code;
      if (courant.niveau === 'bloc' && !code.bloc) code.bloc = courant.code;
    }
    if (code.niveau === 'chapitre') code.chapitre = code.code;
    if (code.niveau === 'bloc') code.bloc = code.code;
    code.profondeur = profondeur;
  }

  return { meta, codes: [...parCode.values()] };
}

/**
 * Télécharge (ou lit) une archive ClaML et écrit cim10-codes.csv, cim10-codes.json
 * et cim10-resume.json dans `sortie`.
 */
export async function exporterCim10({ edition, source, sortie = 'data/cim10', cache = '.cache', forcer = false, journal = () => {} }) {
  let chemin;
  if (source && !/^https?:/.test(source)) chemin = source;
  else {
    const url = source ?? EDITIONS[edition];
    if (!url) throw new Error(`édition ${edition} inconnue : indiquez l'URL ou le fichier ClaML (voir ${PAGE_ATIH})`);
    chemin = join(cache, 'cim10', url.split('/').pop());
    await telecharger(url, chemin, { forcer, journal });
  }

  let xml;
  if (chemin.toLowerCase().endsWith('.zip')) {
    const entrees = lireZip(chemin);
    const nom = [...entrees.keys()].find((n) => n.toLowerCase().endsWith('.xml'));
    if (!nom) throw new Error('aucun fichier XML dans l\'archive ClaML');
    xml = entrees.get(nom).toString('utf8');
  } else xml = readFileSync(chemin, 'utf8');

  const { meta, codes } = convertirClaml(xml);
  mkdirSync(sortie, { recursive: true });
  const csv = new EcrivainCsv(join(sortie, 'cim10-codes.csv'), COLONNES_CODES);
  for (const c of codes) await csv.ecrire(c);
  await csv.fermer();
  writeFileSync(join(sortie, 'cim10-codes.json'), JSON.stringify(codes, null, 0) + '\n');

  const parNiveau = {};
  for (const c of codes) parNiveau[c.niveau] = (parNiveau[c.niveau] || 0) + 1;
  const resume = {
    source: chemin, edition: edition ?? meta.edition ?? null, converti: new Date().toISOString(),
    titre: meta.titre, version: meta.version, dateEdition: meta.date, copyright: meta.copyright ?? null,
    codes: codes.length, parNiveau, fichiers: ['cim10-codes.csv', 'cim10-codes.json'],
  };
  writeFileSync(join(sortie, 'cim10-resume.json'), JSON.stringify(resume, null, 2) + '\n');
  return resume;
}
