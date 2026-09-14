/**
 * Lecture en flux d'un gros document JSON de la forme
 *   { "cle": "valeur", "collection": [ {...}, {...} ], ... }
 * sans jamais charger le document entier en mémoire.
 *
 * Les flux FINESS+ font 750 Mo une fois décompressés : JSON.parse est
 * impossible (limite de taille des chaînes V8). On suit donc les accolades et
 * crochets caractère par caractère, et l'on ne parse individuellement que les
 * éléments des tableaux de premier niveau (5 Ko en moyenne, 2 Mo pour le plus gros).
 *
 * Le lecteur émet :
 *   { type: 'meta', cle, valeur }              pour les scalaires de premier niveau
 *   { type: 'element', collection, objet }     pour chaque objet d'un tableau
 */

import { createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';

/** Ouvre le fichier, décompressé à la volée s'il se termine par .gz. */
export function ouvrirTexte(chemin) {
  const brut = createReadStream(chemin);
  const flux = chemin.endsWith('.gz') ? brut.pipe(createGunzip()) : brut;
  return flux.setEncoding('utf8');
}

/**
 * @param {string} chemin fichier .json ou .json.gz
 * @param {{ collections?: string[] }} [options] ne renvoyer que ces collections
 */
export async function* lireElements(chemin, options = {}) {
  const filtre = options.collections ? new Set(options.collections) : null;
  const flux = ouvrirTexte(chemin);

  let profondeur = 0;
  let enChaine = false;
  let echappe = false;
  let dansCle = false;
  let dansValeur = false;
  let cle = '';
  let valeur = '';
  let collection = null;
  let debut = -1;
  let tampon = '';

  for await (const morceau of flux) {
    for (let i = 0; i < morceau.length; i++) {
      const c = morceau[i];

      if (enChaine) {
        if (echappe) echappe = false;
        else if (c === '\\') echappe = true;
        else if (c === '"') {
          enChaine = false;
          if (dansValeur) {
            dansValeur = false;
            yield { type: 'meta', cle: collection, valeur: JSON.parse(`"${valeur}"`) };
          }
          dansCle = false;
        } else if (dansCle) cle += c;
        else if (dansValeur) valeur += c;
        continue;
      }

      if (c === '"') {
        enChaine = true;
        if (profondeur === 1) {
          if (dansValeur) valeur = '';
          else { dansCle = true; cle = ''; }
        }
        continue;
      }

      if (profondeur === 1 && c === ':') { collection = cle; dansValeur = true; continue; }
      if (profondeur === 1 && c === ',') { dansValeur = false; continue; }

      if (c === '{' || c === '[') {
        if (profondeur === 1) dansValeur = false;
        profondeur++;
        if (profondeur === 3 && c === '{') debut = i;
        continue;
      }

      if (c === '}' || c === ']') {
        if (profondeur === 3 && c === '}' && (debut >= 0 || tampon)) {
          const texte = tampon + morceau.slice(Math.max(debut, 0), i + 1);
          tampon = '';
          debut = -1;
          if (!filtre || filtre.has(collection)) {
            yield { type: 'element', collection, objet: JSON.parse(texte) };
          }
        }
        profondeur--;
        continue;
      }
    }

    // Fin de morceau : conserver la partie de l'élément en cours.
    if (debut >= 0) { tampon += morceau.slice(debut); debut = -1; }
    else if (profondeur >= 3 && tampon) tampon += morceau;
  }
}

/** Variante pratique : ne renvoie que les objets d'une collection donnée. */
export async function* lireCollection(chemin, collection) {
  for await (const e of lireElements(chemin, { collections: [collection] })) {
    if (e.type === 'element') yield e.objet;
  }
}
