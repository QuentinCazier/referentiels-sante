/**
 * Vérification des sources sans téléchargement lourd : chaque page est lue,
 * chaque fichier attendu fait l'objet d'une requête d'en-tête. Le but est de
 * détecter tôt qu'une page a changé de forme, qu'une adresse a disparu ou
 * qu'une version de repli est dépassée, avant qu'un utilisateur ne tombe
 * dessus. Conçu pour tourner chaque semaine en intégration continue.
 */

import { AGENT_UTILISATEUR } from '../commun/telecharger.js';
import { JEUX, URL_STABLES, trouverRessource } from '../finess/sources.js';
import { TABLES, urlTable } from '../nos/index.js';
import { ARCHIVES } from '../ghs/index.js';
import { trouverArchives, ARCHIVES_CONNUES } from '../ccam/index.js';
import { EDITIONS } from '../cim10/index.js';
import { FICHIERS, BASE as BASE_BDPM } from '../bdpm/index.js';
import { SOURCES, VERSIONS_CONNUES, trouverFichiers } from '../cnam/index.js';

/** Requête d'en-tête (repli sur GET sans lire le corps si HEAD est refusé). */
export async function sonder(url, { delai = 20000 } = {}) {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), delai);
  try {
    let reponse = await fetch(url, { method: 'HEAD', headers: { 'user-agent': AGENT_UTILISATEUR }, redirect: 'follow', signal: controleur.signal });
    if (reponse.status === 405 || reponse.status === 403) {
      reponse = await fetch(url, { method: 'GET', headers: { 'user-agent': AGENT_UTILISATEUR, range: 'bytes=0-0' }, redirect: 'follow', signal: controleur.signal });
      await reponse.body?.cancel();
    }
    const taille = Number(reponse.headers.get('content-length')) || null;
    const type = reponse.headers.get('content-type') ?? null;
    return { url, statut: reponse.status, ok: reponse.ok, taille, type };
  } catch (erreur) {
    return { url, statut: null, ok: false, taille: null, type: null, erreur: erreur.message };
  } finally {
    clearTimeout(minuteur);
  }
}

const resultat = (source, controle, ok, detail = '') => ({ source, controle, ok, detail });

/** Un fichier de données ne doit pas être une page HTML. */
const estDonnee = (s) => s.ok && !(s.type ?? '').includes('text/html');

export async function verifierFiness() {
  const r = [];
  for (const type of Object.keys(JEUX)) {
    try {
      const ressource = await trouverRessource(type);
      const s = await sonder(ressource.url);
      r.push(resultat('finess', `${type} : ressource quotidienne`, estDonnee(s), `${ressource.titre}, ${s.statut}, ${s.taille ? Math.round(s.taille / 1e6) + ' Mo' : 'taille inconnue'}`));
    } catch (e) {
      r.push(resultat('finess', `${type} : API data.gouv.fr`, false, e.message));
    }
    const s = await sonder(URL_STABLES[type]);
    r.push(resultat('finess', `${type} : URL stable de repli`, estDonnee(s), `${s.statut ?? s.erreur}`));
  }
  return r;
}

export async function verifierNos() {
  const r = [];
  for (const nom of Object.values(TABLES)) {
    const s = await sonder(urlTable(nom));
    r.push(resultat('nos', nom, estDonnee(s), `${s.statut ?? s.erreur}`));
  }
  return r;
}

export async function verifierGhs() {
  const r = [];
  for (const [annee, url] of Object.entries(ARCHIVES)) {
    const s = await sonder(url);
    r.push(resultat('ghs', `campagne ${annee}`, estDonnee(s), `${s.statut ?? s.erreur}`));
  }
  return r;
}

export async function verifierCcam() {
  const r = [];
  let trouve;
  try {
    const journal = [];
    trouve = await trouverArchives({ journal: (m) => journal.push(m) });
    const replie = journal.some((m) => m.includes('version connue'));
    r.push(resultat('ccam', 'page ameli', !replie, journal.join(' ; ')));
    if (!replie && trouve.version !== ARCHIVES_CONNUES.version) {
      r.push(resultat('ccam', 'version de repli à jour', false, `page : ${trouve.version}, repli : ${ARCHIVES_CONNUES.version}`));
    } else if (!replie) r.push(resultat('ccam', 'version de repli à jour', true, trouve.version));
  } catch (e) {
    r.push(resultat('ccam', 'page ameli', false, e.message));
  }
  for (const url of (trouve ?? ARCHIVES_CONNUES).archives) {
    const s = await sonder(url);
    r.push(resultat('ccam', url.split('/').pop(), estDonnee(s), `${s.statut ?? s.erreur}`));
  }
  return r;
}

export async function verifierCim10() {
  const r = [];
  for (const [edition, url] of Object.entries(EDITIONS)) {
    const s = await sonder(url);
    r.push(resultat('cim10', `édition ${edition}`, estDonnee(s), `${s.statut ?? s.erreur}`));
  }
  return r;
}

export async function verifierBdpm() {
  const r = [];
  for (const [cle, d] of Object.entries(FICHIERS)) {
    const s = await sonder(d.url ?? `${BASE_BDPM}/download/file/${d.fichier}`);
    r.push(resultat('bdpm', cle, estDonnee(s), `${s.statut ?? s.erreur}`));
  }
  return r;
}

export async function verifierCnam() {
  const r = [];
  for (const nom of Object.keys(SOURCES)) {
    try {
      const { version, fichiers } = await trouverFichiers(nom);
      r.push(resultat(nom, 'page de téléchargement', true, `version ${version}, ${fichiers.length} fichier(s)`));
      const connue = VERSIONS_CONNUES[nom]?.version;
      r.push(resultat(nom, 'version de repli à jour', connue === version, `page : ${version}, repli : ${connue}`));
      for (const f of fichiers) {
        const s = await sonder(f.url);
        r.push(resultat(nom, f.nom, estDonnee(s), `${s.statut ?? s.erreur}`));
      }
    } catch (e) {
      r.push(resultat(nom, 'page de téléchargement', false, e.message));
    }
  }
  return r;
}

/**
 * Lance toutes les vérifications (ou celles demandées) et renvoie
 * { resultats, echecs, ok }.
 */
export async function verifierTout({ sources, journal = () => {} } = {}) {
  const tout = { finess: verifierFiness, nos: verifierNos, ghs: verifierGhs, ccam: verifierCcam, cim10: verifierCim10, bdpm: verifierBdpm, cnam: verifierCnam };
  const cles = sources?.length ? sources : Object.keys(tout);
  const resultats = [];
  for (const cle of cles) {
    if (!tout[cle]) throw new Error(`source inconnue : ${cle} (choix : ${Object.keys(tout).join(', ')})`);
    journal(`vérification : ${cle}`);
    resultats.push(...(await tout[cle]()));
  }
  const echecs = resultats.filter((x) => !x.ok);
  return { resultats, echecs, ok: echecs.length === 0, date: new Date().toISOString() };
}

/** Rapport texte, une ligne par contrôle. */
export function formaterRapport({ resultats, echecs, date }) {
  const lignes = resultats.map((x) => `${x.ok ? 'OK    ' : 'ECHEC '} ${x.source.padEnd(7)} ${x.controle}${x.detail ? ` (${x.detail})` : ''}`);
  lignes.push('', `${resultats.length} contrôles, ${echecs.length} échec(s), ${date}`);
  return lignes.join('\n');
}
