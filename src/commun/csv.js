/**
 * Écriture de CSV et de JSON Lines en flux, avec gestion de la contre-pression.
 *
 * Conventions de sortie (pensées pour Excel en français et pour les ETL) :
 *   séparateur « ; », UTF-8 avec BOM, fins de ligne LF, guillemets seulement
 *   quand c'est nécessaire, valeurs nulles rendues par une cellule vide.
 */

import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { once } from 'node:events';

const BOM = '﻿';

export function champCsv(valeur, separateur) {
  if (valeur === null || valeur === undefined) return '';
  const s = typeof valeur === 'string' ? valeur : String(valeur);
  if (s.includes(separateur) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

class Ecrivain {
  constructor(chemin) {
    mkdirSync(dirname(chemin), { recursive: true });
    this.chemin = chemin;
    this.flux = createWriteStream(chemin);
    this.lignes = 0;
  }

  async ecrireBrut(texte) {
    if (!this.flux.write(texte)) await once(this.flux, 'drain');
  }

  async fermer() {
    this.flux.end();
    await once(this.flux, 'finish');
    return this.lignes;
  }
}

export class EcrivainCsv extends Ecrivain {
  /**
   * @param {string} chemin
   * @param {string[]} colonnes noms de colonnes, dans l'ordre
   * @param {{ separateur?: string, bom?: boolean, entete?: boolean }} [options]
   */
  constructor(chemin, colonnes, options = {}) {
    super(chemin);
    this.colonnes = colonnes;
    this.separateur = options.separateur ?? ';';
    this.entetePromise = null;
    const debut = (options.bom ?? true ? BOM : '') +
      (options.entete ?? true ? colonnes.join(this.separateur) + '\n' : '');
    if (debut) this.flux.write(debut);
  }

  /** Écrit un objet (clés = colonnes) ou un tableau de valeurs. */
  async ecrire(ligne) {
    const valeurs = Array.isArray(ligne) ? ligne : this.colonnes.map((c) => ligne[c]);
    this.lignes++;
    await this.ecrireBrut(valeurs.map((v) => champCsv(v, this.separateur)).join(this.separateur) + '\n');
  }
}

export class EcrivainJsonl extends Ecrivain {
  async ecrire(objet) {
    this.lignes++;
    await this.ecrireBrut(JSON.stringify(objet) + '\n');
  }
}

/**
 * Lecture simple d'un CSV « propre » (une ligne par enregistrement, guillemets
 * doublés). Suffisant pour les fichiers tarifaires de l'ATIH et les tables NOS.
 */
export function lireCsv(texte, { separateur = ';', entete = true } = {}) {
  const lignes = [];
  let ligne = [];
  let champ = '';
  let entreGuillemets = false;
  const t = texte.startsWith(BOM) ? texte.slice(1) : texte;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (entreGuillemets) {
      if (c === '"') {
        if (t[i + 1] === '"') { champ += '"'; i++; } else entreGuillemets = false;
      } else champ += c;
      continue;
    }
    if (c === '"') { entreGuillemets = true; continue; }
    if (c === separateur) { ligne.push(champ); champ = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { ligne.push(champ); lignes.push(ligne); ligne = []; champ = ''; continue; }
    champ += c;
  }
  if (champ !== '' || ligne.length) { ligne.push(champ); lignes.push(ligne); }

  if (!entete) return lignes;
  const [colonnes, ...corps] = lignes;
  return corps
    .filter((l) => l.some((v) => v !== ''))
    .map((l) => Object.fromEntries(colonnes.map((c, i) => [c.trim(), l[i] ?? ''])));
}
