/* Content tables v3 (TW.Content). SPEC.md section 3.
 *
 * Every row is keyed by a stable lowercase id. The ids, the numbers and the rule fields come
 * from content/systems.json; the names and texts (and three number decisions: Sequined x1.4,
 * Second Look's flat rerolls, Wickwisp) come from content/content-plan.json, by id (content
 * pass of 2026-11-23). A re-theme may change the display names and texts, never the ids or
 * the numbers. `oldId` (where present) is the v2 id the row renames or replaces; the engine
 * reads it only to migrate saved data (version 1 records, and the v2 Joker ids of version 2
 * records and of runs saved before the 120-Joker table).
 *
 * Shape of the tables:
 *   HANDS, BLINDS, ENHANCEMENTS, EDITIONS, SEALS, TAROTS, PLANETS, SPECTRALS, JOKERS, BOSSES,
 *   VOUCHERS, TAGS, PACKS, DECKS and STAKES are Arrays in table order that also answer by id
 *   through non-enumerable properties:
 *     TW.Content.JOKERS.length                    // 120 (content/content-plan.json)
 *     TW.Content.JOKERS.find((j) => j.id === 'pipsqueak')
 *     TW.Content.JOKERS.pipsqueak                 // same row
 *     TW.Content.byId('JOKERS', 'pipsqueak')      // same row, or null
 *   Object.keys / Object.values / for...of only see the array entries.
 *   RANK_NAMES, RANK_WORDS, RANK_PLURALS, SUIT_NAMES, RARITIES, DEFAULTS, SHOP and ECONOMY are
 *   plain keyed objects; ANTE_TARGETS and SUIT_ORDER are plain arrays.
 *
 * Every row has at least id, name and text, so the UI can render it without rule knowledge.
 * The rules live in engine.js; the rows only carry data the engine interprets:
 *   Jokers      effects / state / events / rules / live (the Joker vocabulary, SPEC 3.4)
 *   Bosses      rule flags (boos, cap, sweep, keep, discardCost, hideRanks, maxPlay, ...)
 *   Vouchers    mods plus bonus fields summed over owned Vouchers
 *   Tarot, Planet and Spectral cards  operation fields applied in a fixed order (SPEC 3.5)
 *   Tags        operation fields; Decks and Stakes mods and start fields
 * Pure data with no browser, clock or randomness dependencies: safe to load in Node.
 */
