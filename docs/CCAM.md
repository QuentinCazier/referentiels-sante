# CCAM : correspondance des colonnes

La CCAM (classification commune des actes médicaux) est publiée par
l'Assurance Maladie sous forme d'une base dBase d'une cinquantaine de tables,
en page de code DOS (CP850), historisée : chaque acte, activité ou phase
apparaît une fois par date de modification. La documentation officielle est le
« Guide d'utilisation des fichiers DBF » téléchargeable avec les archives.

L'outil télécharge les trois archives de la version courante depuis la page
« Fichiers informatiques » d'ameli.fr (avec repli sur la dernière version
connue si la page est indisponible), extrait les tables en flux, puis produit
des fichiers de synthèse où seule la version la plus récente de chaque code est
retenue. L'option `--brut` convertit en plus chaque table telle quelle dans
`brut/`.

## Le modèle en trois niveaux

```
acte (7 caractères, ZBQK002)
  └─ activité (acte + 1 chiffre, ZBQK0021) : 1 à 3 activité chirurgicale ou médicale, 4 anesthésie, 5 CEC
       └─ phase (activité + 1 chiffre, ZBQK00210) : 0 par défaut, 1 à 3 pour les actes en plusieurs temps
            ├─ prix unitaire de base et ICR
            └─ prix par grille tarifaire (secteur conventionnel, spécialité)
```

## ccam-actes.csv

| Colonne | Table et champ | Remarque |
|---|---|---|
| code | R_ACTE.COD_ACTE | |
| libelle_court, libelle_long | NOM_COURT ; NOM_LONG à NOM_LONGE recollés | le libellé long est découpé par tranches de 254 caractères dans la source, parfois au milieu d'un mot |
| type, type_libelle | TYPE_COD, R_TYPE | 0 acte isolé, 1 procédure, 2 acte complémentaire |
| chapitre_numero, chapitre_libelle, chapitre_chemin, code_menu | MENU_COD, R_MENU | numérotation « 06.01.03 » recalculée sur les rangs de l'arborescence, hors nœud racine |
| remboursement, remboursement_libelle | REMBOU_COD, R_REMBOURSEMENT | |
| frais_deplacement, frais_deplacement_libelle | FRAIDP_COD, R_FRAIS_DEP | |
| entente_prealable | ENTENTE | O ou N |
| sexe | SEXE | 0 indifférent |
| date_creation, date_effet, date_fin, date_arrete, date_jo, date_modification | DT_CREATIO, DT_EFFET, DT_FIN, DT_ARRETE, DT_JO, DT_MODIF | dates ISO |
| nb_activites, activites | R_ACTE_IVITE | codes d'activité séparés par `\|` |
| regroupement, regroupement_libelle | R_ACTE_IVITE.REGROU_COD de l'activité 1, R_REGROUPEMENT | ADC chirurgie, ADI imagerie, ATM technique médical… |
| tarif_base | R_ACTE_IVITE_PHASE.PU_BASE de l'activité 1, phase 0 | le prix unitaire de base ; les prix par grille sont dans ccam-tarifs-grilles.csv |
| icr, classant | R_AAP_PMSI | indice de coût relatif et caractère classant pour le PMSI |
| version | numéro de version des archives (08400 pour la V84) | |

## Autres fichiers

| Fichier | Contenu | Source |
|---|---|---|
| ccam-activites.csv | une ligne par activité : acte, numéro d'activité et libellé, regroupement, catégorie médicale | R_ACTE_IVITE (version la plus récente) |
| ccam-phases.csv | une ligne par phase : prix unitaire de base, supplément, coefficient, nombre de séances, bornes d'âge, unité d'œuvre, mode de paiement, ICR | R_ACTE_IVITE_PHASE, R_AAP_PMSI |
| ccam-tarifs-grilles.csv | tous les prix par phase et par grille tarifaire, avec leur date de modification (historique complet, près d'un million de lignes) | R_PU_BASE, R_TB23 |
| ccam-modificateurs.csv | modificateurs (urgence, nuit, âge…) avec coefficient, forfait, grille et dates | R_TB11 |
| ccam-activites-modificateurs.csv | modificateurs autorisés pour chaque activité | R_ACTIVITE_MODIFICATEUR |
| ccam-chapitres.csv | arborescence numérotée des chapitres | R_MENU |
| ccam-notes.csv | notes de codage et de facturation par acte, type de note en clair | R_NOTE_ACTE, R_TYPE_NOTE |
| ccam-resume.json | version, comptages, durée | |

Les grilles tarifaires (R_TB23) distinguent secteur 1, secteur 2, OPTAM,
spécialités chirurgicales et anesthésistes… La grille 0 « tous secteurs »
porte le tarif de référence.

## Ce que l'outil ne fait pas

- Il ne calcule pas le tarif d'une facture : associations d'actes (R_ASSOCIATIONS,
  plus d'un million de lignes), incompatibilités, règles de cumul et
  majorations relèvent d'un moteur de facturation. Ces tables sont disponibles
  en `--brut`.
- Il ne porte pas de jugement sur les données : libellés sans accents dans
  certaines tables de codes (« Acte isole »), dates à 1900 ou 2999 sont
  recopiés tels quels.
