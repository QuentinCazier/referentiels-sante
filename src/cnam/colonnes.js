/**
 * Dictionnaire des colonnes des tables de codage de l'Assurance Maladie.
 *
 * Chaque entrée : [description, source] où source vaut
 *   'notice'   décrit dans la notice officielle publiée avec les fichiers (UCD : « lisez_moi.pdf »)
 *   'deduit'   déduit du nom de la colonne et des valeurs observées, faute de notice
 *   'inconnu'  non documenté et non interprétable avec certitude
 *
 * Les noms de tables sont ceux des fichiers, sans numéro de version.
 */

const n = (d) => [d, 'notice'];
const d = (t) => [t, 'deduit'];
const inconnu = ['non documenté', 'inconnu'];

const RMO = 'référence médicale opposable associée (jusqu\'à cinq)';
const ARBO = 'position dans l\'arborescence des chapitres, niveau ';

export const COLONNES = {
  ucd_total: {
    code_ucd: n('code UCD (unité commune de dispensation), 7 chiffres commençant par 9, publié au Journal officiel'),
    liste: n('liste d\'inscription : R rétrocession, M facturable en sus en MCO, S facturable en sus en SMR ; un même code apparaît une fois par liste'),
    nom_court: n('libellé de la spécialité et nombre d\'unités par conditionnement, ou début du libellé long'),
    dt_dinscri: n('date de début d\'inscription sur la liste (début de prise en charge)'),
    dt_finscri: n('date de fin d\'inscription (fin de prise en charge au lendemain)'),
    motif_fin: d('motif de la fin d\'inscription'),
    labo_exp: n('laboratoire exploitant'),
    dt_sourdoc: n('date de la publication au Journal officiel ou de la décision CNAM ayant modifié les données du code'),
    dt_apprix: n('date d\'application du prix ou du « top sur facture »'),
    prix_ht: n('prix fabricant hors taxe publié au Journal officiel (la notice parle de centimes d\'euros, les valeurs observées sont en euros)'),
    prix_ttc: n('prix public TTC hors marge (prix HT majoré de la TVA à 2,1 %)'),
    t_facture: n('« top sur facture » : O si prix libre non publié (accès précoce en rétrocession), N sinon ; vide pour les listes en sus'),
    marge_ttc: n('marge TTC de rétrocession, facturée par ligne de prescription'),
    dt_aptaux: n('date d\'application du taux de remboursement (rétrocession)'),
    taux: n('taux de remboursement (rétrocession) ; vide pour les listes en sus, dont le taux suit celui du séjour'),
    dt_dcousup: n('début de la période où un coût supplémentaire de reconstitution peut être facturé (rétrocession)'),
    dt_fcousup: n('fin de cette période'),
    dt_apmajo: n('date d\'effet du coefficient de majoration outre-mer'),
    majo_971: n('coefficient de majoration Guadeloupe'),
    majo_972: n('coefficient de majoration Martinique'),
    majo_973: n('coefficient de majoration Guyane'),
    majo_974: n('coefficient de majoration La Réunion'),
    dt_dlprive: n('début d\'autorisation de délivrance par un établissement de santé privé (listes en sus)'),
    dt_flprive: n('fin de cette autorisation'),
    dt_dlpubli: n('début d\'autorisation de délivrance par un établissement de santé public (listes en sus)'),
    dt_flpubli: n('fin de cette autorisation'),
    nom_long1: n('libellé long, dénomination exacte du résumé des caractéristiques du produit'),
    nom_long2: n('suite du libellé long'),
    etat: n('état : D disponible, NC non commercialisé, S supprimé du marché'),
    cod_forme: n('code interne de la forme pharmaceutique'),
    forme: n('libellé de la forme pharmaceutique'),
    cod_cforme: n('code interne du premier complément de forme'),
    cpmtforme: n('compléments de forme concaténés (sécable, pelliculé…)'),
    ddd: n('dose journalière usuelle (defined daily dose), valeur'),
    d_administ: n('unité de la dose journalière usuelle'),
    par_voie: n('voie d\'administration de la dose journalière usuelle'),
    cod_atc: n('code ATC de niveau 5 (classification anatomique, thérapeutique, chimique de l\'OMS)'),
    classe_atc: n('libellé de la classe ATC'),
    cod_ephmra: n('code de la classe EphMRA (classification de l\'industrie pharmaceutique)'),
    cla_ephmra: n('libellé de la classe EphMRA'),
    rh: d('condition de prescription : réservé à l\'usage hospitalier (sigle usuel, non détaillé dans la notice)'),
    ph: d('condition de prescription : prescription hospitalière'),
    pih: d('condition de prescription : prescription initiale hospitalière'),
    sp: d('condition de prescription : surveillance particulière pendant le traitement'),
    ps: d('condition de prescription : prescription réservée à certains spécialistes'),
  },
  ucd_maj: 'ucd_total',
  ucd_histo_prix: {
    code_ucd: n('code UCD'),
    liste: n('liste d\'inscription : R, M ou S'),
    design: d('désignation'),
    condit: d('conditionnement'),
    dt_appli: n('date d\'application du prix'),
    prix_ht: n('prix hors taxe'),
    prix_ttc: n('prix TTC'),
    t_facture: n('« top sur facture »'),
    dt_source: n('date de la publication source'),
  },
  retro_histo_taux: {
    code_ucd: n('code UCD (liste rétrocession uniquement)'),
    nom_court: n('libellé court'),
    dt_appli: n('date d\'application du taux de remboursement'),
    taux: n('taux de remboursement'),
    dt_source: n('date de la publication source'),
  },
  retro_histo_cout_sup: {
    code_ucd: n('code UCD (liste rétrocession uniquement)'),
    design: d('désignation'),
    condit: d('conditionnement'),
    dt_debut: n('début de la période de coût supplémentaire'),
    dt_fin: n('fin de la période de coût supplémentaire'),
  },

  nabm_fiche_tot: {
    code_nabm: d('code de l\'acte de biologie (table nationale de biologie), 4 chiffres'),
    nom_court: d('libellé court'),
    nom_long: d('libellé long'),
    date_debut: d('date de début de validité du code'),
    date_fin: d('date de fin de validité du code'),
    rmo1: d(RMO), rmo2: d(RMO), rmo3: d(RMO), rmo4: d(RMO), rmo5: d(RMO),
    arbo1: d(ARBO + '1'), arbo2: d(ARBO + '2'), arbo3: d(ARBO + '3'), arbo4: d(ARBO + '4'), arbo5: d(ARBO + '5'),
    place: d('rang de l\'acte dans son chapitre'),
    comment1: d('commentaire, morceau 1 (à concaténer avec les suivants)'),
    comment2: d('commentaire, morceau 2'), comment3: d('commentaire, morceau 3'), comment4: d('commentaire, morceau 4'), comment5: d('commentaire, morceau 5'),
    comment6: d('commentaire, morceau 6'), comment7: d('commentaire, morceau 7'), comment8: d('commentaire, morceau 8'), comment9: d('commentaire, morceau 9'), comment10: d('commentaire, morceau 10'),
  },
  nabm_histo_tot: {
    code_nabm: d('code de l\'acte'),
    date_effet: d('date d\'effet de la version'),
    entente: d('entente préalable requise'),
    cond_remb: d('condition de remboursement'),
    max_factu: d('nombre maximal facturable'),
    code_regle: d('code de règle de facturation'),
    max_regle: d('maximum associé à la règle'),
    indication: d('indication de remboursement'),
    reserve: d('réserve ou restriction'),
    init_bio: d('initiative du biologiste autorisée'),
    examen: d('nature de l\'examen'),
    lc1: d('lettre clé (B, BHN, KB…), première cotation'), coef1: d('coefficient de la première cotation'),
    lc2: d('lettre clé, deuxième cotation'), coef2: d('coefficient, deuxième cotation'),
    lc3: d('lettre clé, troisième cotation'), coef3: d('coefficient, troisième cotation'),
    lc4: d('lettre clé, quatrième cotation'), coef4: d('coefficient, quatrième cotation'),
    lc5: d('lettre clé, cinquième cotation'), coef5: d('coefficient, cinquième cotation'),
    spec1: d('spécialité autorisée à exécuter l\'acte (jusqu\'à dix)'), spec2: d('spécialité autorisée'), spec3: d('spécialité autorisée'), spec4: d('spécialité autorisée'), spec5: d('spécialité autorisée'),
    spec6: d('spécialité autorisée'), spec7: d('spécialité autorisée'), spec8: d('spécialité autorisée'), spec9: d('spécialité autorisée'), spec10: d('spécialité autorisée'),
  },
  nabm_incomp_tot: {
    code1: d('premier code de la paire d\'actes incompatibles'),
    code2: d('second code de la paire'),
  },

  lpp_fiche_tot: {
    code_tips: d('code LPP à 7 chiffres (TIPS est l\'ancien nom de la liste)'),
    nom_court: d('libellé court'),
    rmo1: d(RMO), rmo2: d(RMO), rmo3: d(RMO), rmo4: d(RMO), rmo5: d(RMO),
    date_fin: d('date de fin de validité du code'),
    age_max: d('âge maximal de prise en charge, 0 si aucun'),
    type_prest: d('type de prestation (achat, location, service…)'),
    indication: d('indication de prise en charge'),
    arbo1: d(ARBO + '1'), arbo2: d(ARBO + '2'), arbo3: d(ARBO + '3'), arbo4: d(ARBO + '4'), arbo5: d(ARBO + '5'),
    arbo6: d(ARBO + '6'), arbo7: d(ARBO + '7'), arbo8: d(ARBO + '8'), arbo9: d(ARBO + '9'), arbo10: d(ARBO + '10'),
    place: d('rang dans le chapitre'),
    prothese: d('indicateur de prothèse'),
    old_code: d('ancien code'),
  },
  lpp_histo_tot: {
    code_tips: d('code LPP'),
    debutvalid: d('début de validité de la version tarifaire'),
    finhisto: d('fin de validité de la version'),
    nat_prest: d('nature de prestation'),
    entente: d('entente préalable requise'),
    arrete: d('date de l\'arrêté'),
    jo: d('date de publication au Journal officiel'),
    pudevis: d('prix unitaire sur devis'),
    tarif: d('tarif de responsabilité (base de remboursement)'),
    majo_dom1: d('majoration outre-mer, territoire 1'), majo_dom2: d('majoration outre-mer, territoire 2'), majo_dom3: d('majoration outre-mer, territoire 3'),
    majo_dom4: d('majoration outre-mer, territoire 4'), majo_dom5: d('majoration outre-mer, territoire 5'), majo_dom6: d('majoration outre-mer, territoire 6'),
    qte_max: d('quantité maximale prise en charge'),
    mt_max: d('montant maximal'),
    pureglemen: d('prix unitaire réglementé (prix limite de vente)'),
    pecp01: inconnu, pecp02: inconnu, pecp03: inconnu,
  },
  lpp_incomp_tot: { code1: d('premier code de la paire de codes incompatibles'), code2: d('second code de la paire') },
  lpp_comp_tot: { code1: d('premier code de la paire de codes compatibles'), code2: d('second code de la paire') },
};

/** Trouve le dictionnaire d'une table à partir de son nom de fichier (numéro de version retiré). */
export function dictionnairePour(nomTable) {
  const base = nomTable.toLowerCase().replace(/_?\d{3,}(_\d+)?$/, '');
  let dico = COLONNES[base];
  if (typeof dico === 'string') dico = COLONNES[dico];
  return dico ?? null;
}

const LIBELLE_SOURCE = { notice: 'notice officielle', deduit: 'déduit du nom et des valeurs', inconnu: 'non documenté' };

/** Rédige le dictionnaire d'une table en Markdown, colonne par colonne. */
export function documenterTable(nomTable, colonnes) {
  const dico = dictionnairePour(nomTable) ?? {};
  const lignes = [`### ${nomTable}`, '', '| Colonne | Description | Source |', '|---|---|---|'];
  for (const c of colonnes) {
    const [description, source] = dico[c] ?? inconnu;
    lignes.push(`| ${c} | ${description} | ${LIBELLE_SOURCE[source]} |`);
  }
  return lignes.join('\n');
}
