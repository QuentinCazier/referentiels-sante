/**
 * Aplatissement du flux « activités » FINESS+ : activités autorisées (portées
 * par l'entité juridique) et activités exercées (portées par l'établissement).
 *
 * Les règles de gestion (code d'activité, statut, capacités) suivent le cas
 * d'usage publié par l'ANS dans le dépôt de spécification :
 * use-cases/finess-activites-json-to-table/mapping.md
 */

import { dateIso, texte } from '../commun/dates.js';

export const NATURES = {
  AASA: 'Autre activité de soins autorisée',
  ASR: 'Activité de soins soumise à reconnaissance',
  EML: 'Équipement matériel lourd',
  ASDR: 'Activité sanitaire diverse régulée',
  ASOCR: 'Activité sociale régulée',
  AMSR: 'Activité médico-sociale régulée',
  AER: 'Activité d\'enseignement régulée',
  AMF: 'Activité de soins (autorisation, modalité, forme)',
  AMM: 'Activité de soins (autorisation, modalité, mention)',
};

export const STATUTS = { 1: 'active et mise en œuvre', 2: 'active non mise en œuvre', 3: 'inactive' };

/** Caractéristiques « métier » selon la nature, normalisées en un seul objet. */
export function caracteristiques(nature) {
  const code = nature?.codeNature ?? null;
  const spec = nature?.caracteristiquesSpecifiques ?? {};
  const vide = { activite: null, modalite: null, forme: null, mode_fonctionnement: null, public: null, type_eml: null, mention: null, pratique: null, declaration: null, appareils: [] };
  switch (code) {
    case 'AASA':
    case 'ASR': {
      const t = spec[code === 'AASA' ? 'typeActiviteAASA' : 'typeActiviteASR'] ?? {};
      return { ...vide, activite: texte(t.activiteSanitaireRegulee), modalite: texte(t.modaliteActivite), forme: texte(t.formeActivite) };
    }
    case 'AMF': {
      const t = spec.typeActiviteAMF ?? {};
      return { ...vide, activite: texte(t.activiteAMF), modalite: texte(t.modaliteActivite), forme: texte(t.formeActivite) };
    }
    case 'EML': {
      const t = spec.typeActiviteEML ?? {};
      return { ...vide, type_eml: texte(t.typeEmlId) };
    }
    case 'ASDR': {
      const t = spec.typeActiviteASDR ?? {};
      return { ...vide, activite: texte(t.activiteSanitaireDiverseRegulee), mode_fonctionnement: texte(t.modeFonctionnement), public: texte(t.public) };
    }
    case 'ASOCR':
    case 'AMSR': {
      const t = spec[code === 'ASOCR' ? 'typeActiviteASOCR' : 'typeActiviteAMSR'] ?? {};
      return { ...vide, activite: texte(t.activiteSocialeRegulee), mode_fonctionnement: texte(t.modeFonctionnement), public: texte(t.public) };
    }
    case 'AER': {
      const t = spec.typeActiviteAER ?? {};
      return { ...vide, activite: texte(t.activiteEnseignementRegulee), mode_fonctionnement: texte(t.modeFonctionnement), public: texte(t.public) };
    }
    case 'AMM': {
      const t = spec.typeActiviteAMM ?? {};
      return {
        ...vide,
        activite: texte(t.activiteAMM), modalite: texte(t.modaliteAMM), mention: texte(t.mentionAMM),
        pratique: texte(t.ptsAMM), declaration: texte(t.declarationAMM),
        appareils: Array.isArray(spec.appareil) ? spec.appareil : [],
      };
    }
    default:
      return vide;
  }
}

/** Code d'activité composé, identique à la règle ANS (nature + attributs, séparés par « _ »). */
export function codeActivite(nature) {
  const code = nature?.codeNature ?? null;
  if (!code) return null;
  const c = caracteristiques(nature);
  const v = (x) => x ?? '';
  switch (code) {
    case 'AASA': case 'ASR': case 'AMF':
      return [code, v(c.activite), v(c.modalite), v(c.forme)].join('_');
    case 'EML':
      return [code, v(c.type_eml)].join('_');
    case 'ASDR': case 'ASOCR': case 'AMSR': case 'AER':
      return [code, v(c.activite), v(c.mode_fonctionnement), v(c.public)].join('_');
    case 'AMM':
      return [code, v(c.activite), v(c.modalite), v(c.mention), v(c.pratique), v(c.declaration)].join('_');
    default:
      return code;
  }
}

