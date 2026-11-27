/**
 * What autocorrect changes, apart from the editor: the built-in English list of typos and the rules
 * for capitals. Pure functions over the text before the cursor.
 */

/**
 * Common English typos and the right words. Only spellings that are never right as typed are listed
 * (so "calender", "wont", "cant", "ill" and "its" are not), nor in the languages people often write
 * next to English (German "im", "Frist", "wich", French "dont", Spanish "posible"): a wrong
 * correction is worse than none.
 */
const ENGLISH_LIST: Record<string, string> = {
  // Letters swapped while typing fast.
  teh: 'the',
  hte: 'the',
  tje: 'the',
  tyhe: 'the',
  adn: 'and',
  taht: 'that',
  thta: 'that',
  waht: 'what',
  whta: 'what',
  wiht: 'with',
  wtih: 'with',
  thsi: 'this',
  tihs: 'this',
  htis: 'this',
  thier: 'their',
  theri: 'their',
  jsut: 'just',
  konw: 'know',
  knwo: 'know',
  nkow: 'know',
  wnat: 'want',
  watn: 'want',
  woudl: 'would',
  wuold: 'would',
  owuld: 'would',
  coudl: 'could',
  cuold: 'could',
  shoudl: 'should',
  shuold: 'should',
  becuase: 'because',
  becasue: 'because',
  beacuse: 'because',
  bceause: 'because',
  abotu: 'about',
  aobut: 'about',
  baout: 'about',
  abuot: 'about',
  yuo: 'you',
  oyu: 'you',
  yuor: 'your',
  yoru: 'your',
  frmo: 'from',
  thne: 'then',
  tehn: 'then',
  tehm: 'them',
  thme: 'them',
  htem: 'them',
  wehn: 'when',
  whne: 'when',
  hwen: 'when',
  whihc: 'which',
  whcih: 'which',
  wihch: 'which',
  agian: 'again',
  aginst: 'against',
  againt: 'against',
  alwasy: 'always',
  alwyas: 'always',
  anohter: 'another',
  anwser: 'answer',
  asnwer: 'answer',
  befroe: 'before',
  beofre: 'before',
  brigde: 'bridge',
  certian: 'certain',
  chnage: 'change',
  comapny: 'company',
  compnay: 'company',
  comptuer: 'computer',
  contian: 'contain',
  doign: 'doing',
  eariler: 'earlier',
  everythign: 'everything',
  exmaple: 'example',
  exapmle: 'example',
  fianlly: 'finally',
  fisrt: 'first',
  gerat: 'great',
  goign: 'going',
  gonig: 'going',
  haev: 'have',
  hvae: 'have',
  ahve: 'have',
  hting: 'thing',
  htink: 'think',
  idae: 'idea',
  improtant: 'important',
  importnat: 'important',
  informatoin: 'information',
  langauge: 'language',
  liek: 'like',
  likley: 'likely',
  littel: 'little',
  lookign: 'looking',
  mkae: 'make',
  mroe: 'more',
  mysefl: 'myself',
  ohter: 'other',
  otehr: 'other',
  onyl: 'only',
  olny: 'only',
  peopel: 'people',
  poeple: 'people',
  pepole: 'people',
  perhpas: 'perhaps',
  porblem: 'problem',
  probelm: 'problem',
  problme: 'problem',
  questoin: 'question',
  raelly: 'really',
  rememebr: 'remember',
  restuarant: 'restaurant',
  rigth: 'right',
  rihgt: 'right',
  smae: 'same',
  soem: 'some',
  somethign: 'something',
  sotry: 'story',
  studnet: 'student',
  systme: 'system',
  tahn: 'than',
  thna: 'than',
  thign: 'thing',
  thigns: 'things',
  thikn: 'think',
  thoguht: 'thought',
  thougth: 'thought',
  throuhg: 'through',
  tiem: 'time',
  togehter: 'together',
  tonigth: 'tonight',
  udpate: 'update',
  uesd: 'used',
  veyr: 'very',
  vrey: 'very',
  wokr: 'work',
  wrok: 'work',
  wrogn: 'wrong',
  yera: 'year',
  yeras: 'years',
  // Letters missing, doubled or out of order.
  accomodate: 'accommodate',
  accomodation: 'accommodation',
  acommodate: 'accommodate',
  accross: 'across',
  acess: 'access',
  acheive: 'achieve',
  acheived: 'achieved',
  acheivement: 'achievement',
  adress: 'address',
  allready: 'already',
  alredy: 'already',
  allways: 'always',
  apparant: 'apparent',
  apparantly: 'apparently',
  appearence: 'appearance',
  arguement: 'argument',
  basicly: 'basically',
  beatiful: 'beautiful',
  beautifull: 'beautiful',
  begining: 'beginning',
  beggining: 'beginning',
  beleive: 'believe',
  belive: 'believe',
  beleif: 'belief',
  buisness: 'business',
  bussiness: 'business',
  carribean: 'Caribbean',
  cemetary: 'cemetery',
  changable: 'changeable',
  cheif: 'chief',
  choosen: 'chosen',
  cieling: 'ceiling',
  collegue: 'colleague',
  comming: 'coming',
  commited: 'committed',
  commitee: 'committee',
  comittee: 'committee',
  completly: 'completely',
  concensus: 'consensus',
  concieve: 'conceive',
  concious: 'conscious',
  decieve: 'deceive',
  definately: 'definitely',
  definatly: 'definitely',
  definetly: 'definitely',
  definitly: 'definitely',
  diffrent: 'different',
  differnt: 'different',
  dilemna: 'dilemma',
  dissapear: 'disappear',
  dissapoint: 'disappoint',
  dissapointed: 'disappointed',
  embarass: 'embarrass',
  embarassed: 'embarrassed',
  embarassing: 'embarrassing',
  enviroment: 'environment',
  enviromental: 'environmental',
  excercise: 'exercise',
  exersize: 'exercise',
  existance: 'existence',
  expecially: 'especially',
  experiance: 'experience',
  evrything: 'everything',
  familar: 'familiar',
  finaly: 'finally',
  flourescent: 'fluorescent',
  folowing: 'following',
  follwing: 'following',
  foriegn: 'foreign',
  fourty: 'forty',
  foward: 'forward',
  freind: 'friend',
  freinds: 'friends',
  feild: 'field',
  garantee: 'guarantee',
  guarentee: 'guarantee',
  gaurd: 'guard',
  geting: 'getting',
  goverment: 'government',
  grammer: 'grammar',
  hapen: 'happen',
  hapened: 'happened',
  happend: 'happened',
  harrass: 'harass',
  harrased: 'harassed',
  helpfull: 'helpful',
  hieght: 'height',
  humourous: 'humorous',
  ignorence: 'ignorance',
  imediately: 'immediately',
  immediatly: 'immediately',
  immediatley: 'immediately',
  imporant: 'important',
  independant: 'independent',
  infomation: 'information',
  interupt: 'interrupt',
  intresting: 'interesting',
  intrest: 'interest',
  knowlege: 'knowledge',
  laguage: 'language',
  lenght: 'length',
  liason: 'liaison',
  libary: 'library',
  liesure: 'leisure',
  maintainance: 'maintenance',
  maintenence: 'maintenance',
  makeing: 'making',
  millenium: 'millennium',
  minature: 'miniature',
  mischievious: 'mischievous',
  mispell: 'misspell',
  mispelled: 'misspelled',
  necesarily: 'necessarily',
  necesary: 'necessary',
  neccesary: 'necessary',
  neccessary: 'necessary',
  neice: 'niece',
  nieghbor: 'neighbor',
  nieghbour: 'neighbour',
  noticable: 'noticeable',
  occassion: 'occasion',
  occassionally: 'occasionally',
  ocassion: 'occasion',
  occured: 'occurred',
  occurence: 'occurrence',
  occurance: 'occurrence',
  occuring: 'occurring',
  oportunity: 'opportunity',
  oppurtunity: 'opportunity',
  paralel: 'parallel',
  parliment: 'parliament',
  peice: 'piece',
  percieve: 'perceive',
  posess: 'possess',
  posession: 'possession',
  potatos: 'potatoes',
  preceeding: 'preceding',
  prefered: 'preferred',
  presense: 'presence',
  privelege: 'privilege',
  priviledge: 'privilege',
  probaly: 'probably',
  probly: 'probably',
  propably: 'probably',
  proffesional: 'professional',
  progam: 'program',
  pronounciation: 'pronunciation',
  publically: 'publicly',
  questionaire: 'questionnaire',
  realy: 'really',
  reciept: 'receipt',
  recieve: 'receive',
  recieved: 'received',
  recieving: 'receiving',
  recomend: 'recommend',
  reccomend: 'recommend',
  reccommend: 'recommend',
  recomendation: 'recommendation',
  recurrance: 'recurrence',
  refered: 'referred',
  refering: 'referring',
  relevent: 'relevant',
  religous: 'religious',
  remeber: 'remember',
  rember: 'remember',
  repitition: 'repetition',
  resistence: 'resistance',
  resturant: 'restaurant',
  rythm: 'rhythm',
  saftey: 'safety',
  scedule: 'schedule',
  schedual: 'schedule',
  seige: 'siege',
  sentance: 'sentence',
  seperate: 'separate',
  seperated: 'separated',
  seperately: 'separately',
  sieze: 'seize',
  similiar: 'similar',
  simliar: 'similar',
  sincerly: 'sincerely',
  somthing: 'something',
  speach: 'speech',
  stoped: 'stopped',
  strenght: 'strength',
  succeded: 'succeeded',
  succesful: 'successful',
  succesfully: 'successfully',
  sucessful: 'successful',
  successfull: 'successful',
  sucess: 'success',
  sucessfully: 'successfully',
  supose: 'suppose',
  suprise: 'surprise',
  sytem: 'system',
  temperture: 'temperature',
  tendancy: 'tendency',
  theif: 'thief',
  threshhold: 'threshold',
  toghether: 'together',
  tommorow: 'tomorrow',
  tomorow: 'tomorrow',
  tommorrow: 'tomorrow',
  tounge: 'tongue',
  truely: 'truly',
  twelth: 'twelfth',
  tyrany: 'tyranny',
  unforseen: 'unforeseen',
  unfortunatly: 'unfortunately',
  unfortunatley: 'unfortunately',
  unneccessary: 'unnecessary',
  untill: 'until',
  upate: 'update',
  usally: 'usually',
  usualy: 'usually',
  vaccum: 'vacuum',
  vacume: 'vacuum',
  vehical: 'vehicle',
  visable: 'visible',
  wierd: 'weird',
  withold: 'withhold',
  writen: 'written',
  writting: 'writing',
  yeild: 'yield',
  // Two words written as one.
  alot: 'a lot',
  aswell: 'as well',
  atleast: 'at least',
  eachother: 'each other',
  everytime: 'every time',
  infact: 'in fact',
  inspite: 'in spite',
  noone: 'no one',
  ofcourse: 'of course',
  thankyou: 'thank you',
  // Apostrophes left out (only where the word without one doesn't exist).
  arent: "aren't",
  couldnt: "couldn't",
  couldve: "could've",
  didnt: "didn't",
  doesnt: "doesn't",
  dosent: "doesn't",
  hadnt: "hadn't",
  hasnt: "hasn't",
  havent: "haven't",
  heres: "here's",
  isnt: "isn't",
  itll: "it'll",
  mustnt: "mustn't",
  neednt: "needn't",
  shes: "she's",
  shouldnt: "shouldn't",
  shouldve: "should've",
  thatll: "that'll",
  thats: "that's",
  theres: "there's",
  theyd: "they'd",
  theyll: "they'll",
  theyre: "they're",
  theyve: "they've",
  wasnt: "wasn't",
  werent: "weren't",
  weve: "we've",
  whats: "what's",
  wheres: "where's",
  wouldnt: "wouldn't",
  wouldve: "would've",
  youd: "you'd",
  youll: "you'll",
  youre: "you're",
  youve: "you've",
  "dosen't": "doesn't",
  "coudn't": "couldn't",
  // The pronoun I, and names of days and months (not "may", "march" or "august": they are words too).
  i: 'I',
  ive: "I've",
  "i'm": "I'm",
  "i've": "I've",
  "i'll": "I'll",
  "i'd": "I'd",
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
  january: 'January',
  february: 'February',
  april: 'April',
  june: 'June',
  july: 'July',
  september: 'September',
  october: 'October',
  november: 'November',
  december: 'December',
};

