/**
 * Construit un fichier DBF (dBase III) en mémoire, pour les tests.
 * @param {{ nom: string, type: 'C'|'N'|'D'|'L', longueur: number, decimales?: number }[]} champs
 * @param {object[]} lignes valeurs par nom de champ (textes en Unicode, encodés en CP850)
 * @param {{ supprimes?: number[] }} [options] indices de lignes à marquer supprimées
 */
export function construireDbf(champs, lignes, options = {}) {
  const CP850_HAUT = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ ';
  const encoder = (s) => Buffer.from([...s].map((c) => {
    const code = c.charCodeAt(0);
    if (code < 0x80) return code;
    const i = CP850_HAUT.indexOf(c);
    return i >= 0 ? 0x80 + i : 0x3f;
  }));

  const longueurEnregistrement = 1 + champs.reduce((n, c) => n + c.longueur, 0);
  const longueurEntete = 32 + champs.length * 32 + 1;
  const entete = Buffer.alloc(longueurEntete);
  entete[0] = 0x03;
  entete[1] = 126; entete[2] = 7; entete[3] = 3;
  entete.writeUInt32LE(lignes.length, 4);
  entete.writeUInt16LE(longueurEntete, 8);
  entete.writeUInt16LE(longueurEnregistrement, 10);
  champs.forEach((c, i) => {
    const p = 32 + i * 32;
    entete.write(c.nom, p, 'latin1');
    entete[p + 11] = c.type.charCodeAt(0);
    entete[p + 16] = c.longueur;
    entete[p + 17] = c.decimales ?? 0;
  });
  entete[longueurEntete - 1] = 0x0d;

  const enregistrements = lignes.map((l, idx) => {
    const b = Buffer.alloc(longueurEnregistrement, 0x20);
    b[0] = options.supprimes?.includes(idx) ? 0x2a : 0x20;
    let pos = 1;
    for (const c of champs) {
      const v = l[c.nom];
      let texte = v === null || v === undefined ? '' : String(v);
      if (c.type === 'N' && texte !== '') texte = texte.padStart(c.longueur, ' ');
      const octets = encoder(texte).subarray(0, c.longueur);
      octets.copy(b, pos);
      pos += c.longueur;
    }
    return b;
  });
  return Buffer.concat([entete, ...enregistrements, Buffer.from([0x1a])]);
}
