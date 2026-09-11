import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateRawSync } from 'node:zlib';

export const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

export function dossierTemp(prefixe = 'referentiels-sante-') {
  return mkdtempSync(join(tmpdir(), prefixe));
}

/**
 * Écrit une archive ZIP minimale en mémoire (pour tester le lecteur).
 * @param {{ nom: string, contenu: Buffer|string, deflate?: boolean }[]} entrees
 */
export function construireZip(entrees) {
  const locaux = [];
  const centraux = [];
  let position = 0;
  for (const e of entrees) {
    const nom = Buffer.from(e.nom, 'utf8');
    const brut = Buffer.isBuffer(e.contenu) ? e.contenu : Buffer.from(e.contenu, 'utf8');
    const donnees = e.deflate ? deflateRawSync(brut) : brut;
    const methode = e.deflate ? 8 : 0;
    const somme = crc32(brut);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(methode, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(somme, 14);
    local.writeUInt32LE(donnees.length, 18);
    local.writeUInt32LE(brut.length, 22);
    local.writeUInt16LE(nom.length, 26);
    local.writeUInt16LE(0, 28);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(methode, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(somme, 16);
    central.writeUInt32LE(donnees.length, 20);
    central.writeUInt32LE(brut.length, 24);
    central.writeUInt16LE(nom.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(position, 42);

    locaux.push(local, nom, donnees);
    centraux.push(central, nom);
    position += local.length + nom.length + donnees.length;
  }
  const repertoire = Buffer.concat(centraux);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(0, 4);
  fin.writeUInt16LE(0, 6);
  fin.writeUInt16LE(entrees.length, 8);
  fin.writeUInt16LE(entrees.length, 10);
  fin.writeUInt32LE(repertoire.length, 12);
  fin.writeUInt32LE(position, 16);
  fin.writeUInt16LE(0, 20);
  return Buffer.concat([...locaux, repertoire, fin]);
}
