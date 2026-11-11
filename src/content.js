// Everything the guests read lives here. Replace the [placeholders] with the real details.
// Square brackets mark content still to be written.

export const WEDDING = {
  names: 'Gabriele & Paola',
  dateShort: '29/05',            // teletext header, e.g. '13/06'
  dateLong: 'Sabato 29 maggio 2027',
  // ISO date used for the wall-calendar countdown.
  dateISO: '2027-05-29',
  villa: 'Cascina Carretto',
  town: 'Erbusco',
  address: 'Erbusco (BS)',
  rsvpBy: '15 gennaio 2027',
};

// Teletext pages: each `text` is a list of paragraphs, wrapped to the screen and split into subpages when long.

// 101: Quindi cosa si fa?
export const PROGRAMME = {
  title: 'Quindi cosa si fa?',
  day: 'Sabato 29 maggio',
  rows: [['15.30', 'Arrivo invitati presso Cascina Carretto - Erbusco (BS)']],
  text: [
    'Non avrete davvero pensato che avremmo scandito ogni momento della giornata in modo preciso, vero?',
    'L’idea, in linea generale, è: ci troviamo tutti allegramente alle 15.30, ci sistemiamo e diamo inizio al nostro matrimonio, seguiranno, non per forza in quest’ordine: un ricco rinfresco, una deliziosa cena, delle danze più o meno pazze, dei discorsi più o meno strappalacrime, molte risate, felicità a secchiate, amore a palate e tutte le cose che non siamo assolutamente in grado di governare con anticipo ma che siamo sicuri renderanno questa una giornata speciale.',
  ],
};

// 200: Come arrivare
export const TRAVEL = {
  title: 'Come arrivare',
  text: [
    'La cerimonia e il ricevimento si terranno presso la tenuta Cascina Carretto nell’omonima località di Erbusco (BS). Saremo circondati da bellissimi vigneti e prati, che si estendono per tutta la Franciacorta, un posto magnifico che non ci fornisce nessun punto di riferimento utile per segnalarvi il percorso. Siamo comunque fiduciosi che Google Maps o qualsiasi altro sistema di navigazione potrà aiutarvi a trovare la strada per raggiungerla, se siete in difficoltà chiamateci (probabilmente non risponderemo, ma non preoccupatevi: stiamo bene).',
  ],
};

// 300: Meteo
export const WEATHER = {
  title: 'Meteo',
  text: [
    'Qualsiasi condizione meteo è possibile e ammessa. Noi speriamo che non faccia troppo caldo ma che non si metta a diluviare, in ogni caso: con la pioggia o con il sole il matrimonio si terrà e saremo felici in egual modo.',
    'Questa sezione in tempi come questi è abbastanza inutile, ma in qualche modo dovremo pur popolare questo televideo.',
  ],
};

// 400: Dress code
export const DRESS = {
  title: 'Dress code',
  text: [
    'Come ben sapete non siamo avvezzi a questo genere di usanze; l’unico nostro auspicio è che ciascuno di voi si senta a proprio agio. Non ponete freni alla vostra fantasia, siamo sicuri che sarete bellissimi.',
  ],
};

// 500: Facci sapere
export const RSVP = {
  title: 'Facci sapere',
  text: [
    `Potete confermarci la vostra presenza, entro il ${WEDDING.rsvpBy}, interagendo con la macchina da scrivere che si trova sulla scrivania qui accanto (A).`,
    'Se avete già risposto potete andare alla pagina 600 del televideo!',
  ],
};

// 600: Libro degli ospiti (filled in by the guests' answers)
export const GUESTBOOK = { title: 'Libro degli ospiti' };

// 700: FAQ, as [question, answer paragraphs]
export const FAQ = [
  ['Chi è che si sposa?', ['Paola e Gabriele!']],
  ['C’è un dress code?', ['Vai a pagina 400 del televideo']],
  ['C’è parcheggio?', ['Sì, troverete tutto il parcheggio di cui avete bisogno.']],
  ['Lista nozze e regali', ['La casa in cui viviamo è piccola e non ci manca nulla, il miglior regalo che possiate farci è starci accanto in questo giorno importante. Vogliamo che ciascuno si senta libero di contribuire solo se e come può noi non ci faremo attenzione, ogni donazione servirà a finanziare la nostra spedizione di ricerca della Valle dei Mumin (Mumindalen).']],
  ['Se ho allergie, intolleranze o seguo un regime alimentare non convenzionale', [
    'Nessun problema! Segnalatecelo quanto prima in modo da organizzare al meglio il nostro banchetto, senza pensieri e preoccupazioni.',
    'In ogni caso, segnalatelo anche ai camerieri quel giorno, affinché non ci siano incidenti.',
  ]],
];

