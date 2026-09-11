/**
 * Lecteur ZIP minimal (méthodes « stockée » et « deflate »), sans dépendance.
 * Suffisant pour les archives de quelques centaines de Ko publiées par l'ATIH
 * ou l'Assurance Maladie. Toute l'archive est lue en mémoire.
 */

import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

const SIGNATURE_FIN = 0x06054b50;
const SIGNATURE_CENTRALE = 0x02014b50;
const SIGNATURE_LOCALE = 0x04034b50;

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
