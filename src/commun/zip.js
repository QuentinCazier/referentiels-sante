/**
 * Lecteur ZIP minimal (méthodes « stockée » et « deflate »), sans dépendance.
 * Suffisant pour les archives de quelques centaines de Ko publiées par l'ATIH
 * ou l'Assurance Maladie. Toute l'archive est lue en mémoire.
 */

import { readFileSync, openSync, readSync, closeSync, fstatSync, createReadStream, createWriteStream, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { inflateRawSync, createInflateRaw } from 'node:zlib';

const SIGNATURE_FIN = 0x06054b50;
const SIGNATURE_CENTRALE = 0x02014b50;
const SIGNATURE_LOCALE = 0x04034b50;

/**
 * Liste les entrées d'une archive sur disque sans la charger : nom, méthode,
 * taille compressée, taille décompressée, position des données.
 */
export function listerZip(chemin) {
  const fd = openSync(chemin, 'r');
  try {
    const taille = fstatSync(fd).size;
    const queue = Buffer.alloc(Math.min(taille, 65536 + 22));
    readSync(fd, queue, 0, queue.length, taille - queue.length);
    let fin = -1;
    for (let i = queue.length - 22; i >= 0; i--) {
      if (queue.readUInt32LE(i) === SIGNATURE_FIN) { fin = i; break; }
    }
    if (fin < 0) throw new Error('archive ZIP invalide : fin de répertoire introuvable');
    const nombre = queue.readUInt16LE(fin + 10);
    const tailleRepertoire = queue.readUInt32LE(fin + 12);
    const debutRepertoire = queue.readUInt32LE(fin + 16);
    const repertoire = Buffer.alloc(tailleRepertoire);
    readSync(fd, repertoire, 0, tailleRepertoire, debutRepertoire);

    const entrees = [];
    let position = 0;
    for (let k = 0; k < nombre; k++) {
      if (repertoire.readUInt32LE(position) !== SIGNATURE_CENTRALE) throw new Error('archive ZIP invalide : répertoire corrompu');
      const methode = repertoire.readUInt16LE(position + 10);
      const tailleCompressee = repertoire.readUInt32LE(position + 20);
      const tailleDecompressee = repertoire.readUInt32LE(position + 24);
      const longueurNom = repertoire.readUInt16LE(position + 28);
      const longueurExtra = repertoire.readUInt16LE(position + 30);
      const longueurCommentaire = repertoire.readUInt16LE(position + 32);
      const decalageLocal = repertoire.readUInt32LE(position + 42);
      const nom = repertoire.toString('utf8', position + 46, position + 46 + longueurNom);
      position += 46 + longueurNom + longueurExtra + longueurCommentaire;

      const local = Buffer.alloc(30);
      readSync(fd, local, 0, 30, decalageLocal);
      if (local.readUInt32LE(0) !== SIGNATURE_LOCALE) throw new Error(`archive ZIP invalide : en-tête local manquant pour ${nom}`);
      const debutDonnees = decalageLocal + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
      if (!nom.endsWith('/')) entrees.push({ nom, methode, tailleCompressee, tailleDecompressee, debutDonnees });
    }
    return entrees;
  } finally {
    closeSync(fd);
  }
}

/**
 * Extrait une archive vers un dossier, entrée par entrée et en flux : une
 * table DBF de 400 Mo ne passe jamais entièrement en mémoire.
 * @returns {Promise<string[]>} chemins des fichiers écrits
 */
export async function extraireZip(chemin, dossier, { filtre } = {}) {
  const ecrits = [];
  for (const e of listerZip(chemin)) {
    if (filtre && !filtre(e.nom)) continue;
    const destination = join(dossier, e.nom.replace(/^(\.\.[/\\])+/, ''));
    mkdirSync(dirname(destination), { recursive: true });
    const source = createReadStream(chemin, { start: e.debutDonnees, end: e.debutDonnees + e.tailleCompressee - 1 });
    if (e.methode === 0) await pipeline(source, createWriteStream(destination));
    else if (e.methode === 8) await pipeline(source, createInflateRaw(), createWriteStream(destination));
    else throw new Error(`méthode de compression ${e.methode} non gérée pour ${e.nom}`);
    ecrits.push(destination);
  }
  return ecrits;
}

/**
 * @param {Buffer|string} source contenu de l'archive ou chemin du fichier
 * @returns {Map<string, Buffer>} nom d'entrée vers contenu décompressé
 */
export function lireZip(source) {
  const tampon = Buffer.isBuffer(source) ? source : readFileSync(source);
  let fin = -1;
  for (let i = tampon.length - 22; i >= Math.max(0, tampon.length - 22 - 65536); i--) {
    if (tampon.readUInt32LE(i) === SIGNATURE_FIN) { fin = i; break; }
  }
  if (fin < 0) throw new Error('archive ZIP invalide : fin de répertoire introuvable');

  const nombre = tampon.readUInt16LE(fin + 10);
  let position = tampon.readUInt32LE(fin + 16);
  const entrees = new Map();

  for (let n = 0; n < nombre; n++) {
    if (tampon.readUInt32LE(position) !== SIGNATURE_CENTRALE) {
      throw new Error('archive ZIP invalide : entrée de répertoire corrompue');
    }
    const methode = tampon.readUInt16LE(position + 10);
    const tailleCompressee = tampon.readUInt32LE(position + 20);
    const longueurNom = tampon.readUInt16LE(position + 28);
    const longueurExtra = tampon.readUInt16LE(position + 30);
    const longueurCommentaire = tampon.readUInt16LE(position + 32);
    const decalageLocal = tampon.readUInt32LE(position + 42);
    const nom = tampon.toString('utf8', position + 46, position + 46 + longueurNom);
    position += 46 + longueurNom + longueurExtra + longueurCommentaire;

    if (tampon.readUInt32LE(decalageLocal) !== SIGNATURE_LOCALE) {
      throw new Error(`archive ZIP invalide : en-tête local manquant pour ${nom}`);
    }
    const nomLocal = tampon.readUInt16LE(decalageLocal + 26);
    const extraLocal = tampon.readUInt16LE(decalageLocal + 28);
    const debut = decalageLocal + 30 + nomLocal + extraLocal;
    const donnees = tampon.subarray(debut, debut + tailleCompressee);

    if (nom.endsWith('/')) continue; // dossier
    if (methode === 0) entrees.set(nom, Buffer.from(donnees));
    else if (methode === 8) entrees.set(nom, inflateRawSync(donnees));
    else throw new Error(`méthode de compression ${methode} non gérée pour ${nom}`);
  }
  return entrees;
}
