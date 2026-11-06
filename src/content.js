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
  address: '[Via], 25030 Erbusco (BS)',
  rsvpBy: '[data]',
  contact: '[telefono / e-mail]',
};

export const PROGRAMME = {
  saturday: [
    ['[15:00]', 'Cerimonia'],
    ['[16:30]', 'Aperitivo in giardino'],
    ['[19:30]', 'Cena'],
    ['[22:00]', 'Torta e balli'],
    ['[02:00]', 'Ultimo giro'],
  ],
  sunday: [['[11:00]', 'Brunch per chi resta']],
};

export const TRAVEL = [
  ['LA VILLA', `${WEDDING.villa}, ${WEDDING.address}`],
  ['IN TRENO', 'Stazione di [città], poi navetta alle [ore].'],
  ['IN AEREO', '[Aeroporto]: [N] km dalla villa.'],
  ['IN AUTO', 'Uscita [casello]. Parcheggio in villa.'],
  ['DA MODICA E DA DARFO', '[I vostri consigli per le famiglie]'],
];

export const STAY = {
  hotels: [['[Hotel 1]', '[N] km'], ['[Hotel 2]', '[N] km'], ['[B&B 3]', '[N] km']],
  code: '[CODICE]',
  bookBy: '[data]',
  shuttle: 'Dagli hotel alla villa alle [ore], ritorno alle [ore].',
};

export const DRESS = {
  line: '[Il vostro dress code, in una riga]',
  rows: [['LUI', '[--]'], ['LEI', '[--]'], ['SCARPE', '[--]']],
  tip: '[un consiglio, es. tacchi larghi: c\'è il prato]',
};

export const FAQ = [
  ['Posso portare i bambini?', '[Risposta]'],
  ['C\'è parcheggio?', '[Risposta]'],
  ['Lista nozze?', '[Risposta]'],
  ['Fino a che ora si balla?', '[Risposta]'],
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

// Five notebooks, one story each (≤ 250 words). Colours match the notebook covers.
export const STORIES = [
  { title: 'Come ci siamo conosciuti', color: '#3E6B4A', body: 'C\'era una volta [...]\n\n[La vostra storia, scritta da voi, massimo 250 parole.]' },
  { title: 'Modica–Darfo, andata e ritorno', color: '#C9A44C', body: '1.073 chilometri in linea d\'aria [...]\n\n[Da scrivere.]' },
  { title: 'Il primo viaggio', color: '#B6402A', body: '[Da scrivere.]' },
  { title: 'Casa a Pavia', color: '#2F4F6E', body: '[Da scrivere: la nebbia, il Ticino, il regionale delle 7:42.]' },
  { title: 'La proposta', color: '#ECE5D6', body: '[Da scrivere.]' },
];

// The glowing "LEGGIMI" book on the shelf.
export const LEGGIMI = {
  title: 'Leggimi',
  body: 'Benvenuti nel nostro studio.\n\nGiratevi pure, toccate tutto: la macchina da scrivere per rispondere, il televisore per le informazioni, l\'album e i quaderni per ridere un po\' di noi.\n\n[Un messaggio vostro per gli ospiti.]',
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