// Photo album: swap `src` for real photos (any orientation). Without src a sketch placeholder is drawn.
export const PHOTOS = [
  { caption: '[didascalia stupida]', src: null },
  { caption: '[la prima vacanza]', src: null },
  { caption: '[ma perché?]', src: null },
  { caption: '[Modica, agosto]', src: null },
  { caption: '[Darfo, Natale]', src: null },
  { caption: '[il trasloco a Pavia]', src: null },
  { caption: '[sul regionale per Milano]', src: null },
  { caption: '[in bici, prima della pioggia]', src: null },
  { caption: '[tennis: chi ha vinto?]', src: null },
  { caption: '[la cena bruciata]', src: null },
  { caption: '[il giorno della proposta]', src: null },
  { caption: '[noi, adesso]', src: null },
];

// Five short stories (≤ 250 words each), once the notebooks on the desk. The notebooks made room for
// LEGGIMI and nothing in the room opens these now (overlays.notebooks() still can), kept for another home.
export const STORIES = [
  { title: 'Come ci siamo conosciuti', color: '#3E6B4A', body: 'C\'era una volta [...]\n\n[La vostra storia, scritta da voi, massimo 250 parole.]' },
  { title: 'Modica–Darfo, andata e ritorno', color: '#C9A44C', body: '1.073 chilometri in linea d\'aria [...]\n\n[Da scrivere.]' },
  { title: 'Il primo viaggio', color: '#B6402A', body: '[Da scrivere.]' },
  { title: 'Casa a Pavia', color: '#2F4F6E', body: '[Da scrivere: la nebbia, il Ticino, il regionale delle 7:42.]' },
  { title: 'La proposta', color: '#ECE5D6', body: '[Da scrivere.]' },
];

// The glowing "LEGGIMI" book on the desk.
export const LEGGIMI = {
  title: 'Leggimi',
  body: 'Benvenuti nell’anticamera del nostro matrimonio! Questo è un luogo virtuale per prepararci insieme a questo magico avvenimento. Non siate timidi e interagite con gli oggetti della stanza.\nLa macchina da scrivere serve per confermare la vostra partecipazione, mentre il televisore è sintonizzato su un televideo pieno zeppo di informazioni utili.\n\nIn questa libreria ci sono alcuni degli autori che amiamo di più e anche qualche piccolo easter egg, sentitevi liberi di spulciarla :)',
};

export const CREDITS = [
  ['Una produzione di', WEDDING.names],
  ['Scenografia', 'Uno studio italiano, fine anni \'90'],
  ['Luci', 'Il sole, venti minuti prima del tramonto'],
  ['Comparse', 'Due asini, due asinelli, un gallo, molte rondini'],
  ['Treni', 'Regionale veloce, in ritardo come sempre'],
  ['Disegnato a', 'penna, a mano (più o meno)'],
];

// Suggested playlist for the hi-fi (shown as a list for now).
export const PLAYLIST = ['[Canzone 1 — Artista]', '[Canzone 2 — Artista]', '[Canzone 3 — Artista]'];

// Optional notes for the library card of a book taken off the shelf, keyed by its title exactly as
// on the spine (or "Author · Title" when two books share a title). Books without one show only the facts.
export const BOOK_NOTES = {
  // 'Le città invisibili': '[Perché è qui, in una o due righe]',
};

// A friend's novel, standing face-out on the third shelf, right-hand side. Taken out, it turns to show its cover
// (tap it, or "Giralo", for the back) and its card links to the publisher's page, where it can be bought.
// The book itself (cover art, spine, flaps) is drawn in src/friendbook.js.
export const FRIEND_BOOK = {
  title: 'La causa dei vivi',
  author: 'Anna Gabriella Rusconi',
  publisher: 'Cronache Ribelli',
  series: 'Narrativa',
  genre: 'Romanzo storico',
  year: 2026,
  pages: 314,
  format: '15 × 21 cm',
  isbn: '9791280257857',
  blurb: 'Trento, 1475. Il vescovo Battista de’ Giudici arriva su ordine del papa per giudicare il processo alla comunità ebraica della città: le confessioni sono state estorte con la tortura, ma il principe vescovo vuole a ogni costo il suo santo martire.',
  shop: { url: 'https://cronacheribelli.it/products/la-causa-dei-vivi', label: 'Vedilo su Cronache Ribelli' },
};