/**
 * Statut ANS : 3 inactive ; 1 active et mise en œuvre (dernier événement 12 ou
 * 15 le plus récent est un 12) ; 2 active non encore mise en œuvre.
 */
export function statutActivite(activite) {
  if (activite?.caracteristiquesGeneriques?.etatObjet === 'I') return 3;
  const evenements = (activite?.evenement ?? [])
    .filter((e) => ['12', '15', '012', '015'].includes(String(e.codeEvenement)))
    .sort((a, b) => String(b.dateEvenement ?? '').localeCompare(String(a.dateEvenement ?? '')));
  if (evenements.length && ['12', '012'].includes(String(evenements[0].codeEvenement))) return 1;
  return 2;
}

const estTotale = (c) => !c.modeFinancement && !c.habilitation && !c.typeLogement && !c.genre;

/** Somme des capacités totales d'un statut donné (01 autorisée, 09 installée). */
export function capacite(capacites, statut) {
  let total = 0;
  for (const c of capacites ?? []) {
    if (!estTotale(c) || c.statutCapacite !== statut) continue;
    const n = Number.parseInt(c.nombre, 10);
    if (Number.isFinite(n)) total += n;
  }
  return total;
}

export const COLONNES_ACTIVITE = [
  'date_flux', 'finess_ej', 'finess_et', 'niveau', 'id_activite', 'nature', 'nature_libelle', 'code_activite',
  'activite', 'activite_libelle', 'modalite', 'modalite_libelle', 'forme', 'forme_libelle',
  'mention', 'mention_libelle', 'pratique', 'pratique_libelle', 'declaration', 'declaration_libelle',
  'mode_fonctionnement', 'mode_fonctionnement_libelle', 'public', 'public_libelle',
  'type_eml', 'type_eml_libelle', 'nb_appareils',
  'etat', 'statut', 'statut_libelle', 'type_activite_smsse', 'type_activite_smsse_libelle',
  'identifiant_autorisation', 'num_autorisation_arhgos',
  'date_debut', 'date_fin', 'date_fin_effective', 'date_caducite', 'capacite_autorisee', 'capacite_installee',
];

/** Table de libellés à utiliser pour chaque attribut, selon la nature. */
const TABLES_PAR_NATURE = {
  AASA: { activite: 'activiteSanitaire', modalite: 'modalite', forme: 'forme' },
  ASR: { activite: 'activiteSanitaire', modalite: 'modalite', forme: 'forme' },
  AMF: { activite: 'activiteSanitaire', modalite: 'modalite', forme: 'forme' },
  AMM: { activite: 'activiteAmm', modalite: 'modaliteAmm', mention: 'mentionAmm', pratique: 'pratiqueAmm', declaration: 'declarationAmm' },
  ASDR: { activite: 'activiteSanitaireDiverse', mode_fonctionnement: 'modeFonctionnement', public: 'public' },
  ASOCR: { activite: 'activiteSociale', mode_fonctionnement: 'modeFonctionnement', public: 'public' },
  AMSR: { activite: 'activiteSociale', mode_fonctionnement: 'modeFonctionnement', public: 'public' },
  AER: { activite: 'activiteEnseignement', mode_fonctionnement: 'modeFonctionnement', public: 'public' },
  EML: {},
};

const lib = (L, table, code) => (table && code != null ? L[table]?.get(code) ?? null : null);

/**
 * L'identifiant de type d'EML (1, 2, 4…) renvoie, via la table des types
 * d'activité, à un code « EML/05602 » dont la seconde partie est un code de
 * la table des équipements matériels lourds.
 */
