/**
 * Lecteur de fichiers dBase (DBF) en flux, sans dépendance.
 *
 * L'Assurance Maladie publie la CCAM, la NABM et la LPP dans ce format des
 * années 1980 : un en-tête, la description des colonnes, puis des
 * enregistrements de longueur fixe. Les textes sont encodés en page de code
 * DOS (CP850), que Node ne sait pas décoder nativement : la table est ici.
 *
 * Types gérés : C (texte), N et F (nombre), D (date AAAAMMJJ), L (logique).
 * Les autres types sont restitués tels quels, en texte.
 */

import { createReadStream, openSync, readSync, closeSync } from 'node:fs';

import { dateIso } from './dates.js';

// Moitié haute de la page de code 850 (0x80 à 0xFF).
const CP850_HAUT = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ ';

// Table octet vers unité de code UTF-16, construite une fois.
const CP850 = new Uint16Array(256);
for (let i = 0; i < 256; i++) CP850[i] = i < 0x80 ? i : CP850_HAUT.charCodeAt(i - 0x80);

/**
 * Décode un Buffer CP850 en chaîne.
 *
 * Construire le texte caractère par caractère (`s += c`) produit dans V8 une
 * chaîne faite de fragments chaînés, qui occupe plus de vingt fois la place
 * d'une chaîne compacte tant qu'elle reste en mémoire : sur la CCAM, près de
 * 3 Go. On remplit donc un tableau d'unités de code, décodé d'un seul coup.
 */
export function decoderCp850(tampon) {
  let ascii = true;
  for (let i = 0; i < tampon.length; i++) {
    if (tampon[i] >= 0x80) { ascii = false; break; }
  }
  if (ascii) return tampon.toString('latin1');
  const unites = new Uint16Array(tampon.length);
  for (let i = 0; i < tampon.length; i++) unites[i] = CP850[tampon[i]];
  return Buffer.from(unites.buffer, unites.byteOffset, unites.byteLength).toString('utf16le');
}

const DECODEURS = {
  cp850: decoderCp850,
  latin1: (t) => t.toString('latin1'),
  utf8: (t) => t.toString('utf8'),
};

/** Lit l'en-tête et la description des colonnes. */
export function lireEnteteDbf(chemin) {
  const fd = openSync(chemin, 'r');
  try {
    const entete = Buffer.alloc(32);
    readSync(fd, entete, 0, 32, 0);
    const version = entete[0];
    const nombre = entete.readUInt32LE(4);
    const longueurEntete = entete.readUInt16LE(8);
    const longueurEnregistrement = entete.readUInt16LE(10);
    const descripteurs = Buffer.alloc(longueurEntete);
    readSync(fd, descripteurs, 0, longueurEntete, 0);
    const champs = [];
    for (let p = 32; p < longueurEntete - 1; p += 32) {
      if (descripteurs[p] === 0x0d) break;
      champs.push({
        nom: descripteurs.toString('latin1', p, p + 11).replace(/\0.*$/, ''),
        type: String.fromCharCode(descripteurs[p + 11]),
        longueur: descripteurs[p + 16],
        decimales: descripteurs[p + 17],
      });
    }
    return { version, nombre, longueurEntete, longueurEnregistrement, champs };
  } finally {
    closeSync(fd);
  }
}

function convertir(champ, texte) {
  const t = texte.trim();
  switch (champ.type) {
    case 'N':
    case 'F': {
      if (t === '') return null;
      const n = Number(t);
      return Number.isFinite(n) ? n : null;
    }
    case 'D':
      return dateIso(t);
    case 'L':
      return /^[TtYy]$/.test(t) ? true : /^[FfNn]$/.test(t) ? false : null;
    default:
      return t === '' ? null : t;
  }
}

/**
 * Parcourt les enregistrements d'un DBF, un objet par ligne (clés = noms de
 * colonnes). Les enregistrements marqués supprimés (*) sont ignorés.
 * @param {string} chemin
 * @param {{ encodage?: 'cp850'|'latin1'|'utf8', brut?: boolean, champsBruts?: (nom: string) => boolean }} [options]
 *   `brut` garde toutes les valeurs telles quelles (ni conversion ni suppression des espaces) ;
 *   `champsBruts` ne le fait que pour certains champs, par exemple les morceaux d'un libellé long
 *   découpé sur plusieurs colonnes, dont les espaces de fin sont significatifs.
 */
export async function* lireDbf(chemin, options = {}) {
  const decoder = DECODEURS[options.encodage ?? 'cp850'];
  if (!decoder) throw new Error(`encodage inconnu : ${options.encodage}`);
  const estBrut = (nom) => options.brut || (options.champsBruts ? options.champsBruts(nom) : false);
  const entete = lireEnteteDbf(chemin);
  const { longueurEnregistrement: taille, champs } = entete;
  const flux = createReadStream(chemin, { start: entete.longueurEntete });
  let reste = Buffer.alloc(0);

  for await (const morceau of flux) {
    let tampon = reste.length ? Buffer.concat([reste, morceau]) : morceau;
    let position = 0;
    while (tampon.length - position >= taille) {
      const enregistrement = tampon.subarray(position, position + taille);
      position += taille;
      if (enregistrement[0] === 0x2a || enregistrement[0] === 0x1a) continue; // supprimé, ou fin de fichier
      const objet = {};
      let decalage = 1;
      for (const champ of champs) {
        const texte = decoder(enregistrement.subarray(decalage, decalage + champ.longueur));
        decalage += champ.longueur;
        objet[champ.nom] = estBrut(champ.nom) ? texte : convertir(champ, texte);
      }
      yield objet;
    }
    reste = tampon.subarray(position);
  }
}

/** Charge tout un DBF en mémoire (petites tables de codes). */
export async function chargerDbf(chemin, options) {
  const lignes = [];
  for await (const l of lireDbf(chemin, options)) lignes.push(l);
  return lignes;
}