(() => {
  const TW = (globalThis.TW = globalThis.TW || {});

  const TIMES = '×'; // multiplication sign
  const MINUS = '−'; // minus sign

  // An array in table order that also answers by id (non-enumerable, so lists stay clean).
  function table(rows) {
    const list = rows.slice();
    for (const row of list) {
      Object.defineProperty(list, row.id, { value: row, enumerable: false, configurable: true, writable: true });
    }
    return list;
  }

  // ---- 2.2 Poker hands (strongest first). lchips / lmult: added per level above 1 ----
  const HANDS = table([
    { id: 'straightflush', name: 'Straight Flush', chips: 110, mult: 8, lchips: 45, lmult: 4, text: 'Five cards in a row, all of one suit.' },
    { id: 'four', name: 'Four of a Kind', chips: 64, mult: 6, lchips: 32, lmult: 3, text: 'Four cards of one rank.' },
    { id: 'fullhouse', name: 'Full House', chips: 44, mult: 4, lchips: 27, lmult: 2, text: 'Three of a kind plus a pair.' },
    { id: 'flush', name: 'Flush', chips: 38, mult: 4, lchips: 18, lmult: 2, text: 'Five cards of one suit.' },
    { id: 'straight', name: 'Straight', chips: 34, mult: 4, lchips: 32, lmult: 3, text: 'Five cards in a row. Aces play high or low.' },
    { id: 'three', name: 'Three of a Kind', chips: 32, mult: 3, lchips: 22, lmult: 2, text: 'Three cards of one rank.' },
    { id: 'twopair', name: 'Two Pair', chips: 22, mult: 2, lchips: 22, lmult: 1, text: 'Two pairs of different ranks.' },
    { id: 'pair', name: 'Pair', chips: 12, mult: 2, lchips: 16, lmult: 1, text: 'Two cards of one rank.' },
    { id: 'high', name: 'High Card', chips: 5, mult: 1, lchips: 12, lmult: 1, text: 'Only your highest card scores.' },
  ]);

  // ---- 2.6 Blinds (three per Ante) ----
  // Texts from the plan's wording ruling (2026-11-24, final pass): "Reach ... the Ante target".
  const BLINDS = table([
    { id: 'small', kind: 'small', oldId: 'forenoon', name: 'Small Blind', text: 'Reach the Ante target. Skip it for its Tag.', mult: 1, reward: 3, skippable: true },
    { id: 'big', kind: 'big', oldId: 'afternoon', name: 'Big Blind', text: 'Reach 1.5 times the Ante target. Skip it for its Tag.', mult: 1.5, reward: 4, skippable: true },
    { id: 'boss', kind: 'boss', oldId: 'night', name: 'Boss Blind', text: "Reach twice the Ante target, under the Boss Blind's rule. Can't be skipped.", mult: 2, reward: 5, skippable: false },
  ]);

  // ---- 3.1 Enhancements (one per playing card) ----
  // chips / mult / money / xmult: when scored. anySuit: counts as every suit. heldMult: while
  // held in hand. grow: Vintage's growth per scoring pass. discardMoney: when discarded.
  const ENHANCEMENTS = table([
    { id: 'inked', oldId: 'barnacle', name: 'Waxed', text: '+35 Chips when scored.', chips: 35 },
    { id: 'punchy', oldId: 'coral', name: 'Kindled', text: '+5 Mult when scored.', mult: 5 },
    { id: 'dimestore', oldId: 'pearl', name: 'Gilt-Edged', text: '+$1 when scored.', money: 1 },
    { id: 'popout', oldId: 'seaglass', name: 'Sequined', text: `${TIMES}1.4 Mult when scored.`, xmult: 1.4 }, // the plan's number (content check)
    { id: 'scribbled', oldId: 'tarred', name: 'Masked', text: 'Counts as every suit. +10 Chips when scored.', anySuit: true, chips: 10 },
    { id: 'spotlit', oldId: 'lantern', name: 'Spotlit', text: '+3 Mult while held in hand.', heldMult: 3 },
    { id: 'vintage', name: 'Vintage', text: 'Each time it scores, it gains +4 Chips for good, then gives them (+4, +8, +12, ...).', grow: 4 },
    { id: 'crumpled', name: 'Crumpled', text: '+$1 when you discard it.', discardMoney: 1 },
  ]);

  // ---- 3.2 Editions (one per Joker or playing card) ----
  // chips / mult / xmult: the step it adds. timing: on a Joker, 'before' or 'after' that
  // Joker's own effect. slot: an Inverted Joker takes no Joker slot. rankAsMult: an Inverted
  // playing card scores its rank as Mult. odds: chance in a Shop or Joker Pack Joker roll
  // ('joker') and in a Card Pack card roll ('card'). surcharge: added to a Joker's price.
  const EDITIONS = table([
    { id: 'gloss', name: 'Sheen', text: '+40 Chips.', jokerText: '+40 Chips, just before this Joker acts.', cardText: '+40 Chips when scored.', chips: 40, timing: 'before', surcharge: 2, odds: { joker: 0.03, card: 0.04 } },
    { id: 'benday', name: 'Dither', text: '+8 Mult.', jokerText: '+8 Mult, just before this Joker acts.', cardText: '+8 Mult when scored.', mult: 8, timing: 'before', surcharge: 3, odds: { joker: 0.02, card: 0.03 } },
    { id: 'fourcolor', name: 'Glitch', text: `${TIMES}1.6 Mult.`, jokerText: `${TIMES}1.6 Mult, just after this Joker acts.`, cardText: `${TIMES}1.6 Mult when scored.`, xmult: 1.6, timing: 'after', surcharge: 4, odds: { joker: 0.005, card: 0.01 } },
    { id: 'inverted', name: 'Phantom', text: 'Joker: takes no Joker slot. Card: its rank gives Mult instead of Chips.', jokerText: 'Takes no Joker slot.', cardText: 'Its rank gives Mult instead of Chips.', slot: true, rankAsMult: true, surcharge: 4, odds: { joker: 0.005, card: 0 } },
  ]);

  // ---- 3.3 Seals (one per playing card) ----
  // retrigger: extra scoring passes (scored and held). clearMoney: cash-out money while held
  // when the Blind is beaten. discardCreates: what discarding it creates. joinsScoring: it
  // always scores when played.
  const SEALS = table([
    { id: 'encore', name: 'Encore Seal', text: 'Retriggers this card once: it scores twice, and its held-in-hand effects fire twice.', retrigger: 1 },
    { id: 'paid', name: 'Paid Seal', text: '+$2 at cash-out if this card is in your hand when you beat the Blind.', clearMoney: 2 },
    { id: 'airmail', name: 'Comet Seal', text: 'When you discard this card, create a Planet card for your most-played hand (needs a free consumable slot).', discardCreates: 'planet' },
    { id: 'cameo', name: 'Cameo Seal', text: "Always scores when played, even if it isn't part of the poker hand.", joinsScoring: true },
  ]);

  // ---- 3.6 Tarot cards (consumable kind 'tarot') ----
  // select: [min, max] selected cards from the hand. where: 'blind' (needs a hand of cards:
  // during a Blind, or in a pack that dealt one) or 'any' (Blind select, a Blind, the Shop or
  // an open pack). The other fields are the operations the engine applies (SPEC 3.5).
  const TAROTS = table([
    { id: 'inkpot', oldId: 'springtide', kind: 'tarot', name: 'The Candlemaker', text: 'Make up to 2 selected cards Waxed.', select: [1, 2], where: 'blind', enhancement: 'inked' },
    { id: 'boxingglove', oldId: 'coralbloom', kind: 'tarot', name: 'Fire-Eater', text: 'Make up to 2 selected cards Kindled.', select: [1, 2], where: 'blind', enhancement: 'punchy' },
    { id: 'pricegun', oldId: 'pearlbed', kind: 'tarot', name: 'Gold Leaf', text: 'Make 1 selected card Gilt-Edged.', select: [1, 1], where: 'blind', enhancement: 'dimestore' },
    { id: 'threedglasses', oldId: 'glassfloat', kind: 'tarot', name: 'The Seamstress', text: 'Make 1 selected card Sequined.', select: [1, 1], where: 'blind', enhancement: 'popout' },
    { id: 'crayon', oldId: 'tarpot', kind: 'tarot', name: 'Masquerade', text: 'Make up to 2 selected cards Masked.', select: [1, 2], where: 'blind', enhancement: 'scribbled' },
    { id: 'spotlight', oldId: 'lanternoil', kind: 'tarot', name: 'Spotlight', text: 'Make up to 2 selected cards Spotlit.', select: [1, 2], where: 'blind', enhancement: 'spotlit' },
    { id: 'backissues', kind: 'tarot', name: 'Heirloom', text: 'Make up to 2 selected cards Vintage.', select: [1, 2], where: 'blind', enhancement: 'vintage' },
    { id: 'scrunch', kind: 'tarot', name: 'Tinderbox', text: 'Make up to 3 selected cards Crumpled.', select: [1, 3], where: 'blind', enhancement: 'crumpled' },
    { id: 'eraser', oldId: 'undertow', kind: 'tarot', name: 'Candle Snuffer', text: 'Destroy up to 2 selected cards. Gain $1 for each.', select: [1, 2], where: 'blind', destroy: true, moneyEach: 1 },
    { id: 'ladder', oldId: 'swell', kind: 'tarot', name: 'The Ladder', text: 'Raise up to 3 selected cards one rank (Aces stay Aces).', select: [1, 3], where: 'blind', rankDelta: 1 },
    { id: 'shrinkray', kind: 'tarot', name: 'The Slide', text: 'Lower up to 3 selected cards one rank (2s stay 2s).', select: [1, 3], where: 'blind', rankDelta: -1 },
    { id: 'paintbucket', oldId: 'squall', kind: 'tarot', name: 'The Tailor', text: 'Turn 2 or 3 selected cards into the suit of the leftmost one.', select: [2, 3], where: 'blind', suitFromLeftmost: 'selected' },
    { id: 'carboncopy', oldId: 'mirrorpool', kind: 'tarot', name: 'Carbon Copy', text: 'Add a copy of 1 selected card to your deck.', select: [1, 1], where: 'blind', copies: 1 },
    { id: 'paperroute', oldId: 'bottlepost', kind: 'tarot', name: "Busker's Hat", text: 'Gain $3, plus $1 per Ante (at most $10).', select: [0, 0], where: 'any', money: 3, perAnte: 1, maxMoney: 10 },
    { id: 'gueststar', oldId: 'salvage', kind: 'tarot', name: 'Late Arrival', text: 'Create a random common Joker.', select: [0, 0], where: 'any', createJoker: 'common' },
    { id: 'overtime', oldId: 'fairwinds', kind: 'tarot', name: 'Overtime', text: '+1 hand this Blind.', select: [0, 0], where: 'blind', hands: 1 },
    { id: 'doover', oldId: 'slackwater', kind: 'tarot', name: 'Do-Over', text: '+2 discards this Blind.', select: [0, 0], where: 'blind', discards: 2 },
    { id: 'happyaccident', kind: 'tarot', name: 'Happy Accident', text: '1 in 3 chance: add Sheen, Dither or Glitch to a random Joker without an Edition.', select: [0, 0], where: 'any', chance: 1 / 3, jokerEdition: { weights: { gloss: 50, benday: 35, fourcolor: 15 } }, jokerTarget: 'randomPlain' },
    { id: 'launchpad', kind: 'tarot', name: 'Launch Pad', text: 'Create a Planet card for your most-played hand.', select: [0, 0], where: 'any', createPlanet: 'mostPlayed' },
    { id: 'reprint', kind: 'tarot', name: 'Copycat', text: 'Create a copy of another Tarot or Planet card you hold.', select: [0, 0], where: 'any', copyConsumable: ['tarot', 'planet'] },
  ]);

  // ---- 3.7 Planet cards (consumable kind 'planet'): each levels up one hand ----
  const PLANET_ROWS = [
    ['blip', 'polaris', 'Pipkin', 'high'],
    ['boing', 'castor', 'Twindle', 'pair'],
    ['zipzap', 'pointers', 'Marmalon', 'twopair'],
    ['kerplunk', 'orion', 'Cinderon', 'three'],
    ['zoom', 'plough', 'Quintara', 'straight'],
    ['swoosh', 'milkyway', 'Ochrelle', 'flush'],
    ['kaboom', 'pleiades', 'Hearthon', 'fullhouse'],
    ['thwack', 'crux', 'Tetralune', 'four'],
    ['bigbang', 'sirius', 'Regalis', 'straightflush'],
  ];
  const PLANETS = table(PLANET_ROWS.map(([id, oldId, name, hand]) => {
    const h = HANDS[hand];
    return {
      id, oldId, kind: 'planet', name, hand, levelChips: h.lchips, levelMult: h.lmult,
      text: `Level up ${h.name}. (+${h.lchips} Chips / +${h.lmult} Mult per level)`,
      select: [0, 0], where: 'any',
    };
  }));

  // ---- 3.8 Spectral cards (consumable kind 'spectral'): powerful, each with a cost ----
  const EDITION_PICK = { gloss: 50, benday: 35, fourcolor: 15 };
  const SPECTRALS = table([
    { id: 'curtaincall', kind: 'spectral', name: 'Curtain Call', text: 'Add an Encore Seal to 1 selected card. Destroy 1 random other card in your hand.', select: [1, 1], where: 'blind', seal: 'encore', destroyOthers: 1 },
    { id: 'cursedcoin', kind: 'spectral', name: 'Cursed Coin', text: 'Add a Paid Seal to up to 2 selected cards. Lose $5.', select: [1, 2], where: 'blind', seal: 'paid', moneyLoss: 5 },
    { id: 'deadletter', kind: 'spectral', name: 'Starfall', text: `Add a Comet Seal to up to 2 selected cards. ${MINUS}1 discard this Blind.`, select: [1, 2], where: 'blind', seal: 'airmail', discards: -1 },
    { id: 'apparition', kind: 'spectral', name: 'Apparition', text: `Add a Cameo Seal to up to 2 selected cards. ${MINUS}1 hand this Blind.`, select: [1, 2], where: 'blind', seal: 'cameo', hands: -1, needHands: 2 },
    { id: 'phantomink', kind: 'spectral', name: 'Foxfire', text: `Add Sheen, Dither or Glitch to 1 selected card. ${MINUS}1 hand size for the rest of this Blind.`, select: [1, 1], where: 'blind', cardEdition: { weights: EDITION_PICK }, handSize: -1 },
    { id: 'upsidedown', kind: 'spectral', name: 'Shadow Play', text: 'Make 1 selected card Phantom. Destroy 2 random other cards in your hand.', select: [1, 1], where: 'blind', cardEdition: 'inverted', destroyOthers: 2 },
    { id: 'hauntedpress', kind: 'spectral', name: 'Poltergeist', text: 'Add Glitch to your leftmost Joker without an Edition. Destroy your rightmost Joker.', select: [0, 0], where: 'any', needJokers: 2, jokerEdition: 'fourcolor', jokerTarget: 'leftmostPlain', destroyJoker: 'rightmost' },
    { id: 'midnightedition', kind: 'spectral', name: 'Witching Hour', text: `Make a random Joker without an Edition Phantom. ${MINUS}1 discard every Blind, for good.`, select: [0, 0], where: 'any', jokerEdition: 'inverted', jokerTarget: 'randomPlain', discardsForGood: -1 },
    { id: 'wormhole', kind: 'spectral', name: 'Eclipse', text: 'Level up every poker hand. Lose half your money (rounded down).', select: [0, 0], where: 'any', levelsAll: 1, loseHalfMoney: true },
    { id: 'vanishingact', kind: 'spectral', name: 'Vanishing Act', text: 'Destroy up to 4 selected cards. Gain $4 for each.', select: [1, 4], where: 'blind', destroy: true, moneyEach: 4 },
    { id: 'ghostwriter', kind: 'spectral', name: 'Ghost Writer', text: 'Destroy your leftmost Joker. Create a random rare Joker.', select: [0, 0], where: 'any', needJokers: 1, destroyJoker: 'leftmost', createJoker: 'rare', fallbackRarity: 'uncommon' },
    { id: 'doppelganger', kind: 'spectral', name: 'Doppelganger', text: 'Destroy your rightmost Joker, then copy your leftmost Joker (without its Edition).', select: [0, 0], where: 'any', needJokers: 2, destroyJoker: 'rightmost', copyJoker: 'leftmost' },
    { id: 'spellbound', kind: 'spectral', name: 'Wickwisp', text: `Every card in your hand takes the suit of 1 selected card. ${MINUS}1 hand this Blind.`, select: [1, 1], where: 'blind', suitFromSelected: 'hand', hands: -1, needHands: 2 }, // decision 'wickwisp': was -$4 and the leftmost card's suit
    { id: 'graveyardshift', kind: 'spectral', name: 'Graveyard Shift', text: 'Destroy 2 random cards in your hand. Add 2 random cards with an Enhancement and a Seal to your hand.', select: [0, 0], where: 'blind', needCards: 2, destroyRandom: 2, addCards: 2 },
    { id: 'hallofmirrors', kind: 'spectral', name: 'Hall of Mirrors', text: 'Add 3 copies of 1 selected card to your deck. Destroy 2 random other cards in your hand.', select: [1, 1], where: 'blind', copies: 3, destroyOthers: 2 },
    { id: 'originstory', kind: 'spectral', name: 'Tall Tale', text: `Create a Legendary Joker. ${MINUS}1 hand size, for good.`, select: [0, 0], where: 'any', createJoker: 'legendary', fallbackRarity: 'rare', rollEdition: true, handSizeForGood: -1 },
  ]);

  // ---- 3.4 Jokers: the 120 Jokers of content/content-plan.json, in plan order (60 common, 40
  // uncommon, 15 rare, 5 Legendary). Each row is the plan's id, oldId, name, rarity, cost, text and
  // its `engine` row in the vocabulary below (adapted where noted: Sleight of Hand and Lucky Dip
  // drop the plan's placeholder state.used, because the engine keeps the once-per-Blind and
  // once-per-Shop flags on run.blind and run.shop). 27 rows rename the v2 charms (oldId). ----
  // The Joker vocabulary (SPEC 3.4 documents every word), read by the engine:
  //   effects: [{ on, when, chips|mult|xmult|money, per, linear, of, times }]
  //     on: 'card' (each scoring pass of a scored card), 'held' (each pass of a held card),
  //         'hand' (after the cards), 'cashout' (a cash-out line), 'retrigger' (extra passes
  //         for a scored or held card: of 'scored'|'held', times n).
  //     when: conditions that must all hold (CONDITIONS in engine.js).
  //     amount: a number, or { state: key } to read the Joker's own state.
  //     per: a counter name, { count, every } or { state, every } (COUNTERS in engine.js);
  //       linear: true makes an xmult x(1 + amount x count).
  //   state: the starting state. events: { <event>: [{ when, set, add, perCard, perFace, max,
  //     eatenAt, enhanceScored, money, extraHand, gainTag, ... }] } (EVENT_OPS in engine.js).
  //   rules: passive flags (RULE_WORDS in engine.js), copy: 'random' | 'neighbours' | 'lastSold'.
  //   live: true appends "now +N Chips" (or Mult, xN, +$N) from the first effect with a state
  //     amount or a per counter; { rank: key } appends "named: <Ranks>".
  // Legendary Jokers weigh 0 (RARITIES), so the Shop and Joker Packs never roll them; only Tall
  // Tale's createJoker: 'legendary' makes one.
  const JOKERS = table([
    // Common (60)
    { id: 'jinglejester', oldId: 'anchor', name: 'Jingle Jester', rarity: 'common', cost: 4, text: '+15 Chips and +3 Mult.', effects: [{ on: 'hand', chips: 15 }, { on: 'hand', mult: 3 }] },
    { id: 'pipsqueak', oldId: 'gull', name: 'Pipsqueak', rarity: 'common', cost: 4, text: '+45 Chips if you play 2 or fewer cards.', effects: [{ on: 'hand', when: { maxPlayed: 2 }, chips: 45 }] },
    { id: 'gingerbreadfool', oldId: 'biscuit', name: 'Gingerbread Fool', rarity: 'common', cost: 4, text: '+60 Chips. Loses 15 Chips each Blind you beat; eaten at 0.', state: { chips: 60 }, effects: [{ on: 'hand', chips: { state: 'chips' } }], events: { blindCleared: [{ add: { chips: -15 }, eatenAt: { chips: 0 } }] }, live: true },
    { id: 'partyhorn', oldId: 'whistle', name: 'Party Horn', rarity: 'common', cost: 4, text: '+8 Mult on the first hand of each Blind.', effects: [{ on: 'hand', when: { firstHand: true }, mult: 8 }] },
    { id: 'papercrown', oldId: 'coralcrown', name: 'Paper Crown', rarity: 'common', cost: 4, text: 'Scored face cards give +12 Chips.', effects: [{ on: 'card', when: { face: true }, chips: 12 }] },
    { id: 'couponclipper', oldId: 'sanddollar', name: 'Coupon Clipper', rarity: 'common', cost: 4, text: 'Cash-out: +$1 for each unused discard.', effects: [{ on: 'cashout', money: 1, per: 'discardsLeft' }] },
    { id: 'emptyseats', oldId: 'raft', name: 'Empty Seats', rarity: 'common', cost: 4, text: '+2 Mult for each empty Joker slot.', effects: [{ on: 'hand', mult: 2, per: 'emptyJokerSlots' }], live: true },
    { id: 'pinwheel', oldId: 'compassrose', name: 'Pinwheel', rarity: 'common', cost: 4, text: '+3 Mult for each different suit among scored cards.', effects: [{ on: 'hand', mult: 3, per: 'scoredSuits' }] },
    { id: 'sleightofhand', oldId: 'fishhook', name: 'Sleight of Hand', rarity: 'common', cost: 4, text: 'Once per Blind, a discard of 1 or 2 cards is free.', rules: { freeSmallDiscard: 2 } }, // content check: once per Blind a discard of 1 or 2 cards is free (v2 Fishhook: the first discard)
    { id: 'doubleact', oldId: 'reefknot', name: 'Double Act', rarity: 'common', cost: 4, text: '+4 Mult for each pair of matching ranks among scored cards.', effects: [{ on: 'hand', mult: 4, per: 'scoredPairs' }] },
    { id: 'tallyowl', oldId: 'quill', name: 'Tally Owl', rarity: 'common', cost: 5, text: '+1 Mult for every 4 hands played this run.', effects: [{ on: 'hand', mult: 1, per: { count: 'handsPlayed', every: 4 } }], live: true },
    { id: 'magpie', oldId: 'netmender', name: 'Magpie', rarity: 'common', cost: 5, text: 'Gains +2 Chips for every card you discard (max +50).', state: { chips: 0 }, effects: [{ on: 'hand', chips: { state: 'chips' } }], events: { discard: [{ add: { chips: 2 }, perCard: true, max: { chips: 50 } }] }, live: true },
    { id: 'tindrum', name: 'Tin Drum', rarity: 'common', cost: 3, text: '+40 Chips.', effects: [{ on: 'hand', chips: 40 }] },
    { id: 'emberimp', name: 'Ember Imp', rarity: 'common', cost: 3, text: '+5 Mult.', effects: [{ on: 'hand', mult: 5 }] },
    { id: 'solofiddler', name: 'Solo Fiddler', rarity: 'common', cost: 4, text: '+8 Mult if the hand is a High Card.', effects: [{ on: 'hand', when: { hands: ['high'] }, mult: 8 }] },
    { id: 'matchingsocks', name: 'Matching Socks', rarity: 'common', cost: 4, text: '+25 Chips and +4 Mult if the hand is a Pair.', effects: [{ on: 'hand', when: { hands: ['pair'] }, chips: 25 }, { on: 'hand', when: { hands: ['pair'] }, mult: 4 }] },
    { id: 'squaredance', name: 'Square Dance', rarity: 'common', cost: 4, text: '+60 Chips if the hand is a Two Pair.', effects: [{ on: 'hand', when: { hands: ['twopair'] }, chips: 60 }] },
    { id: 'hattrick', name: 'Hat Trick', rarity: 'common', cost: 4, text: '+30 Chips and +6 Mult if the hand is a Three of a Kind.', effects: [{ on: 'hand', when: { hands: ['three'] }, chips: 30 }, { on: 'hand', when: { hands: ['three'] }, mult: 6 }] },
    { id: 'tightrope', name: 'Tightrope', rarity: 'common', cost: 4, text: '+70 Chips if the hand is a Straight.', effects: [{ on: 'hand', when: { hands: ['straight'] }, chips: 70 }] },
    { id: 'peacock', name: 'Peacock', rarity: 'common', cost: 4, text: '+9 Mult if the hand is a Flush.', effects: [{ on: 'hand', when: { hands: ['flush'] }, mult: 9 }] },
    { id: 'clowncar', name: 'Clown Car', rarity: 'common', cost: 4, text: '+20 Chips and +10 Mult if the hand is a Full House.', effects: [{ on: 'hand', when: { hands: ['fullhouse'] }, chips: 20 }, { on: 'hand', when: { hands: ['fullhouse'] }, mult: 10 }] },
    { id: 'quartet', name: 'Quartet', rarity: 'common', cost: 3, text: '+20 Mult if the hand is a Four of a Kind.', effects: [{ on: 'hand', when: { hands: ['four'] }, mult: 20 }] },
    { id: 'rednose', name: 'Red Nose', rarity: 'common', cost: 5, text: 'Each scored Heart or Diamond gives +2 Mult.', effects: [{ on: 'card', when: { suits: ['H', 'D'] }, mult: 2 }] },
    { id: 'blackcat', name: 'Black Cat', rarity: 'common', cost: 5, text: 'Each scored Spade or Club gives +15 Chips.', effects: [{ on: 'card', when: { suits: ['S', 'C'] }, chips: 15 }] },
    { id: 'jewelbox', name: 'Jewel Box', rarity: 'common', cost: 6, text: '+$2 if the hand has 3 or more scored Diamonds.', effects: [{ on: 'hand', when: { scoredSuitCount: { suit: 'D', min: 3 } }, money: 2 }] },
    { id: 'luckysevens', name: 'Lucky Sevens', rarity: 'common', cost: 5, text: 'Each scored 7 gives +7 Mult.', effects: [{ on: 'card', when: { rank: 7 }, mult: 7 }] },
    { id: 'anklebiters', name: 'Ankle Biters', rarity: 'common', cost: 4, text: 'Each scored 2, 3, 4 or 5 gives +12 Chips.', effects: [{ on: 'card', when: { ranks: [2, 3, 4, 5] }, chips: 12 }] },
    { id: 'jackinthebox', name: 'Jack-in-the-Box', rarity: 'common', cost: 5, text: 'Gains +0.5 Mult each time a Jack scores.', state: { mult: 0 }, effects: [{ on: 'hand', mult: { state: 'mult' } }], events: { cardScored: [{ when: { rank: 11 }, add: { mult: 0.5 } }] }, live: true },
    { id: 'tophat', name: 'Top Hat', rarity: 'common', cost: 4, text: 'Your highest card held in hand gives Chips equal to 3 times its rank (Ace 42).', effects: [{ on: 'held', when: { highestHeld: true }, chips: 3, per: 'cardRank' }] },
    { id: 'aceupthesleeve', name: 'Ace Up the Sleeve', rarity: 'common', cost: 4, text: '+10 Mult if you hold an Ace in hand.', effects: [{ on: 'hand', when: { heldRank: 14 }, mult: 10 }] },
    { id: 'portraitgallery', name: 'Portrait Gallery', rarity: 'common', cost: 5, text: 'Each face card held in hand gives +2 Mult.', effects: [{ on: 'held', when: { face: true }, mult: 2 }] },
    { id: 'peekaboo', name: 'Peek-a-Boo', rarity: 'common', cost: 4, text: '+20 Chips for each pair of matching ranks held in hand.', effects: [{ on: 'hand', chips: 20, per: 'heldPairs' }] },
    { id: 'earlybird', name: 'Early Bird', rarity: 'common', cost: 4, text: 'Cash-out: +$1 for each hand left.', effects: [{ on: 'cashout', money: 1, per: 'handsLeft' }] },
    { id: 'prizerosette', name: 'Prize Rosette', rarity: 'common', cost: 4, text: 'Cash-out: +$3 after a Boss Blind.', effects: [{ on: 'cashout', when: { bossBlind: true }, money: 3 }] },
    { id: 'doorman', name: 'Doorman', rarity: 'common', cost: 3, text: 'Earn $1 when a Blind starts.', events: { blindStart: [{ money: 1 }] } },
    { id: 'spinningtop', name: 'Spinning Top', rarity: 'common', cost: 4, text: 'Rerolls in the Shop cost $1 less.', rules: { rerollDiscount: 1 } },
    { id: 'brassabacus', name: 'Brass Abacus', rarity: 'common', cost: 3, text: 'Interest is $1 for every $4 you have, not every $5.', rules: { interestStep: 4 } },
    { id: 'lastlaugh', name: 'Last Laugh', rarity: 'common', cost: 4, text: 'Sell this during a Blind: +1 hand this Blind.', events: { sold: [{ extraHand: 1 }] } },
    { id: 'dartboard', name: 'Dartboard', rarity: 'common', cost: 4, text: 'Cash-out: +$3 if you beat the Blind with your first hand.', effects: [{ on: 'cashout', when: { clearedOnFirstHand: true }, money: 3 }] },
    { id: 'accordion', name: 'Accordion', rarity: 'common', cost: 5, text: 'Gains +3 Chips each time you play exactly 5 cards.', state: { chips: 0 }, effects: [{ on: 'hand', chips: { state: 'chips' } }], events: { handScored: [{ when: { minPlayed: 5 }, add: { chips: 3 } }] }, live: true },
    { id: 'packrat', name: 'Pack Rat', rarity: 'common', cost: 5, text: 'Gains +1 Mult each time you open a Booster Pack.', state: { mult: 0 }, effects: [{ on: 'hand', mult: { state: 'mult' } }], events: { packOpened: [{ add: { mult: 1 } }] }, live: true },
    { id: 'pawnbroker', name: 'Pawnbroker', rarity: 'common', cost: 5, text: 'Gains +2 Mult each time you sell another Joker.', state: { mult: 0 }, effects: [{ on: 'hand', mult: { state: 'mult' } }], events: { jokerSold: [{ add: { mult: 2 } }] }, live: true },
    { id: 'tealeaves', name: 'Tea Leaves', rarity: 'common', cost: 4, text: 'Gains +6 Chips each time you use a Tarot card.', state: { chips: 0 }, effects: [{ on: 'hand', chips: { state: 'chips' } }], events: { consumableUsed: [{ when: { kind: 'tarot' }, add: { chips: 6 } }] }, live: true },
    { id: 'stargazer', name: 'Stargazer', rarity: 'common', cost: 5, text: 'Gains +1 Mult for every 2 Planet cards you use.', state: { planets: 0 }, effects: [{ on: 'hand', mult: 1, per: { state: 'planets', every: 2 } }], events: { consumableUsed: [{ when: { kind: 'planet' }, add: { planets: 1 } }] }, live: true },
    { id: 'drippingcandle', name: 'Dripping Candle', rarity: 'common', cost: 4, text: '+15 Mult. Loses 1 Mult each hand you play; melts at 0.', state: { mult: 15 }, effects: [{ on: 'hand', mult: { state: 'mult' } }], events: { afterHand: [{ add: { mult: -1 }, eatenAt: { mult: 0 } }] }, live: true },
    { id: 'merrygoround', name: 'Merry-Go-Round', rarity: 'common', cost: 5, text: 'Straights can wrap around the Ace (Q-K-A-2-3).', rules: { wrapStraights: true } },
    { id: 'courtace', name: 'Court Ace', rarity: 'common', cost: 4, text: 'Aces count as face cards.', rules: { acesAreFaces: true } },
    { id: 'highfive', name: 'High Five', rarity: 'common', cost: 4, text: '+5 Mult if you play exactly 5 cards.', effects: [{ on: 'hand', when: { minPlayed: 5 }, mult: 5 }] },
    { id: 'understudy', name: 'Understudy', rarity: 'common', cost: 4, text: "+3 Mult for each played card that doesn't score.", effects: [{ on: 'hand', mult: 3, per: 'unscoredCards' }] },
    { id: 'jesterparade', name: 'Jester Parade', rarity: 'common', cost: 4, text: '+12 Chips for each other common Joker you have.', effects: [{ on: 'hand', chips: 12, per: 'otherCommonJokers' }], live: true },
    { id: 'fancydress', name: 'Fancy Dress', rarity: 'common', cost: 4, text: 'Each scored card with an Enhancement gives +2 Mult.', effects: [{ on: 'card', when: { enhanced: true }, mult: 2 }] },
    { id: 'signetring', name: 'Signet Ring', rarity: 'common', cost: 4, text: '+10 Chips for each card with a Seal in your full deck.', effects: [{ on: 'hand', chips: 10, per: 'sealedCards' }], live: true },
    { id: 'bravobouquet', name: 'Bravo Bouquet', rarity: 'common', cost: 4, text: 'Scored cards with an Encore Seal give +20 Chips.', effects: [{ on: 'card', when: { seal: 'encore' }, chips: 20 }] },
    { id: 'grandfinale', name: 'Grand Finale', rarity: 'common', cost: 4, text: '+60 Chips on the last hand of each Blind.', effects: [{ on: 'hand', when: { lastHand: true }, chips: 60 }] },
    { id: 'hotcocoa', name: 'Hot Cocoa', rarity: 'common', cost: 3, text: 'Gain a Second Wind Tag each time you beat a Boss Blind.', events: { blindCleared: [{ when: { bossBlind: true }, gainTag: 'secondwind' }] } },
    { id: 'nightwatchman', name: 'Night Watchman', rarity: 'common', cost: 4, text: '+12 Mult during Boss Blinds.', effects: [{ on: 'hand', when: { bossBlind: true }, mult: 12 }] },
    { id: 'seesaw', name: 'Seesaw', rarity: 'common', cost: 4, text: '+10 Mult on every second hand of a Blind.', effects: [{ on: 'hand', when: { evenHand: true }, mult: 10 }] },
    { id: 'pennilesspoet', name: 'Penniless Poet', rarity: 'common', cost: 4, text: '+9 Mult if you have $5 or less.', effects: [{ on: 'hand', when: { maxMoney: 5 }, mult: 9 }] },
    { id: 'orrery', name: 'Orrery', rarity: 'common', cost: 5, text: '+2 Mult for each level the played hand has above 1.', effects: [{ on: 'hand', mult: 2, per: 'levelsAbove1' }] },
    { id: 'patchworkdoll', name: 'Patchwork Doll', rarity: 'common', cost: 4, text: 'Gains +4 Chips each time a playing card is added to your deck.', state: { chips: 0 }, effects: [{ on: 'hand', chips: { state: 'chips' } }], events: { cardAdded: [{ add: { chips: 4 }, perCard: true }] }, live: true },
    // Uncommon (40)
    { id: 'sableknave', oldId: 'kraken', name: 'Sable Knave', rarity: 'uncommon', cost: 6, text: `Each scored Spade gives ${TIMES}1.1 Mult.`, effects: [{ on: 'card', when: { suit: 'S' }, xmult: 1.1 }] },
    { id: 'redhanded', oldId: 'lobsterpot', name: 'Red-Handed', rarity: 'uncommon', cost: 6, text: 'Each Heart or Diamond held in hand gives +2 Mult.', effects: [{ on: 'held', when: { suits: ['H', 'D'] }, mult: 2 }] },
    { id: 'congaline', oldId: 'lighthouse', name: 'Conga Line', rarity: 'uncommon', cost: 6, text: `${TIMES}1.5 Mult if the hand is a Straight or Straight Flush.`, effects: [{ on: 'hand', when: { hands: ['straight', 'straightflush'] }, xmult: 1.5 }] },
    { id: 'moneybags', oldId: 'stormpetrel', name: 'Moneybags', rarity: 'uncommon', cost: 6, text: '+1 Mult for every $4 you have.', effects: [{ on: 'hand', mult: 1, per: { count: 'money', every: 4 } }], live: true },
    { id: 'openingact', oldId: 'figurehead', name: 'Opening Act', rarity: 'uncommon', cost: 6, text: 'The first scored card gives +20 Chips and +2 Mult.', effects: [{ on: 'card', when: { first: true }, chips: 20 }, { on: 'card', when: { first: true }, mult: 2 }] },
    { id: 'finalbow', oldId: 'crosscurrent', name: 'Final Bow', rarity: 'uncommon', cost: 7, text: `The last scored card gives ${TIMES}1.5 Mult.`, effects: [{ on: 'card', when: { last: true }, xmult: 1.5 }] },
    { id: 'chimneysweep', oldId: 'bilgerat', name: 'Chimney Sweep', rarity: 'uncommon', cost: 6, text: '+1 Mult for every 2 cards discarded this Blind.', effects: [{ on: 'hand', mult: 1, per: { count: 'cardsDiscarded', every: 2 } }], live: true },
    { id: 'goldtooth', oldId: 'goldtooth', name: 'Gold Tooth', rarity: 'uncommon', cost: 6, text: 'Scored Aces give +$1.', effects: [{ on: 'card', when: { rank: 14 }, money: 1 }] },
    { id: 'oldstager', oldId: 'soundingline', name: 'Old Stager', rarity: 'uncommon', cost: 6, text: 'Each scored card gives +2 Chips per Ante.', effects: [{ on: 'card', chips: 2, per: 'ante' }], live: true }, // live text added (v2 Sounding Line had none)
    { id: 'paperclip', oldId: 'kelpforest', name: 'The Paperclip', rarity: 'uncommon', cost: 6, text: 'Each card held in hand gives +5 Chips.', effects: [{ on: 'held', chips: 5 }] },
    { id: 'lamplighter', oldId: 'mermaidcomb', name: 'Lamplighter', rarity: 'uncommon', cost: 7, text: 'Scored Hearts with no Enhancement become Kindled after the hand.', events: { afterHand: [{ enhanceScored: { suit: 'H', to: 'punchy', onlyPlain: true } }] } },
    { id: 'fandancer', name: 'Fan Dancer', rarity: 'uncommon', cost: 7, text: 'Flushes can be made with 4 cards.', rules: { fourCardFlush: true } },
    { id: 'maypole', name: 'Maypole', rarity: 'uncommon', cost: 7, text: 'Retrigger each scored card that has a Seal.', effects: [{ on: 'retrigger', when: { seal: 'any' } }] },
    { id: 'callandresponse', name: 'Call and Response', rarity: 'uncommon', cost: 6, text: 'Retrigger each scored card whose rank you also hold in hand.', effects: [{ on: 'retrigger', when: { heldSameRank: true } }] },
    { id: 'bookends', name: 'Bookends', rarity: 'uncommon', cost: 6, text: 'Retrigger the first and last scored cards.', effects: [{ on: 'retrigger', when: { firstOrLast: true } }] },
    { id: 'onemanband', name: 'One-Man Band', rarity: 'uncommon', cost: 7, text: 'If you play exactly 1 card, it retriggers 3 times.', effects: [{ on: 'retrigger', when: { maxPlayed: 1 }, times: 3 }] },
    { id: 'colourguard', name: 'Colour Guard', rarity: 'uncommon', cost: 6, text: `${TIMES}1.5 Mult if the scored cards are all red or all black.`, effects: [{ on: 'hand', when: { oneColour: true }, xmult: 1.5 }] },
    { id: 'threesacrowd', name: "Three's a Crowd", rarity: 'uncommon', cost: 6, text: `${TIMES}1.75 Mult if you play exactly 3 cards.`, effects: [{ on: 'hand', when: { minPlayed: 3, maxPlayed: 3 }, xmult: 1.75 }] },
    { id: 'twoscompany', name: "Two's Company", rarity: 'uncommon', cost: 6, text: `${TIMES}2 Mult if the hand is a Two Pair.`, effects: [{ on: 'hand', when: { hands: ['twopair'] }, xmult: 2 }] },
    { id: 'pocketlint', name: 'Pocket Lint', rarity: 'uncommon', cost: 6, text: `${TIMES}1.5 Mult while your consumable slots are empty.`, effects: [{ on: 'hand', when: { noConsumables: true }, xmult: 1.5 }] },
    { id: 'signaturemove', name: 'Signature Move', rarity: 'uncommon', cost: 7, text: `${TIMES}1.5 Mult if the hand is your most-played poker hand.`, effects: [{ on: 'hand', when: { mostPlayed: true }, xmult: 1.5 }] },
    { id: 'headsortails', name: 'Heads or Tails', rarity: 'uncommon', cost: 6, text: `${TIMES}2 Mult on Heads. The coin flips after every hand.`, state: { side: 'heads' }, effects: [{ on: 'hand', when: { stateIs: { side: 'heads' } }, xmult: 2 }], events: { afterHand: [{ set: { side: 'coinFlip' } }] } },
    { id: 'velvetrope', name: 'Velvet Rope', rarity: 'uncommon', cost: 6, text: `${TIMES}1.25 Mult for each Joker you have with an Edition.`, effects: [{ on: 'hand', xmult: 1.25, per: 'editionJokers' }], live: true },
    { id: 'shoeshine', name: 'Shoeshine', rarity: 'uncommon', cost: 6, text: 'After each Boss Blind, 2 random cards in your deck gain a random Edition.', events: { blindCleared: [{ when: { bossBlind: true }, editionDeckCards: { count: 2, weights: { gloss: 50, benday: 35, fourcolor: 15 } } }] } },
    { id: 'thimble', name: 'Thimble', rarity: 'uncommon', cost: 7, text: 'When a Blind starts, a random card in your hand gains a random Seal.', events: { blindStart: [{ sealHandCard: 1 }] } },
    { id: 'moonstruck', name: 'Moonstruck', rarity: 'uncommon', cost: 7, text: "When a Boss Blind starts, create your most-played hand's Planet card (needs a free slot).", events: { blindStart: [{ when: { bossBlind: true }, createPlanet: 'mostPlayed' }] } },
    { id: 'palmreader', name: 'Palm Reader', rarity: 'uncommon', cost: 6, text: 'Discard exactly 2 cards of the same rank: create a Tarot card (needs a free slot).', events: { discard: [{ when: { pairDiscard: true }, createTarot: 1 }] } },
    { id: 'crystalgazer', name: 'Crystal Gazer', rarity: 'uncommon', cost: 6, text: 'Gain $2 each time you use a Tarot card.', events: { consumableUsed: [{ when: { kind: 'tarot' }, money: 2 }] } },
    { id: 'paymaster', name: 'Paymaster', rarity: 'uncommon', cost: 6, text: 'Cash-out: +$1 for each other Joker you have.', effects: [{ on: 'cashout', money: 1, per: 'otherJokers' }], live: true },
    { id: 'facevalue', name: 'Face Value', rarity: 'uncommon', cost: 6, text: 'Gain $1 for each face card you discard.', events: { discard: [{ money: 1, perFace: true }] } },
    { id: 'carpetbag', name: 'Carpetbag', rarity: 'uncommon', cost: 7, text: 'Each discard gives +1 hand size for the rest of the Blind (up to +3).', events: { discard: [{ handSizeThisBlind: { add: 1, max: 3 } }] } },
    { id: 'helpinghand', name: 'Helping Hand', rarity: 'uncommon', cost: 5, text: 'Tarot cards that use selected cards can take 1 more.', rules: { tarotSelectPlus: 1 } },
    { id: 'nestingdolls', name: 'Nesting Dolls', rarity: 'uncommon', cost: 5, text: 'Jokers that need a poker hand also accept bigger hands that contain it.', rules: { handsContain: true } },
    { id: 'makeover', name: 'Makeover', rarity: 'uncommon', cost: 6, text: 'Cards added to your deck get a random Enhancement if they have none.', events: { cardAdded: [{ enhanceAdded: 'random' }] } },
    { id: 'luckydip', name: 'Lucky Dip', rarity: 'uncommon', cost: 7, text: 'The first Booster Pack you buy in each Shop lets you pick 1 more card.', rules: { firstPackExtraPick: 1 } },
    { id: 'bigspender', name: 'Big Spender', rarity: 'uncommon', cost: 6, text: 'Gains +0.5 Mult for each thing you buy in the Shop.', state: { mult: 0 }, effects: [{ on: 'hand', mult: { state: 'mult' } }], events: { purchase: [{ add: { mult: 0.5 } }] }, live: true },
    { id: 'nailbiter', name: 'Nail-Biter', rarity: 'uncommon', cost: 6, text: 'Gains +4 Mult each time you beat a Blind with your last hand.', state: { mult: 0 }, effects: [{ on: 'hand', mult: { state: 'mult' } }], events: { blindCleared: [{ when: { clearedOnLastHand: true }, add: { mult: 4 } }] }, live: true },
    { id: 'smoothtalker', name: 'Smooth Talker', rarity: 'uncommon', cost: 8, text: 'Boss Blind targets are 20% lower.', rules: { bossTargetMult: 0.8 } },
    { id: 'coronation', name: 'Coronation', rarity: 'uncommon', cost: 5, text: 'After each hand, scored Jacks become Queens and scored Queens become Kings.', events: { afterHand: [{ rankUpScored: { 11: 12, 12: 13 } }] } },
    { id: 'usher', name: 'Usher', rarity: 'uncommon', cost: 5, text: 'Vouchers are half price (rounded up).', rules: { voucherPriceMult: 0.5 } },
    // Rare (15)
    { id: 'bigtop', oldId: 'leviathan', name: 'Big Top', rarity: 'rare', cost: 8, text: `${TIMES}2.5 Mult if the hand is a Full House, Four of a Kind or Straight Flush.`, effects: [{ on: 'hand', when: { hands: ['fullhouse', 'four', 'straightflush'] }, xmult: 2.5 }] },
    { id: 'pokerface', oldId: 'ghostship', name: 'Poker Face', rarity: 'rare', cost: 8, text: `Gains ${TIMES}0.25 Mult each time you beat a Blind without discarding. Starts at ${TIMES}1.`, state: { x: 1 }, effects: [{ on: 'hand', xmult: { state: 'x' } }], events: { blindCleared: [{ when: { noDiscards: true }, add: { x: 0.25 } }] }, live: true },
    { id: 'dragontamer', oldId: 'seaserpent', name: 'Dragon Tamer', rarity: 'rare', cost: 9, text: `Gains ${TIMES}0.5 Mult each time you beat a Boss Blind. Starts at ${TIMES}1.`, state: { x: 1 }, effects: [{ on: 'hand', xmult: { state: 'x' } }], events: { blindCleared: [{ when: { bossBlind: true }, add: { x: 0.5 } }] }, live: true },
    { id: 'fortunecookie', oldId: 'treasuremap', name: 'Fortune Cookie', rarity: 'rare', cost: 8, text: 'Each Blind names a rank. Scored cards of that rank give +$2.', state: { rank: 2 }, effects: [{ on: 'card', when: { stateRank: 'rank' }, money: 2 }], events: { gained: [{ set: { rank: 'randomRank' } }], blindStart: [{ set: { rank: 'randomRank' } }] }, live: { rank: 'rank' } },
    { id: 'standin', name: 'Stand-In', rarity: 'rare', cost: 9, text: 'Copies a random other Joker. Picks a new one when each Blind starts.', state: { target: null }, rules: { copy: 'random' } },
    { id: 'oldflame', name: 'Old Flame', rarity: 'rare', cost: 8, text: 'Takes on the ability of the last Joker you sold.', state: { copy: null }, rules: { copy: 'lastSold' } },
    { id: 'jackofalltrades', name: 'Jack of All Trades', rarity: 'rare', cost: 8, text: 'Jacks count as any rank you need for a poker hand.', rules: { wildJacks: true } },
    { id: 'nightmoth', name: 'Night Moth', rarity: 'rare', cost: 7, text: 'After each Boss Blind, create a Spectral card (needs a free slot).', events: { blindCleared: [{ when: { bossBlind: true }, createSpectral: 1 }] } },
    { id: 'ticketcollector', name: 'Ticket Collector', rarity: 'rare', cost: 8, text: `${TIMES}1 Mult, plus ${TIMES}0.25 for each Voucher you own.`, effects: [{ on: 'hand', xmult: 0.25, per: 'vouchers', linear: true }], live: true },
    { id: 'reprise', name: 'Reprise', rarity: 'rare', cost: 9, text: 'Retrigger each scored card that has an Enhancement.', effects: [{ on: 'retrigger', when: { enhanced: true } }] },
    { id: 'kaleidoscope', name: 'Kaleidoscope', rarity: 'rare', cost: 8, text: 'Editions on your cards and Jokers trigger twice.', rules: { editionsTwice: true } },
    { id: 'galanight', name: 'Gala Night', rarity: 'rare', cost: 8, text: `${TIMES}2 Mult if every scored card has an Enhancement.`, effects: [{ on: 'hand', when: { allEnhanced: true }, xmult: 2 }] },
    { id: 'brazier', name: 'Brazier', rarity: 'rare', cost: 7, text: `Gains ${TIMES}0.2 Mult each time a playing card is destroyed. Starts at ${TIMES}1.`, state: { x: 1 }, effects: [{ on: 'hand', xmult: { state: 'x' } }], events: { cardDestroyed: [{ add: { x: 0.2 }, perCard: true }] }, live: true },
    { id: 'goldenhour', name: 'Golden Hour', rarity: 'rare', cost: 8, text: 'Money from cards and Jokers during a Blind is doubled.', rules: { blindMoneyX: 2 } },
    { id: 'blackjack', name: 'Blackjack', rarity: 'rare', cost: 7, text: `${TIMES}3 Mult if the scored cards add up to exactly 21 (Aces 1 or 11, faces 10).`, effects: [{ on: 'hand', when: { sum21: true }, xmult: 3 }] },
    // Legendary: only Tall Tale (originstory) creates them; never in the Shop or a Joker Pack (5)
    { id: 'candleking', name: 'The Candle King', rarity: 'legendary', cost: 20, text: `Every scored card gives ${TIMES}1.25 Mult.`, effects: [{ on: 'card', xmult: 1.25 }] },
    { id: 'madameecho', name: 'Madame Echo', rarity: 'legendary', cost: 20, text: 'Retrigger every scored card.', effects: [{ on: 'retrigger' }] },
    { id: 'puppetmaster', name: 'The Puppet Master', rarity: 'legendary', cost: 20, text: 'Copies the Jokers on both sides of it.', rules: { copy: 'neighbours' } },
    { id: 'sirmotley', name: 'Sir Motley', rarity: 'legendary', cost: 20, text: 'Every card counts as every suit.', rules: { everySuit: true } },
    { id: 'ringmaster', name: 'The Ringmaster', rarity: 'legendary', cost: 20, text: `${TIMES}1.3 Mult for each other Joker you have.`, effects: [{ on: 'hand', xmult: 1.3, per: 'otherJokers' }], live: true },
  ]);

  // ---- 3.9 Boss Blinds ----
  // fromAnte: the first Ante it can appear on. finale: only ever Ante 8's Boss Blind.
  // Rule flags (read by the engine): boos (the highest-ranked scoring card scores nothing),
  // cap (Mult cap), sweep (whole hand back and redrawn after every hand), keep (score kept
  // before each later hand), discardCost, hideRanks, maxPlay, noEnhancements, wetLeftmost,
  // mostPlayedX (Mult factor on the marked hand), noEditionsSeals, firstHandX (Mult factor
  // on the first hand), extraDiscard, handsDelta, targetMult.
  // capPerAnte (added 2026-11-23, balance): the cap rises by this much for each Ante after fromAnte.
  // toAnte (added 2026-11-23, balance; no row uses it): the last Ante the Boss Blind can be rolled at.
  const BOSSES = table([
    { id: 'heckler', oldId: 'siren', name: 'The Heckler', text: 'The highest-ranked scored card in each hand is booed off: it scores nothing.', fromAnte: 1, boos: true },
    { id: 'lid', oldId: 'reef', name: 'The Lid', text: "Mult can't go above 12, plus 6 for each Ante after Ante 3.", fromAnte: 3, cap: 12, capPerAnte: 6 },
    { id: 'shuffler', oldId: 'whirlpool', name: 'The Shuffler', text: 'After every hand, your whole hand is shuffled back into the deck and redrawn.', fromAnte: 1, sweep: true },
    { id: 'fade', oldId: 'ebb', name: 'The Fade', text: 'Before each hand after the first, your score so far drops by 15%.', fromAnte: 2, keep: 0.85 },
    { id: 'tollbooth', oldId: 'tithe', name: 'The Tollbooth', text: 'Each discard costs $2.', fromAnte: 1, discardCost: 2 },
    { id: 'smudge', oldId: 'fog', name: 'The Smudge', text: 'Card ranks are hidden until you select them.', fromAnte: 1, hideRanks: true },
    { id: 'squeeze', oldId: 'doldrums', name: 'The Squeeze', text: 'You can play at most 4 cards per hand.', fromAnte: 2, maxPlay: 4 },
    { id: 'washout', oldId: 'brine', name: 'The Wash-Out', text: 'Enhancements do nothing.', fromAnte: 2, noEnhancements: true },
    { id: 'wetblanket', oldId: 'ghostlight', name: 'The Wet Blanket', text: 'Your leftmost Joker does nothing.', fromAnte: 2, wetLeftmost: true },
    { id: 'grudge', oldId: 'trench', name: 'The Spoilsport', text: 'Your most-played hand scores half Mult.', fromAnte: 2, mostPlayedX: 0.5 },
    { id: 'censor', name: 'The Blackout', text: 'Editions and Seals do nothing.', fromAnte: 3, noEditionsSeals: true },
    { id: 'warmup', name: 'The Warm-Up', text: 'Your first hand scores half.', fromAnte: 1, firstHandX: 0.5 },
    { id: 'fumble', name: 'The Fumble', text: "Each discard also drops 1 random card you didn't select.", fromAnte: 1, extraDiscard: 1 },
    { id: 'shortfuse', name: 'The Short Fuse', text: 'You get 2 fewer hands, but the target is 25% lower.', fromAnte: 2, handsDelta: -2, targetMult: 0.75 },
    { id: 'bigfinish', oldId: 'maelstrom', name: 'The Big Finish', text: `Target ${TIMES}1.5. After every hand, your whole hand is shuffled back and redrawn.`, fromAnte: 8, finale: true, targetMult: 1.5, sweep: true },
  ]);

  // ---- 3.10 Vouchers ($10 each, one on offer per Ante) ----
  // mods: run fields raised at once. The other fields are summed (or multiplied, for
  // editionOdds) over every owned Voucher by the engine.
  const VOUCHERS = table([
    { id: 'musclecourse', oldId: 'hammock', name: 'Long Sleeves', text: '+1 hand size. Boss Blinds: +1 more.', price: 10, mods: { handSize: 1 }, bossHandSize: 1 },
    { id: 'speedcourse', oldId: 'mast', name: 'Midnight Oil', text: '+1 hand every Blind. Boss Blinds: +1 more.', price: 10, mods: { hands: 1 }, bossHands: 1 },
    { id: 'springcleaning', oldId: 'pump', name: 'Spring Cleaning', text: '+2 discards every Blind.', price: 10, mods: { discards: 2 } },
    { id: 'extrapanel', oldId: 'hold', name: 'Pull Up a Chair', text: '+1 Joker slot.', price: 10, mods: { jokerSlots: 1 } },
    { id: 'skyatlas', oldId: 'charttable', name: 'Sky Atlas', text: 'Planet cards give 2 levels.', price: 10, planetLevels: 2 },
    { id: 'savingsbond', oldId: 'strongbox', name: 'Savings Bond', text: 'Interest cap +$3.', price: 10, interestCap: 3 },
    { id: 'spinnerrack', oldId: 'spyglass', name: 'Night Market', text: '+1 card slot and +1 Booster Pack slot in the Shop.', price: 10, cardSlots: 1, packSlots: 1 },
    { id: 'secondlook', oldId: 'shipscat', name: 'Second Look', text: "Rerolls in the Shop don't go up in price.", price: 10, flatRerolls: true }, // the plan's rule (content check)
    { id: 'slickpaper', oldId: 'tideclock', name: 'Shimmer Dust', text: `Jokers and cards in the Shop and in packs are 3${TIMES} as likely to have an Edition.`, price: 10, editionOdds: 3 },
    { id: 'stampalbum', name: 'Ribbon Box', text: 'Card Pack cards get a Seal 40% of the time (normally 10%).', price: 10, sealOdds: 0.4 },
    { id: 'mailorderghost', name: 'Haunted Stall', text: 'Spectral cards can appear in the Shop.', price: 10, spectralInShop: true },
    { id: 'bonuspages', name: "Baker's Dozen", text: 'Every Booster Pack shows 1 more card.', price: 10, packShown: 1 },
    { id: 'dollaroff', name: 'Season Pass', text: 'Everything in the Shop costs $1 less (minimum $1).', price: 10, priceOff: 1 },
  ]);

  // ---- 3.11 Tags (the reward for skipping a Small or Big Blind) ----
  // fromAnte: the first Ante a Tag can be rolled on. Operation fields: money, joker (+
  // fallbackMoney), tarots, levels, hands, targetMult, discount (+ freeRerolls: the Sale Tag),
  // jokerEdition (+ fallbackMoney), seals, pack (opened at once).
  const TAGS = table([
    { id: 'piggybank', oldId: 'bottle', name: 'Piggy Bank Tag', text: 'Gain $6.', fromAnte: 1, money: 6 },
    { id: 'buddy', oldId: 'salvage', name: 'Buddy Tag', text: 'Gain a random common Joker (or $4 if your Joker slots are full).', fromAnte: 1, joker: 'common', fallbackMoney: 4 },
    { id: 'tarot', oldId: 'tidepool', name: 'Tarot Tag', text: 'Gain 2 random Tarot cards (as many as fit).', fromAnte: 1, tarots: 2 },
    { id: 'fanfavorite', oldId: 'clearskies', name: 'Crowd Pleaser Tag', text: 'Your most-played hand gains a level.', fromAnte: 1, levels: 1 },
    { id: 'secondwind', oldId: 'followingwind', name: 'Second Wind Tag', text: '+1 hand in your next Blind.', fromAnte: 1, hands: 1 },
    { id: 'headstart', oldId: 'calmwaters', name: 'Head Start Tag', text: "Your next Blind's target is 25% lower.", fromAnte: 1, targetMult: 0.75 },
    { id: 'sale', oldId: 'merchant', name: 'Sale Tag', text: 'Next Shop: Jokers 25% off and your first reroll is free.', fromAnte: 1, discount: 0.25, freeRerolls: 1 },
    { id: 'grabbag', oldId: 'floatingcrate', name: 'Grab Bag Tag', text: 'Open a free Jumbo Card Pack now.', fromAnte: 1, pack: 'cardjumbo' },
    { id: 'collector', name: 'Glimmer Tag', text: 'Add Sheen, Dither or Glitch to a random Joker without an Edition (or gain $4).', fromAnte: 1, jokerEdition: { weights: EDITION_PICK }, fallbackMoney: 4 },
    { id: 'ghost', name: 'Ghost Tag', text: 'Open a free Jumbo Ghost Pack now.', fromAnte: 2, pack: 'ghostjumbo' },
    { id: 'stamp', name: 'Ribbon Tag', text: 'Add a random Seal to 2 random cards in your deck that have none.', fromAnte: 1, seals: 2 },
    { id: 'sky', name: 'Sky Tag', text: 'Open a free Jumbo Planet Pack now.', fromAnte: 1, pack: 'planetjumbo' },
  ]);

  // ---- 3.12 Booster Packs: 5 kinds x 3 sizes ----
  // shown: cards shown; picks: how many you may take; dealsHand: a hand of cards is dealt
  // from the deck while the pack is open, for the Tarot and Spectral picks to act on.
  const PACK_KINDS = {
    card: { name: 'Card Pack', what: 'playing cards', dealsHand: false },
    tarot: { name: 'Tarot Pack', what: 'Tarot cards', dealsHand: true, atOnce: true },
    planet: { name: 'Planet Pack', what: 'Planet cards', dealsHand: false, atOnce: true },
    joker: { name: 'Joker Pack', what: 'Jokers', dealsHand: false },
    ghost: { name: 'Ghost Pack', what: 'Spectral cards', dealsHand: true, atOnce: true },
  };
  const PACK_ROWS = [
    // id, oldId, kind, size, shown, picks, price, fromAnte
    ['cardnormal', 'deck', 'card', 'normal', 4, 1, 4, 1],
    ['cardjumbo', null, 'card', 'jumbo', 6, 1, 6, 1],
    ['cardmega', null, 'card', 'mega', 6, 2, 9, 1],
    ['tarotnormal', 'tide', 'tarot', 'normal', 4, 1, 4, 1],
    ['tarotjumbo', null, 'tarot', 'jumbo', 6, 1, 6, 1],
    ['tarotmega', null, 'tarot', 'mega', 6, 2, 9, 1],
    ['planetnormal', 'star', 'planet', 'normal', 4, 1, 4, 1],
    ['planetjumbo', null, 'planet', 'jumbo', 6, 1, 6, 1],
    ['planetmega', null, 'planet', 'mega', 6, 2, 9, 1],
    ['jokernormal', 'charm', 'joker', 'normal', 2, 1, 6, 1],
    ['jokerjumbo', null, 'joker', 'jumbo', 3, 1, 8, 1],
    ['jokermega', null, 'joker', 'mega', 4, 2, 10, 1],
    ['ghostnormal', null, 'ghost', 'normal', 2, 1, 5, 2],
    ['ghostjumbo', null, 'ghost', 'jumbo', 3, 1, 7, 2],
    ['ghostmega', null, 'ghost', 'mega', 4, 2, 10, 2],
  ];
  const SIZE_PREFIX = { normal: '', jumbo: 'Jumbo ', mega: 'Mega ' };
  const PACKS = table(PACK_ROWS.map(([id, oldId, kind, size, shown, picks, price, fromAnte]) => {
    const k = PACK_KINDS[kind];
    const lead = kind === 'card' && size === 'normal' ? `Pick 1 of ${shown} playing cards to add to your deck.` : `Pick ${picks} of ${shown} ${k.what}`;
    const atOnce = k.dealsHand ? ' to use at once on a hand dealt from your deck.' : ' to use at once.';
    const text = lead.endsWith('.') ? lead : `${lead}${k.atOnce ? atOnce : '.'}`;
    const row = { id, kind, size, name: `${SIZE_PREFIX[size]}${k.name}`, text, shown, picks, price, fromAnte, dealsHand: k.dealsHand };
    if (oldId) row.oldId = oldId;
    return row;
  }));

  // ---- 3.13 Decks ----
  // mods: added to the defaults. unlockedBy: { type:'start' } | { type:'ante', ante } |
  // { type:'win', stakes? }. Other fields: money, tarotPriceDelta, startEnhancement {id,count},
  // startConsumables, startSeals, startJoker {rarity, edition}, editionOdds (Jokers in the Shop
  // and in Joker Packs), spectralInShop, ghostPackWeight, sellFull (Jokers sell for their full
  // cost instead of half), rewardDelta.
  const DECKS = table([
    { id: 'firstissue', oldId: 'dinghy', name: 'House Deck', text: 'A standard 52-card deck. No surprises.', unlock: 'Unlocked from the start.', unlockedBy: { type: 'start' }, mods: {} },
    { id: 'speedlines', oldId: 'clipper', name: 'Firefly Deck', text: `+1 hand every Blind, ${MINUS}1 discard.`, unlock: 'Unlocked from the start.', unlockedBy: { type: 'start' }, mods: { hands: 1, discards: -1 } },
    { id: 'sketchbook', oldId: 'trawler', name: "Seer's Deck", text: '+1 discard every Blind. Tarot cards cost $1 less in the Shop.', unlock: 'Unlocked from the start.', unlockedBy: { type: 'start' }, mods: { discards: 1 }, tarotPriceDelta: -1 },
    { id: 'panorama', oldId: 'lantern', name: 'Candelabra Deck', text: `+1 hand size, ${MINUS}1 discard every Blind.`, unlock: 'Reach Ante 3 to unlock.', unlockedBy: { type: 'ante', ante: 3 }, mods: { handSize: 1, discards: -1 } },
    { id: 'bargainbin', oldId: 'pearler', name: 'Rags to Riches Deck', text: 'Six random cards start Gilt-Edged. Start with $0.', unlock: 'Reach Ante 4 to unlock.', unlockedBy: { type: 'ante', ante: 4 }, mods: {}, money: 0, startEnhancement: { id: 'dimestore', count: 6 } },
    { id: 'studio', oldId: 'barnacle', name: 'Parlour Deck', text: '+1 consumable slot. Start with The Candlemaker, Fire-Eater and Spotlight.', unlock: 'Reach Ante 5 to unlock.', unlockedBy: { type: 'ante', ante: 5 }, mods: { consumableSlots: 1 }, startConsumables: ['inkpot', 'boxingglove', 'spotlight'] },
    { id: 'rubberstamp', oldId: 'tender', name: 'Gift-Wrapped Deck', text: 'Eight random cards start with a random Seal.', unlock: 'Reach Ante 6 to unlock.', unlockedBy: { type: 'ante', ante: 6 }, mods: {}, startSeals: 8 },
    { id: 'mintcondition', oldId: 'sloop', name: 'High Roller Deck', text: 'Start with $12. Jokers sell for their full cost. Blind rewards are $1 lower.', unlock: 'Win a run to unlock.', unlockedBy: { type: 'win' }, mods: {}, money: 12, sellFull: true, rewardDelta: -1 },
    { id: 'halftone', name: 'Mirrorball Deck', text: 'Jokers in the Shop and in Joker Packs are twice as likely to have an Edition. Start with a random common Joker with Sheen.', unlock: 'Reach Ante 7 to unlock.', unlockedBy: { type: 'ante', ante: 7 }, mods: {}, editionOdds: 2, startJoker: { rarity: 'common', edition: 'gloss' } },
    { id: 'spooky', name: 'Spooky Deck', text: 'Spectral cards can appear in the Shop, and Ghost Packs show up twice as often. Start with Curtain Call.', unlock: 'Win a run on Nightfall Stake or higher to unlock.', unlockedBy: { type: 'win', stakes: ['uhoh', 'gulp', 'yikes'] }, mods: {}, spectralInShop: true, ghostPackWeight: 2, startConsumables: ['curtaincall'] },
  ]);

  // ---- 3.14 Stakes ----
  // unlockedBy: { type:'start' } | { type:'win', on: stakeId }.
  const STAKES = table([
    { id: 'sunny', oldId: 'calm', name: 'Twilight Stake', text: 'The standard run.', targetMult: 1, mods: {}, unlock: 'Unlocked from the start.', unlockedBy: { type: 'start' } },
    { id: 'uhoh', oldId: 'choppy', name: 'Nightfall Stake', text: 'Targets +20%.', targetMult: 1.2, mods: {}, unlock: 'Win a run on Twilight Stake to unlock.', unlockedBy: { type: 'win', on: 'sunny' } },
    { id: 'gulp', oldId: 'rough', name: 'Moonless Stake', text: 'Targets +20%. One fewer discard every Blind.', targetMult: 1.2, mods: { discards: -1 }, unlock: 'Win a run on Nightfall Stake to unlock.', unlockedBy: { type: 'win', on: 'uhoh' } },
    { id: 'yikes', oldId: 'gale', name: 'Last Candle Stake', text: 'Targets +40%. One fewer discard every Blind. Interest caps at $3.', targetMult: 1.4, mods: { discards: -1 }, interestCap: 3, unlock: 'Win a run on Moonless Stake to unlock.', unlockedBy: { type: 'win', on: 'gulp' } },
  ]);

  // ---- 3.15 Other tables ----
  const ANTE_TARGETS = [300, 700, 1700, 4000, 8500, 16000, 28000, 45000];

  const RANK_NAMES = { 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  const RANK_WORDS = { 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };
  const RANK_PLURALS = { 2: 'Twos', 3: 'Threes', 4: 'Fours', 5: 'Fives', 6: 'Sixes', 7: 'Sevens', 8: 'Eights', 9: 'Nines', 10: 'Tens', 11: 'Jacks', 12: 'Queens', 13: 'Kings', 14: 'Aces' };
  const SUIT_NAMES = { S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' };
  const SUIT_ORDER = ['S', 'H', 'C', 'D'];

  // Starting values (2.11), Joker rarities, Shop odds and prices (2.8, 2.9), as data.
  const DEFAULTS = { money: 4, hands: 4, discards: 3, handSize: 8, jokerSlots: 5, consumableSlots: 2, minHands: 1, minDiscards: 0, minHandSize: 1 };
  const RARITIES = {
    common: { name: 'Common', weight: 70 },
    uncommon: { name: 'Uncommon', weight: 25 },
    rare: { name: 'Rare', weight: 5 },
    legendary: { name: 'Legendary', weight: 0 }, // never rolled: only Tall Tale (originstory) creates one
  };
  const SHOP = {
    cardSlots: 2,
    packSlots: 2,
    voucherSlots: 1,
    cardKindWeights: { joker: 70, tarot: 15, planet: 15, spectral: 0 },
    spectralWeight: 5, // the Spectral card weight with the Spooky Deck or Haunted Stall
    packKindWeights: { card: 32, tarot: 24, planet: 24, joker: 14, ghost: 6 },
    packSizeWeights: { normal: 70, jumbo: 22, mega: 8 },
    prices: { tarot: 3, planet: 3, spectral: 4, voucher: 10 },
    sell: { tarot: 1, planet: 1, spectral: 2 },
    rerollCost: 5,
    rerollStep: 1,
    cardPack: { enhancement: 0.35, seal: 0.1 },
    originStory: { tarot: 0.005, ghost: 0.02 }, // chance per Tarot Pack / Ghost Pack slot
  };
  const ECONOMY = { interestPer: 5, interestCap: 5, handBonus: 1, endlessGrowth: 1.75 };

  function byId(tableName, id) {
    const t = TW.Content[tableName];
    if (!t || id == null) return null;
    if (Array.isArray(t)) return t.find((row) => row.id === id) || null;
    return Object.prototype.hasOwnProperty.call(t, id) ? t[id] : null;
  }

  TW.Content = {
    HANDS, BLINDS, ENHANCEMENTS, EDITIONS, SEALS, TAROTS, PLANETS, SPECTRALS, JOKERS, BOSSES,
    VOUCHERS, TAGS, PACKS, DECKS, STAKES,
    ANTE_TARGETS, RANK_NAMES, RANK_WORDS, RANK_PLURALS, SUIT_NAMES, SUIT_ORDER,
    DEFAULTS, RARITIES, SHOP, ECONOMY,
    byId,
  };
})();