function libelleEml(L, typeEml) {
  if (typeEml == null) return null;
  const type = L.typeActiviteSmsse?.get(typeEml);
  const code = type?.startsWith('EML/') ? type.slice(4) : typeEml;
  return L.eml?.get(code) ?? type ?? null;
}

function ligne(base, activite, L, extra) {
  const g = activite.caracteristiquesGeneriques ?? {};
  const nature = activite.nature ?? {};
  const c = caracteristiques(nature);
  const statut = statutActivite(activite);
  const nbAppareils = c.appareils.reduce((n, a) => n + (Number.parseInt(a?.nombreAppareilAMM, 10) || 0), 0);
  const t = TABLES_PAR_NATURE[nature.codeNature] ?? {};
  const typeSmsse = texte(g.typeActiviteSMSSE);
  return {
    ...base,
    id_activite: texte(g.activiteAeId),
    nature: texte(nature.codeNature),
    nature_libelle: L.natureActivite?.get(nature.codeNature) ?? NATURES[nature.codeNature] ?? null,
    code_activite: codeActivite(nature),
    activite: c.activite,
    activite_libelle: lib(L, t.activite, c.activite),
    modalite: c.modalite,
    modalite_libelle: lib(L, t.modalite, c.modalite),
    forme: c.forme,
    forme_libelle: lib(L, t.forme, c.forme),
    mention: c.mention,
    mention_libelle: lib(L, t.mention, c.mention),
    pratique: c.pratique,
    pratique_libelle: lib(L, t.pratique, c.pratique),
    declaration: c.declaration,
    declaration_libelle: lib(L, t.declaration, c.declaration),
    mode_fonctionnement: c.mode_fonctionnement,
    mode_fonctionnement_libelle: lib(L, t.mode_fonctionnement, c.mode_fonctionnement),
    public: c.public,
    public_libelle: lib(L, t.public, c.public),
    type_eml: c.type_eml,
    type_eml_libelle: libelleEml(L, c.type_eml),
    nb_appareils: c.appareils.length ? nbAppareils : null,
    etat: texte(g.etatObjet),
    statut,
    statut_libelle: STATUTS[statut],
    type_activite_smsse: typeSmsse,
    type_activite_smsse_libelle: L.typeActiviteSmsse?.get(typeSmsse) ?? null,
    identifiant_autorisation: texte(g.identifiantAutorisation),
    num_autorisation_arhgos: texte(g.numAutorisationArhgos),
    date_debut: dateIso(g.dateDebutActiviteAutorisee),
    date_fin: dateIso(g.dateFinActiviteAutorisee),
    date_fin_effective: dateIso(g.dateFinEffectiveActivite),
    date_caducite: dateIso(g.dateCaduciteAutorisation),
    ...extra,
  };
}

/**
 * Lignes d'activités pour une PMEJ du flux activités : d'abord les activités
 * autorisées (niveau « autorisee »), puis les activités exercées de chaque
 * établissement (niveau « exercee ») avec leurs capacités installée et autorisée.
 */
export function lignesActivites(pmej, L, dateFlux) {
  const finessEj = texte(pmej.numFiness);
  const autorisations = new Map();
  const lignes = [];

  for (const a of pmej.activitesAutorisees ?? []) {
    const id = a.caracteristiquesGeneriques?.activiteAeId;
    if (id) autorisations.set(id, a);
    lignes.push(ligne({ date_flux: dateFlux, finess_ej: finessEj, finess_et: null, niveau: 'autorisee' }, a, L, {
      capacite_autorisee: capacite(a.capacite, '01'),
      capacite_installee: null,
    }));
  }

  for (const ege of pmej.ege ?? []) {
    const finessEt = texte(ege.numFinessEge);
    for (const a of ege.activitesExercees ?? []) {
      const autorisation = autorisations.get(a.caracteristiquesGeneriques?.identifiantAutorisation);
      lignes.push(ligne({ date_flux: dateFlux, finess_ej: finessEj, finess_et: finessEt, niveau: 'exercee' }, a, L, {
        capacite_autorisee: autorisation ? capacite(autorisation.capacite, '01') : 0,
        capacite_installee: capacite(a.capacite, '09'),
      }));
    }
  }
  return lignes;
}