/** The built-in list as a map (a plain object would answer for "constructor" too). */
export const ENGLISH = new Map(Object.entries(ENGLISH_LIST));

/**
 * Words that look like a slip of Shift (TWo INitial CApitals) but are written that way: units,
 * degrees, product names.
 */
const TWO_CAPITALS_KEPT = new Set([
  'MHz',
  'GHz',
  'THz',
  'KHz',
  'MBps',
  'KBps',
  'GBps',
  'TBps',
  'MSc',
  'BSc',
  'DSc',
  'MSci',
  'OAuth',
  'IPsec',
  'VMware',
  'CMake',
  'MPlayer',
  'DBeaver',
  'GHub',
  'PEFTs',
  'SQLite',
]);

/**
 * Abbreviations whose period doesn't end a sentence (lower case, without the period). Ones with a
 * period inside (e.g., i.e., U.S.) and single letters (initials) are recognized without a list.
 */
const ABBREVIATIONS = new Set(
  (
    'mr mrs ms dr prof sr jr st vs etc cf al approx incl excl no nos fig figs vol vols ch sec ' +
    'p pp ed eds dept est inc ltd co corp jan feb mar apr jun jul aug sep sept oct nov dec ' +
    'mon tue tues wed thu thur thurs fri sat sun min max avg tel ext ca resp ref nr bzw usw ' +
    'vgl ggf evtl sra srta pag pags mme mlle'
  ).split(' '),
);

