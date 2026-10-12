/* EcoTank — aide détaillée aux étudiants ; module indépendant.
 * À intégrer au routeur étudiant une fois le point d'entrée validé.
 * Données et réponses locales uniquement.
 */
window.EcoTankStudentHelp={
  institutions:{
    ulb:{name:"ULB",email:"sse@ulb.be",phone:"02 650 20 14",url:"https://www.ulb.be/fr/aides-financieres-sociales-et-inclusives/aides-financieres",steps:["Ouvrir MonULB","Mon secrétariat virtuel","Ma situation financière","Ma demande d’aide financière","Dossier au Service social étudiants","Téléverser les documents puis écrire à sse@ulb.be pour demander un rendez-vous."]},
    vub:{name:"VUB",url:"https://www.vub.be/en/studying-vub/support-and-contact/student-support",steps:["Ouvrir le site Student Support","Demander l’aide financière et la liste des pièces","Demander un rendez-vous avec un interlocuteur"]},
    he2b:{name:"HE2B",url:"https://www.he2b.be/",steps:["Ouvrir le site de l’établissement","Trouver le service social étudiant","Demander un rendez-vous et la liste des pièces"]},
    helb:{name:"HELB",url:"https://www.helb-prigogine.be/",steps:["Ouvrir le site de l’établissement","Contacter le service social de votre implantation"]},
    other:{name:"Autre établissement",url:"https://www.studyinbelgium.be/",steps:["Retrouver le site de l’établissement","Demander le contact du service social étudiant"]}
  },
  grant:{deadline:"2026-10-31",url:"https://allocations-etudes.cfwb.be/foire-aux-questions/",steps:["Ouvrir le formulaire FWB","Introduire la demande avant la date limite, même avec des documents manquants","Sauvegarder la preuve de dépôt","Répondre aux demandes ultérieures de pièces"]},
  employment:{url:"https://www.studentatwork.be/fr/quota-heures-et-impact.html",steps:["Consulter les heures Student@work (650 heures annuelles à cotisations réduites)","Vérifier séparément les 240 heures par trimestre pour les allocations familiales bruxelloises","Attention à l’exception juillet-septembre si poursuite des études"]},
  email:(school)=>{const name=school?.name||"mon établissement";return "Bonjour, je suis étudiante à "+name+" et je rencontre des difficultés pour mon logement et mes études. Je travaille aussi sous contrat étudiant. Pouvez-vous m’aider à introduire une demande d’aide financière, m’indiquer les pièces nécessaires et me proposer un rendez-vous ? Merci.";},
  statuses:["À faire","Demande envoyée","En attente","Je bloque","C’est réglé"]
};