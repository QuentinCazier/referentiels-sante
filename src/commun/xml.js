/**
 * Analyseur XML minimal, non validant, sans dépendance. Suffisant pour les
 * fichiers ClaML de la CIM-10 (quelques Mo, structure régulière) et les tables
 * SVS des NOS. Produit un arbre : { nom, attributs, enfants, texte }.
 *
 * Gère : éléments, attributs (guillemets simples ou doubles), texte, entités
 * prédéfinies et numériques, commentaires, instructions de traitement,
 * DOCTYPE et CDATA. Ne gère pas les espaces de noms autrement que par le nom
 * complet, ni les entités déclarées dans une DTD.
 */

const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decoderEntites(s) {
  if (!s.includes('&')) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (tout, corps) => {
    if (corps[0] === '#') {
      const code = corps[1] === 'x' || corps[1] === 'X' ? parseInt(corps.slice(2), 16) : parseInt(corps.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : tout;
    }
    return ENTITES[corps] ?? tout;
  });
}

function analyserAttributs(texte) {
  const attributs = {};
  const re = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(texte))) attributs[m[1]] = decoderEntites(m[2] ?? m[3] ?? '');
  return attributs;
}

/**
 * @param {string} xml
 * @returns {{ nom: string, attributs: object, enfants: object[], texte: string }} l'élément racine
 */
export function analyserXml(xml) {
  const racine = { nom: '#document', attributs: {}, enfants: [] };
  const pile = [racine];
  let i = 0;
  const n = xml.length;

  const ajouterTexte = (t) => {
    if (!t) return;
    const parent = pile[pile.length - 1];
    parent.enfants.push({ nom: '#texte', texte: decoderEntites(t) });
  };

  while (i < n) {
    const debut = xml.indexOf('<', i);
    if (debut < 0) { ajouterTexte(xml.slice(i)); break; }
    if (debut > i) ajouterTexte(xml.slice(i, debut));

    if (xml.startsWith('<!--', debut)) {
      const fin = xml.indexOf('-->', debut + 4);
      i = fin < 0 ? n : fin + 3;
      continue;
    }
    if (xml.startsWith('<![CDATA[', debut)) {
      const fin = xml.indexOf(']]>', debut + 9);
      const contenu = xml.slice(debut + 9, fin < 0 ? n : fin);
      pile[pile.length - 1].enfants.push({ nom: '#texte', texte: contenu });
      i = fin < 0 ? n : fin + 3;
      continue;
    }
    if (xml.startsWith('<?', debut)) {
      const fin = xml.indexOf('?>', debut + 2);
      i = fin < 0 ? n : fin + 2;
      continue;
    }
    if (xml.startsWith('<!', debut)) {
      // DOCTYPE, éventuellement avec un sous-ensemble interne entre crochets.
      let profondeur = 0;
      let j = debut;
      for (; j < n; j++) {
        if (xml[j] === '[') profondeur++;
        else if (xml[j] === ']') profondeur--;
        else if (xml[j] === '>' && profondeur === 0) break;
      }
      i = j + 1;
      continue;
    }

    const fin = xml.indexOf('>', debut);
    if (fin < 0) throw new Error('XML tronqué : balise non fermée');
    let corps = xml.slice(debut + 1, fin);
    i = fin + 1;

    if (corps[0] === '/') {
      const nom = corps.slice(1).trim();
      if (pile.length > 1 && pile[pile.length - 1].nom === nom) pile.pop();
      else throw new Error(`XML mal formé : fermeture inattendue de ${nom}`);
      continue;
    }

    const autoFermant = corps.endsWith('/');
    if (autoFermant) corps = corps.slice(0, -1);
    const espace = corps.search(/\s/);
    const nom = espace < 0 ? corps : corps.slice(0, espace);
    const element = { nom, attributs: espace < 0 ? {} : analyserAttributs(corps.slice(espace)), enfants: [] };
    pile[pile.length - 1].enfants.push(element);
    if (!autoFermant) pile.push(element);
  }

  const elements = racine.enfants.filter((e) => e.nom !== '#texte');
  if (!elements.length) throw new Error('XML vide');
  return elements[0];
}

/** Texte concaténé d'un élément et de ses descendants, espaces normalisés. */
export function texteDe(element) {
  if (!element) return '';
  if (element.nom === '#texte') return element.texte;
  return element.enfants.map(texteDe).join('').replace(/\s+/g, ' ').trim();
}

/** Enfants directs portant ce nom. */
export function enfants(element, nom) {
  return element.enfants.filter((e) => e.nom === nom);
}

/** Premier enfant direct portant ce nom. */
export function enfant(element, nom) {
  return element.enfants.find((e) => e.nom === nom) ?? null;
}

/** Parcours en profondeur de tous les éléments portant ce nom. */
export function* chercher(element, nom) {
  for (const e of element.enfants) {
    if (e.nom === '#texte') continue;
    if (e.nom === nom) yield e;
    yield* chercher(e, nom);
  }
}