/** What kind of change: a typo from a list, TWo INitial CApitals, or the first letter of a sentence. */
export type CorrectionKind = 'typo' | 'capitals' | 'sentence';

export interface RuleSettings {
  /** Typos, "i", TWo INitial CApitals. */
  autocorrect: boolean;
  /** The first letter of a sentence. */
  capitalize: boolean;
  /** Your own corrections, keys in lower case with a straight apostrophe. */
  replacements: ReadonlyMap<string, string>;
  /** The content is English: the built-in list applies. */
  english: boolean;
  /** Words left alone, in lower case. */
  ignore: ReadonlySet<string>;
  /** Abbreviations learned while writing (lower case, without the period). */
  abbreviations: ReadonlySet<string>;
}

export interface Found {
  /** The word's place in the text given. */
  start: number;
  end: number;
  word: string;
  replacement: string;
  kind: CorrectionKind;
  /** A capital after a period: the word before that period (learned as an abbreviation when the change is taken back). */
  after?: string;
}

/**
 * The word that ends the text: letters (with apostrophes inside, as in "don't"), then what ends a
 * word: up to four spaces, punctuation marks or closing quotes and brackets. Nothing after it with
 * `trailer: false` (Enter at the end of a word).
 */
const WORD = "([\\p{L}\\p{M}]+(?:['’][\\p{L}\\p{M}]+)*)";
const ENDS = '[\\s.,;:!?…)\\]}"\'”’»]';
const WORD_THEN_END = new RegExp(`${WORD}(${ENDS}{1,4})$`, 'u');
const WORD_AT_END = new RegExp(`${WORD}$`, 'u');
/** What may stand right before a word: a space, an opening quote or bracket, a dash, an object, a line break. */
const BEFORE_WORD = /[\s(«"'“‘„¿¡—–￼]/u;
/** The end of a sentence before a word: ., ! or ?, maybe closing quotes, then a space and maybe opening ones. */
const SENTENCE_END = /([.!?]+)[)\]"'”’»]*\s+[(«"'“‘„¿¡]*$/u;
/** The start of the text block: nothing before the word but spaces and opening quotes or brackets. */
const BLOCK_START = /^[\s(«"'“‘„¿¡]*$/u;

/** The key a word is looked up by: lower case, a straight apostrophe. */
export function wordKey(word: string): string {
  return word.toLowerCase().replace(/’/g, "'");
}

/** The replacement in the case the person typed: "Teh" → "The", "TEH" → "THE", "teh" → "the". */
export function matchCase(typed: string, target: string): string {
  const letters = typed.replace(/[^\p{L}]/gu, '');
  if (letters.length > 1 && letters === letters.toUpperCase() && letters !== letters.toLowerCase())
    return target.toUpperCase();
  const first = Array.from(typed)[0] ?? '';
  if (first !== first.toLowerCase()) return capitalizeFirst(target);
  return target;
}

export function capitalizeFirst(word: string): string {
  const [first = '', ...rest] = Array.from(word);
  return first.toUpperCase() + rest.join('');
}

/** THe → The: two capitals, then lower case, and not a plural of an abbreviation (IDs, PCs). */
function twoCapitals(word: string): boolean {
  if (!/^\p{Lu}\p{Lu}\p{Ll}+$/u.test(word)) return false;
  const rest = Array.from(word).slice(2).join('');
  return rest !== 's' && rest !== 'es' && !TWO_CAPITALS_KEPT.has(word);
}

/** A word that may get a capital: it starts with a small letter and has no capitals (iPhone, eBay keep theirs). */
function canCapitalize(word: string): boolean {
  const first = Array.from(word)[0] ?? '';
  return first !== first.toUpperCase() && word === word.toLowerCase();
}

/**
 * Whether a word with `before` in front of it starts a sentence. `blockStart`: `before` starts at the
 * start of the text block. A period after an abbreviation (Dr., e.g., a single letter) doesn't end one.
 */
function sentenceStart(
  before: string,
  blockStart: boolean,
  learned: ReadonlySet<string>,
): { after?: string } | null {
  if (BLOCK_START.test(before)) return blockStart ? {} : null;
  const end = SENTENCE_END.exec(before);
  if (!end) return null;
  const marks = end[1]!;
  if (marks.includes('!') || marks.includes('?')) return {};
  // ".." or "...": a pause, not the end.
  if (marks.length > 1) return null;
  const token = /(\S*)$/u.exec(before.slice(0, end.index))![1]!.replace(/^[(«"'“‘„¿¡]+/u, '');
  if (!token || token.includes('.') || Array.from(token).length === 1) return null;
  const key = token.toLowerCase();
  if (ABBREVIATIONS.has(key) || learned.has(key)) return null;
  return { after: token };
}

/**
 * The correction for the word that ends `text` (the text block up to the cursor), or null.
 * `blockStart`: the text starts at the start of the block. `trailer`: the word is followed by what
 * ended it (a space or punctuation, just typed); without it the cursor is right after the word.
 */
export function findCorrection(
  text: string,
  settings: RuleSettings,
  { blockStart = true, trailer = true }: { blockStart?: boolean; trailer?: boolean } = {},
): Found | null {
  if (!settings.autocorrect && !settings.capitalize) return null;
  const match = (trailer ? WORD_THEN_END : WORD_AT_END).exec(text);
  if (!match) return null;
  const word = match[1]!;
  const start = match.index;
  // Part of an address, a path, a tag or a code: example.com/teh, @teh, {{teh}}, snake_teh.
  if (start > 0 && !BEFORE_WORD.test(text[start - 1]!)) return null;
  const key = wordKey(word);
  if (settings.ignore.has(key)) return null;

  let replacement = word;
  let kind: CorrectionKind | null = null;
  let after: string | undefined;
  // Capitals only: an abbreviation (ADN is DNA in Spanish and French), not a typo.
  const shouted = Array.from(word).length > 1 && word === word.toUpperCase() && word !== key;
  if (settings.autocorrect && !shouted) {
    const listed =
      settings.replacements.get(key) ?? (settings.english ? ENGLISH.get(key) : undefined);
    if (listed !== undefined) {
      const fixed = apostrophes(matchCase(word, listed), word, text);
      if (fixed !== word) {
        replacement = fixed;
        kind = 'typo';
      }
    } else if (twoCapitals(word)) {
      replacement = Array.from(word)[0]! + Array.from(word).slice(1).join('').toLowerCase();
      kind = 'capitals';
    }
  }
  if (settings.capitalize && canCapitalize(replacement)) {
    const sentence = sentenceStart(text.slice(0, start), blockStart, settings.abbreviations);
    if (sentence) {
      replacement = capitalizeFirst(replacement);
      kind ??= 'sentence';
      after = sentence.after;
    }
  }
  if (!kind || replacement === word) return null;
  return { start, end: start + word.length, word, replacement, kind, ...(after ? { after } : {}) };
}

/** A replacement's apostrophes in the style the person writes: typographic ’ if the word or the text has one. */
function apostrophes(replacement: string, word: string, text: string): string {
  if (!replacement.includes("'")) return replacement;
  const curly = word.includes('’') || (!word.includes("'") && text.includes('’'));
  return curly ? replacement.replace(/'/g, '’') : replacement;
}
