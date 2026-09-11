/**
 * Téléchargement de fichiers sources avec cache local.
 *
 * Les sources (data.gouv.fr, ANS, ATIH) publient de gros fichiers renouvelés
 * quotidiennement ou annuellement : on les garde dans un dossier de cache et on
 * ne retélécharge que sur demande explicite (option `forcer`).
 */

import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const AGENT_UTILISATEUR = 'referentiels-sante (+https://github.com/QuentinCazier/referentiels-sante)';

/**
 * @param {string} url
 * @param {string} destination chemin du fichier local
 * @param {{ forcer?: boolean, journal?: (message: string) => void }} [options]
 * @returns {Promise<{ chemin: string, octets: number, telecharge: boolean }>}
 */
export async function telecharger(url, destination, options = {}) {
  const journal = options.journal ?? (() => {});
  if (!options.forcer && existsSync(destination) && statSync(destination).size > 0) {
    journal(`déjà présent : ${destination}`);
    return { chemin: destination, octets: statSync(destination).size, telecharge: false };
  }
  mkdirSync(dirname(destination), { recursive: true });
  journal(`téléchargement : ${url}`);
  const reponse = await fetch(url, { headers: { 'user-agent': AGENT_UTILISATEUR }, redirect: 'follow' });
  if (!reponse.ok || !reponse.body) {
    throw new Error(`téléchargement impossible (${reponse.status}) : ${url}`);
  }
  const temporaire = `${destination}.partiel`;
  await pipeline(Readable.fromWeb(reponse.body), createWriteStream(temporaire));
  const { renameSync } = await import('node:fs');
  renameSync(temporaire, destination);
  const octets = statSync(destination).size;
  journal(`reçu ${(octets / 1e6).toFixed(1)} Mo`);
  return { chemin: destination, octets, telecharge: true };
}

/** Récupère un petit fichier texte en mémoire (tables de codes, pages d'index). */
export async function recupererTexte(url) {
  const reponse = await fetch(url, { headers: { 'user-agent': AGENT_UTILISATEUR }, redirect: 'follow' });
  if (!reponse.ok) throw new Error(`récupération impossible (${reponse.status}) : ${url}`);
  return reponse.text();
}
