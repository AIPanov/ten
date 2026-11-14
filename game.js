// Game state and rules: a port of game/state.py + game/scoring.py. No DOM here.
// State is a plain object (saved as JSON in localStorage); functions take it as the first argument.
(function (root) {
  var D = root.DATA || (typeof require !== "undefined" ? require("./data.js") : null);
  var C = D.C;
  var THIEF = "thief", DETECTIVE = "detective", SPY = "spy", AFERIST = "aferist", ACCOMPLICE = "accomplice",
    NOTARY = "notary";
  var FINAL_ROUND = D.MAX_ROUND + 1;

  // ---------- random helpers (rng = { random: () => [0,1) }) ----------
  var RNG = { random: Math.random };
  function seeded(seed) {           // mulberry32, for tests and simulations
    var a = seed >>> 0;
    return { random: function () {
      a = (a + 0x6D2B79F5) >>> 0; var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    } };
  }
  function randrange(rng, n) { return Math.floor((rng || RNG).random() * n); }
  function choice(rng, arr) { return arr[randrange(rng, arr.length)]; }
  function shuffle(rng, arr) {
    for (var i = arr.length - 1; i > 0; i--) { var j = randrange(rng, i + 1); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  }
  function sample(rng, arr, k) { return shuffle(rng, arr.slice()).slice(0, k); }
  function range(n) { var r = []; for (var i = 0; i < n; i++) r.push(i); return r; }
  function fmt(s, vars) {
    return String(s).replace(/\{(\w+)\}/g, function (m, k) { return vars && k in vars ? vars[k] : m; });
  }

  // ---------- rules by player count ----------
  function rules(n) {
    var r = Object.assign({}, C.BY_PLAYERS[String(n)] || C.BY_PLAYERS["4"]);
    var bonus = r.THIEF_FREE_BONUS;
    r.FREE_TXT = bonus ? " и получает " + bonus + " ₽ от банка" : "";
    r.EXPOSE_TXT = r.EXPOSE_SLACK ? "все, кроме одного" : "все остальные";
    r.GUESS_REWARD = C.GUESS_REWARD;
    Object.assign(r, courtTexts(r));
    return r;
  }
  // See court_texts in game/config.py — keep the two in sync.
  function courtTexts(r) {
    var GR = C.GUESS_REWARD;
    if (r.GUESS_ROLES !== false) return {
      EXPOSE_GOAL: "Не быть разгаданным: твою роль не должны угадать " + r.EXPOSE_TXT + ".",
      EXPOSE_RISK: " (угадают твою роль " + r.EXPOSE_TXT + " — миссия провалена)",
      COURT_TITLE: "Кто есть кто",
      COURT_AND_ROLES: " — и угадает, кто есть кто",
      COURT_TAIL_SPEECH: "За каждую угаданную роль — сто рублей, тайно, при подсчёте. А того, чью роль угадали " +
        r.EXPOSE_TXT + ", ждёт провал миссии.",
      COURT_TAIL_WHY: "Каждая верная роль — +" + GR + " ₽ при подсчёте; чью роль угадали " + r.EXPOSE_TXT + " — миссия провалена.",
      COURT_STEP: "«Кто есть кто»: каждый тайно выбирает вора и ставит роли остальным (~40 секунд на человека, " +
        "таймер ждёт). Всё откроется только при подсчёте.",
    };
    return {
      EXPOSE_GOAL: "",
      EXPOSE_RISK: "",
      COURT_TITLE: "Кто вор",
      COURT_AND_ROLES: "",
      COURT_TAIL_SPEECH: "Угадал вора — сто рублей, тайно, при подсчёте. Если вора назовут все остальные, он проваливает миссию.",
      COURT_TAIL_WHY: "Угадал вора — +" + GR + " ₽ при подсчёте. Назвали вора все остальные — его миссия провалена. " +
        "Втроём роли не угадывают: зная себя и вора, легко вычислить третьего.",
      COURT_STEP: "«Кто вор»: каждый тайно называет вора (~20 секунд на человека, таймер ждёт). Всё откроется только при подсчёте.",
    };
  }
  function rolesFor(n, rng) {
    if (n === 3) return [THIEF, DETECTIVE, choice(rng, [SPY, AFERIST])];
    if (n === 5) return D.ROLE_IDS.concat([ACCOMPLICE]);
    if (n === 6) return D.ROLE_IDS.concat([ACCOMPLICE, NOTARY]);
    return D.ROLE_IDS.slice();
  }

  function newPlayer(name, role) {
    return { name: name, role: role, balance: C.START_MONEY, clues: 0, fragments: 0, ability_used: false,
      suspect: null, vote: null, auctions_won: 0, deal_partners: [], last_fine: 0, secret_pending: 0,
      commissions: 0, hints: [], cleared: [], pairs: [], digits: {}, safe_tried: false, duel_cards: 0,
      shields: 0, double_vote: false, guesses: {} };
  }

  var G = {
    D: D, C: C, THIEF: THIEF, DETECTIVE: DETECTIVE, SPY: SPY, AFERIST: AFERIST, ACCOMPLICE: ACCOMPLICE, NOTARY: NOTARY,
    FINAL_ROUND: FINAL_ROUND, seeded: seeded, choice: choice, sample: sample, shuffle: shuffle,
    randrange: randrange, range: range, fmt: fmt, rules: rules, rolesFor: rolesFor,
  };

  // ---------- setup ----------
  G.create = function (names, rng, mode) {
    rng = rng || RNG;
    var roles = shuffle(rng, rolesFor(names.length, rng));
    var st = {
      version: 1,
      players: names.map(function (n, k) { return newPlayer(n, roles[k]); }),
      bank: C.TOTAL_MONEY - C.START_MONEY * names.length - C.FINAL_PRIZE,
      code: range(C.CODE_LEN).map(function () { return parseInt(choice(rng, C.CODE_DIGITS.split("")), 10); }),
      prize_in_safe: C.FINAL_PRIZE, safe_opened_by: null, ious: [], round_index: 0,
      event_deck: shuffle(rng, Object.keys(D.EVENTS).map(Number)), current_event: null, event_applied: false,
      clue_hider: null, fragment_hider: null, roles_shown: false, suspects_done: false, clue_step: 0,
      lot_ids: G.drawLots(rng, names.length), lot_step: 0, lots_sold: {},
      court_done: false, thief_caught: false, court_verdict: "", court_outcome: "", mail_done: false, trial_done: false, fragment_step: 0,
      final_paid: false, spot_ids: sample(rng, range(D.SPOTS.length), C.TOTAL_CLUES + 2),
      alibi_places: [], alibi_true: 0, alibi_known: {}, alibi_answers: {}, forgetful: null,
      fake_armed: false, fake_given_to: null, timer_left: 0, mode: mode || C.DEFAULT_MODE, notary_book: [], log: [],
    };
    G.makeAlibis(st, rng);
    if (G.rulesOf(st).THIEF_START_DIGIT) {   // 3–4 players: the thief locked the safe and remembers one digit
      var pos = String(randrange(rng, C.CODE_LEN) + 1), th = st.players[G.thief(st)];
      th.digits[pos] = st.code[+pos - 1];
      th.hints.push("Ты сам запирал сейф и помнишь цифру №" + pos + " = " + th.digits[pos]);
    }
    G.note(st, "Новая партия: " + names.join(", "));
    return st;
  };

  G.drawLots = function (rng, count) {
    var byKind = {}, order = [];
    D.ENVELOPES.forEach(function (e, k) {
      var g = { money: "cash", fine: "cash", tax: "cash", richest: "cash", pair: "info", extra: "info",
        digit: "safe" }[e[1]] || "card";
      if (!byKind[g]) { byKind[g] = []; order.push(g); }
      byKind[g].push(k);
    });
    shuffle(rng, order);
    var picks = order.map(function (g) { return choice(rng, byKind[g]); }).slice(0, count);
    var rest = range(D.ENVELOPES.length).filter(function (k) { return picks.indexOf(k) < 0; });
    while (picks.length < count) picks.push(rest.splice(randrange(rng, rest.length), 1)[0]);
    return shuffle(rng, picks);
  };

  // ---------- hiding places ----------
  G.clueSpot = function (st, k) { return D.SPOTS[st.spot_ids[k]]; };
  G.fragmentSpot = function (st, k) { return D.SPOTS[st.spot_ids[C.TOTAL_CLUES + k]]; };
  G.replaceSpot = function (st, slot, rng) {
    var free = range(D.SPOTS.length).filter(function (k) { return st.spot_ids.indexOf(k) < 0; });
    st.spot_ids[slot] = choice(rng, free);
  };

  // ---------- round 1: alibi ----------
  G.makeAlibis = function (st, rng) {
    st.alibi_places = sample(rng, D.ALIBI_PLACES, 4);
    st.alibi_true = randrange(rng, 4);
    var wrong = [0, 1, 2, 3].filter(function (k) { return k !== st.alibi_true; });
    var innocents = range(st.players.length).filter(function (i) {
      var r = st.players[i].role; return r !== THIEF && r !== ACCOMPLICE;
    });
    st.forgetful = choice(rng, innocents);
    st.players.forEach(function (p, i) {
      st.alibi_known[String(i)] = (p.role === THIEF || i === st.forgetful)
        ? shuffle(rng, [st.alibi_true, choice(rng, wrong)]) : [st.alibi_true];
    });
  };
  G.alibiCard = function (st, i) {
    var p = st.players[i];
    var opts = st.alibi_known[String(i)].map(function (k) { return st.alibi_places[k]; });
    if (p.role === THIEF)
      return "Ты был в музее и крал картину. Остальные в это время были либо " + opts[0] + ", либо " + opts[1] +
        " — ты слышал краем уха. Выбери один вариант и ври уверенно.";
    if (i === st.forgetful)
      return "Ты невиновен, но плохо помнишь тот вечер: ты был либо " + opts[0] + ", либо " + opts[1] +
        ". Выбери, что кажется вернее. Если не совпадёт — объясни, что ты забывчивый.";
    var text = "В ночь кражи ты был " + opts[0] + ". Ты помнишь это точно — отвечай честно.";
    if (p.role === ACCOMPLICE) text += " И ты знаешь вора: " + G.name(st, G.thief(st)) + ". Прикрывай его.";
    return text;
  };
  G.setAlibiAnswers = function (st, answers) {
    st.alibi_answers = {};
    var parts = [];
    Object.keys(answers).forEach(function (i) {
      st.alibi_answers[String(i)] = answers[i];
      parts.push(G.name(st, +i) + " — " + st.alibi_places[answers[i]]);
    });
    G.note(st, "Ответы алиби: " + parts.join(", "));
  };
  // Players whose answer differs from the truth (innocents remember it exactly).
  G.alibiMismatch = function (st) {
    return Object.keys(st.alibi_answers).filter(function (i) { return Number(st.alibi_answers[i]) !== Number(st.alibi_true); }).map(Number);
  };

  // ---------- helpers ----------
  G.note = function (st, text) { st.log.push(text); };
  G.name = function (st, i) { return st.players[i].name; };
  G.roleIndex = function (st, role) {
    for (var i = 0; i < st.players.length; i++) if (st.players[i].role === role) return i;
    return -1;
  };
  G.hasRole = function (st, role) { return G.roleIndex(st, role) >= 0; };
  G.n = function (st) { return st.players.length; };
  G.rulesOf = function (st) { return rules(st.players.length); };
  G.thief = function (st) { return G.roleIndex(st, THIEF); };
  G.round = function (st) { return D.ROUNDS[Math.max(1, Math.min(st.round_index, D.MAX_ROUND))]; };
  G.others = function (st, i) { return range(st.players.length).filter(function (j) { return j !== i; }); };

  // Length of the current round in the chosen mode (old saves have no mode → default).
  G.minutes = function (st) {
    var m = C.MODES[st.mode] || C.MODES[C.DEFAULT_MODE];
    return m.minutes[Math.max(1, Math.min(st.round_index, D.MAX_ROUND)) - 1];
  };

  G.plantFake = function (st, i) { st.players[i].ability_used = true; st.fake_armed = true; };

  G.candidates = function (st, i) {
    var p = st.players[i];
    if (p.role === ACCOMPLICE) return [G.thief(st)];
    var cands = range(st.players.length).filter(function (j) { return j !== i && p.cleared.indexOf(j) < 0; });
    p.pairs.forEach(function (pair) {
      var narrowed = cands.filter(function (j) { return pair.indexOf(j) >= 0; });
      if (narrowed.length) cands = narrowed;
    });
    return cands;
  };

  G.clearHint = function (st, i, source, rng) {
    var p = st.players[i], th = G.thief(st), x;
    if (st.fake_armed && i !== th) {          // the thief's planted evidence names the thief as innocent
      st.fake_armed = false;
      st.fake_given_to = i;
      x = th;
    } else {
      var pool = range(st.players.length).filter(function (j) { return j !== i && j !== th; });
      var fresh = pool.filter(function (j) { return p.cleared.indexOf(j) < 0; });
      x = choice(rng, fresh.length ? fresh : pool);
    }
    if (p.cleared.indexOf(x) < 0) p.cleared.push(x);
    var text = G.name(st, x) + " — не вор.";
    p.hints.push(source + ": " + text);
    return text;
  };

  G.pairHint = function (st, i, source, rng) {
    var th = G.thief(st);
    var others = range(st.players.length).filter(function (j) { return j !== i && j !== th; });
    var pair = shuffle(rng, [th, choice(rng, others)]);
    if (i === th) pair = sample(rng, G.others(st, i), 2);   // the thief gets a harmless pair
    st.players[i].pairs.push(pair);
    var text = "вор — один из двух: " + G.name(st, pair[0]) + " или " + G.name(st, pair[1]) + ".";
    st.players[i].hints.push(source + ": " + text);
    return text;
  };

  G.digitHint = function (st, i, rng) {
    var p = st.players[i];
    var all = range(C.CODE_LEN).map(function (k) { return String(k + 1); });
    var unknown = all.filter(function (k) { return !(k in p.digits); });
    var pos = choice(rng, unknown.length ? unknown : all);
    p.digits[pos] = st.code[+pos - 1];
    return "Цифра №" + pos + " кода сейфа: " + p.digits[pos];
  };

  // ---------- money ----------
  G.receive = function (st, amount) {
    st.bank += amount;
    st.ious.forEach(function (iou) {
      if (st.bank <= 0) return;
      var pay = Math.min(iou[1], st.bank);
      st.bank -= pay; iou[1] -= pay; st.players[iou[0]].balance += pay;
      G.note(st, "Банк погасил расписку: " + G.name(st, iou[0]) + " +" + pay + " ₽");
    });
    st.ious = st.ious.filter(function (x) { return x[1] > 0; });
  };
  G.bankPay = function (st, i, amount, why) {
    var paid = Math.min(amount, st.bank);
    st.bank -= paid;
    st.players[i].balance += paid;
    if (amount > paid) {
      st.ious.push([i, amount - paid]);
      G.note(st, "Банк пуст: расписка " + G.name(st, i) + " на " + (amount - paid) + " ₽");
    }
    G.note(st, (G.name(st, i) + " +" + amount + " ₽ " + (why || "")).trim());
    return paid;
  };
  G.payBank = function (st, i, amount, why, fine) {
    var p = st.players[i];
    var paid = Math.min(amount, p.balance);
    p.balance -= paid;
    if (fine && p.shields > 0) {
      // Insurance: pays like everyone (cash matches the app), gets it back secretly at the final count.
      p.shields -= 1;
      p.secret_pending += paid;
    } else if (fine) p.last_fine = paid;
    G.receive(st, paid);
    G.note(st, (p.name + " −" + paid + " ₽ " + (why || "")).trim());
    return paid;
  };
  G.transfer = function (st, src, dst, amount) {
    var paid = Math.min(amount, st.players[src].balance);
    st.players[src].balance -= paid;
    st.players[dst].balance += paid;
    G.note(st, G.name(st, src) + " → " + G.name(st, dst) + ": " + paid + " ₽");
    return paid;
  };
  G.totalMoney = function (st) {
    // Bank IOUs are promises, not bills: the bills on the table always add up to TOTAL_MONEY.
    return st.bank + st.prize_in_safe + st.players.reduce(function (s, p) { return s + p.balance; }, 0);
  };

  // ---------- rounds ----------
  G.nextRound = function (st) {
    if (st.round_index >= FINAL_ROUND) return;
    st.round_index += 1;
    st.current_event = null;
    st.event_applied = false;
    if (st.round_index <= D.MAX_ROUND) {
      st.timer_left = G.minutes(st) * 60;
      if (st.event_deck.length && st.round_index > 1) st.current_event = st.event_deck.shift();
      G.note(st, "— Раунд " + st.round_index + ". " + G.round(st).title + " —");
      if (st.current_event) G.note(st, "Событие: " + D.EVENTS[st.current_event][0]);
    } else {
      G.note(st, "— Подсчёт —");
    }
  };

  // ---------- events ----------
  G.applyBankruptcy = function (st) {
    var top = Math.max.apply(null, st.players.map(function (p) { return p.balance; }));
    var payers = range(st.players.length).filter(function (i) { return st.players[i].balance === top; });
    payers.forEach(function (i) { G.payBank(st, i, C.BANKRUPTCY_FINE, "(Банкротство)", true); });
    st.event_applied = true;
    return payers;
  };
  G.applyCrisis = function (st) {
    st.players.forEach(function (p, i) { G.payBank(st, i, C.CRISIS_FINE, "(Кризис)", true); });
    st.event_applied = true;
  };
  G.applyLucky = function (st, rolls) {
    Object.keys(rolls).forEach(function (i) {
      if (rolls[i] === 6) G.bankPay(st, +i, C.LUCKY_WIN, "(Счастливый билет)");
      else if (rolls[i] === 1) G.payBank(st, +i, C.LUCKY_LOSS, "(Счастливый билет)", true);
    });
    st.event_applied = true;
  };
  G.applyContract = function (st, a, b) {
    G.recordDeal(st, a, b, 0, "контракт");
    G.bankPay(st, a, C.CONTRACT_REWARD, "(Секретный контракт)");
    G.bankPay(st, b, C.CONTRACT_REWARD, "(Секретный контракт)");
    st.event_applied = true;
  };

  // ---------- round 1 ----------
  G.setSuspects = function (st, guesses) {
    Object.keys(guesses).forEach(function (i) { st.players[i].suspect = guesses[i]; });
    st.suspects_done = true;
    G.note(st, "Тайные подозрения записаны");
  };

  // ---------- round 2 ----------
  G.canFindClue = function (st, i) { return st.clue_step < C.TOTAL_CLUES && i !== st.clue_hider; };
  G.findClue = function (st, i, rng) {
    var p = st.players[i];
    st.clue_step += 1;
    p.clues += 1;
    G.bankPay(st, i, C.CLUE_REWARD, "(улика)");
    if (p.role === DETECTIVE) p.secret_pending += C.DETECTIVE_CLUE_BONUS;
    return G.clearHint(st, i, "Улика", rng);
  };
  G.skipClue = function (st) {
    G.note(st, "Улику №" + (st.clue_step + 1) + " не нашли");
    st.clue_step += 1;
  };

  // ---------- round 3: envelopes ----------
  G.lot = function (st, k) { return D.ENVELOPES[st.lot_ids[k]]; };
  G.sellLot = function (st, k, winner, price, rng) {
    var e = G.lot(st, k), title = e[0], kind = e[1], amount = e[2], flavor = e[3];
    var p = st.players[winner];
    G.payBank(st, winner, price, "(конверт " + (k + 1) + ")");
    st.lots_sold[String(k)] = winner;
    st.lot_step = k + 1;
    p.auctions_won += 1;
    var lines = ["«" + title + "»", flavor];
    var src = "Конверт " + (k + 1);
    if (kind === "money") {
      G.bankPay(st, winner, amount, "");
      lines.push("Возьми у банка " + amount + " ₽.");
    } else if (kind === "fine") {
      var paid = G.payBank(st, winner, amount, "", true);
      lines.push(paid ? "Отдай банку " + paid + " ₽." : "Штраф не взят: у тебя нет денег.");
    } else if (kind === "tax") {
      var got = G.others(st, winner).reduce(function (s, j) { return s + G.transfer(st, j, winner, amount); }, 0);
      lines.push("Каждый платит тебе по " + amount + " ₽ (всего " + got + " ₽).");
    } else if (kind === "richest") {
      var others = G.others(st, winner);
      var rich = others.reduce(function (a, j) { return st.players[j].balance > st.players[a].balance ? j : a; }, others[0]);
      var got2 = G.transfer(st, rich, winner, amount);
      lines.push(G.name(st, rich) + " платит тебе " + got2 + " ₽.");
    } else if (kind === "duel") p.duel_cards += 1;
    else if (kind === "shield") p.shields += 1;
    else if (kind === "digit") lines.push(G.digitHint(st, winner, rng));
    else if (kind === "pair") lines.push("Подсказка: " + G.pairHint(st, winner, src, rng));
    else if (kind === "extra") lines.push("Подсказка: " + G.clearHint(st, winner, src, rng));
    else if (kind === "double") p.double_vote = true;
    lines.push("И подсказка: " + G.clearHint(st, winner, src, rng));
    return lines;
  };
  G.skipLot = function (st, k) {
    G.note(st, "Конверт " + (k + 1) + ": никто не купил");
    st.lot_step = k + 1;
  };

  // ---------- deals ----------
  // Hints from the seller's board that can be passed through the device.
  // The thief's own pair is a decoy (it does not contain the thief), so it is not for sale.
  G.sellableHints = function (st, seller, buyer) {
    var s = st.players[seller];
    var out = s.cleared.filter(function (x) { return x !== buyer; }).map(function (x) { return { kind: "clear", who: x }; });
    if (s.role !== THIEF) out = out.concat(s.pairs.map(function (p) { return { kind: "pair", who: p.slice() }; }));
    return out;
  };
  G.hintText = function (st, h) {
    if (h.kind === "clear") return G.name(st, h.who) + " — не вор.";
    return "вор — один из двух: " + G.name(st, h.who[0]) + " или " + G.name(st, h.who[1]) + ".";
  };
  // Copy hint k onto the buyer's board. Nothing goes to the public log: record_deal logs the deal.
  G.giveHint = function (st, seller, buyer, k) {
    var h = G.sellableHints(st, seller, buyer)[k], b = st.players[buyer], text = G.hintText(st, h), isNew;
    if (h.kind === "clear") {
      isNew = b.cleared.indexOf(h.who) < 0;
      if (isNew) b.cleared.push(h.who);
    } else {
      var key = h.who.slice().sort().join(",");
      isNew = !b.pairs.some(function (p) { return p.slice().sort().join(",") === key; });
      if (isNew) b.pairs.push(h.who.slice());
    }
    if (isNew) b.hints.push("Сделка (" + G.name(st, seller) + "): " + text);
    return { text: text, isNew: isNew };
  };

  // guaranteed: the notary certifies the deal, the buyer pays NOTARY_FEE «to the bank»; with a Notary in the
  // game that money secretly goes to them at the final count. what = the secret content (for the Notary's ability).
  G.recordDeal = function (st, seller, buyer, price, item, digitPos, guaranteed, what) {
    var s = st.players[seller], b = st.players[buyer];
    item = item || "что-то";
    var counts = price >= C.DEAL_MIN;   // empty deals do not close missions or earn commission
    if (counts) { s.deal_partners.push(buyer); b.deal_partners.push(seller); }
    var paid = price > 0 ? G.transfer(st, buyer, seller, price) : 0;
    if (digitPos && digitPos in s.digits) b.digits[digitPos] = s.digits[digitPos];
    var story = s.name + " продаёт " + item + " → " + b.name + (paid ? ", " + paid + " ₽" : ", без денег");
    if (guaranteed) {
      var fee = G.payBank(st, buyer, C.NOTARY_FEE, "(нотариус)");
      story += " + " + fee + " ₽ нотариусу (гарантия)";
      if (digitPos && !what) what = "цифра №" + digitPos + " = " + b.digits[digitPos];
      st.notary_book = st.notary_book || [];
      st.notary_book.push({ seller: seller, buyer: buyer, what: what || item });
      if (G.hasRole(st, NOTARY) && b.role !== NOTARY) st.players[G.roleIndex(st, NOTARY)].secret_pending += fee;
    }
    G.note(st, "Сделка: " + story);
    [seller, buyer].forEach(function (i) {
      var p = st.players[i];
      if (counts && p.role === AFERIST && p.commissions < C.AFERIST_COMMISSION_MAX) {
        p.commissions += 1;
        p.secret_pending += C.AFERIST_COMMISSION;
      }
    });
    return story;
  };

  // ---------- dice duel ----------
  G.duel = function (st, a, b, ra, rb, card) {
    if (ra === rb) return null;
    var win = ra > rb ? a : b;
    G.note(st, "Дуэль: " + G.name(st, a) + " " + ra + " против " + rb + " " + G.name(st, b));
    if (card) st.players[a].duel_cards -= 1;
    else st.players[a].ability_used = true;
    G.bankPay(st, win, C.DUEL_PRIZE, "(дуэль)");   // same for card and ability: the result tells nothing
    return win;
  };
  // true: by a «Duel» card, false: by the thief's ability, null: no right (checked on a private screen)
  G.canDuel = function (st, a) {
    var p = st.players[a];
    if (p.duel_cards > 0) return true;
    if (p.role === THIEF && !p.ability_used && !G.rulesOf(st).FAKE_HINT) return false;
    return null;
  };

  // ---------- round 5: safe ----------
  G.trialWinner = function (st, i) {
    var p = st.players[i];
    p.fragments += 1;
    p.digits["1"] = st.code[0];
    st.trial_done = true;
    G.note(st, p.name + ": фрагмент кода (испытание)");
    return "Цифра №1 кода сейфа: " + st.code[0];
  };
  G.canFindFragment = function (st, i) { return st.fragment_step < 2 && i !== st.fragment_hider; };
  G.findFragment = function (st, i) {
    var p = st.players[i];
    var pos = String(st.fragment_step + 2);
    p.fragments += 1;
    p.digits[pos] = st.code[+pos - 1];
    st.fragment_step += 1;
    G.note(st, p.name + ": фрагмент кода (тайник)");
    return "Цифра №" + pos + " кода сейфа: " + p.digits[pos];
  };
  G.skipFragment = function (st) {
    G.note(st, "Фрагмент №" + (st.fragment_step + 2) + " не нашли");
    st.fragment_step += 1;
  };
  G.trySafe = function (st, i, guess) {
    var p = st.players[i];
    if (p.safe_tried || st.safe_opened_by !== null) return false;
    p.safe_tried = true;
    if (guess.join("") === st.code.join("")) {
      st.safe_opened_by = i;
      p.balance += st.prize_in_safe;
      G.note(st, "Сейф вскрыт — " + p.name + ": +" + st.prize_in_safe + " ₽");
      st.prize_in_safe = 0;
      return true;
    }
    var fine = G.payBank(st, i, C.SAFE_FINE, "(сигнализация)", true);
    G.note(st, p.name + ": неверный код, сработала сигнализация (−" + fine + " ₽)");
    return false;
  };

  // ---------- round 6: court ----------
  G.votesAgainst = function (st, i) { return st.players.filter(function (p) { return p.vote === i; }).length; };

  // Court «who is who» — see GameState.set_guesses in game/state.py.
  G.guessableRoles = function (st, i) {
    if (G.rulesOf(st).GUESS_ROLES === false) return [];   // 3 players: only «who is the thief»
    var n = st.players.length;
    var pool = D.ROLE_IDS.concat(n >= 5 ? [ACCOMPLICE] : [], n >= 6 ? [NOTARY] : []);
    return pool.filter(function (r) { return r !== THIEF; });   // same list for everyone: see guessable_roles
  };
  G.setGuesses = function (st, votes, roles) {
    st.players.forEach(function (p, i) {
      var g = {}, mine = (roles && roles[i]) || {};
      var pool = G.guessableRoles(st, i);
      Object.keys(mine).forEach(function (j) { if (mine[j] && +j !== i && pool.indexOf(mine[j]) >= 0) g[String(j)] = mine[j]; });
      // each role belongs to one person: a role put on several players counts for none of them
      var vals = Object.keys(g).map(function (j) { return g[j]; });
      Object.keys(g).forEach(function (j) {
        if (g[j] === THIEF || vals.filter(function (r) { return r === g[j]; }).length > 1) delete g[j];
      });
      if (votes[i] !== null && votes[i] !== undefined) g[String(votes[i])] = THIEF;
      p.guesses = g;
      var right = Object.keys(g).filter(function (j) { return st.players[+j].role === g[j]; }).length;
      p.secret_pending += right * C.GUESS_REWARD;
    });
    return G.setVotes(st, votes);
  };
  G.guessedBy = function (st, j) {
    var role = st.players[j].role;
    return st.players.filter(function (p, i) { return i !== j && (p.guesses || {})[String(j)] === role; }).length;
  };
  G.exposed = function (st, j) {
    if (!st.players.some(function (p) { return p.guesses && Object.keys(p.guesses).length; })) return false;
    var need = st.players.length - 1 - (G.rulesOf(st).EXPOSE_SLACK || 0);
    return G.guessedBy(st, j) >= need;
  };
  G.setVotes = function (st, votes) {
    Object.keys(votes).forEach(function (i) { st.players[i].vote = votes[i]; });
    var th = G.thief(st), R = G.rulesOf(st), right = 0, wrong = 0, verdict;
    Object.keys(votes).forEach(function (i) {
      var w = st.players[i].double_vote ? 2 : 1;
      if (votes[i] === th) right += w; else wrong += w;
    });
    // The verdict and its money are kept until the final count: who won the court tells who the thief is.
    if (right > wrong) {
      st.thief_caught = true; st.court_outcome = "caught";
      verdict = "Большинство угадало вора! Вор платит детективу " + R.CAUGHT_FINE + " ₽.";
    } else if (wrong > right) {
      st.court_outcome = "free";
      verdict = R.THIEF_FREE_BONUS ? "Большинство ошиблось. " + R.THIEF_FREE_BONUS + " ₽ из банка получает вор."
        : "Большинство ошиблось. Вор ушёл от суда.";
    } else { st.court_outcome = "tie"; verdict = "Голоса разделились поровну. Бонус не получает никто."; }
    if (st.players.some(function (p) { return p.double_vote; }))
      verdict += " (Голос с картой «присяжного» считался за два.)";
    st.court_done = true;
    st.court_verdict = verdict;
    G.note(st, "Суд: голоса записаны, приговор — при подсчёте");
    return verdict;
  };
  G.payCourt = function (st) {   // court money, at the final count
    var th = G.thief(st), out = st.court_outcome, R = G.rulesOf(st);
    if (out !== "paid")   // right suspicion in round 1 (the accomplice knows the thief: no reward)
      st.players.forEach(function (p) { if (p.suspect === th && p.role !== ACCOMPLICE) p.secret_pending += C.SUSPECT_REWARD; });
    st.court_outcome = "paid";
    if (out === "caught") {
      var det = G.roleIndex(st, DETECTIVE), fine = R.CAUGHT_FINE;
      var paid = G.transfer(st, th, det, fine);
      if (paid < fine) G.bankPay(st, det, fine - paid, "(суд)");
      return ["Суд: " + G.name(st, th) + " → " + G.name(st, det) + ": " + fine + " ₽ (вор платит детективу)"];
    }
    if (out === "free" && R.THIEF_FREE_BONUS) {
      G.bankPay(st, th, R.THIEF_FREE_BONUS, "(суд)");
      return ["Суд: " + G.name(st, th) + " +" + R.THIEF_FREE_BONUS + " ₽ (вор ушёл от суда)"];
    }
    return [];
  };

  // ---------- round 5: the accomplice's mail (see GameState.send_mail) ----------
  G.sendMail = function (st) {
    var letters = {};
    st.players.forEach(function (p, i) { letters[i] = "Писем для тебя нет. Посиди пару секунд, будто читаешь, и нажми «Прочитано»."; });
    st.mail_done = true;
    if (!G.hasRole(st, ACCOMPLICE)) return letters;
    var th = G.thief(st), acc = G.roleIndex(st, ACCOMPLICE), t = st.players[th], a = st.players[acc];
    a.ability_used = true;
    var missing = range(C.CODE_LEN).map(function (k) { return String(k + 1); }).filter(function (k) { return !(k in t.digits); });
    if (!missing.length) { letters[acc] = "Вор уже знает весь код — твоё письмо не нужно. Помогай ему на суде."; return letters; }
    var pos = missing[0], d = st.code[+pos - 1];
    t.digits[pos] = d; a.digits[pos] = d;
    t.hints.push("Письмо от неизвестного друга: цифра №" + pos + " = " + d);
    a.hints.push("Ты тайно отправил вору цифру №" + pos + " = " + d);
    letters[th] = "Письмо от неизвестного друга: «Цифра №" + pos + " = " + d + "». Кто-то здесь на твоей стороне.";
    letters[acc] = "Ты подсмотрел цифру №" + pos + " = " + d + " и тайно отправил её вору. Он не знает, что это ты.";
    return letters;
  };

  // ---------- abilities ----------
  G.detectiveHint = function (st, i) { st.players[i].ability_used = true; return G.clearHint(st, i, "Способность"); };
  G.spyPeek = function (st, i, k) {
    st.players[i].ability_used = true;
    var e = G.lot(st, k);
    var text = "Конверт " + (k + 1) + ": «" + e[0] + "». " + e[3] + (e[2] ? " (" + e[2] + " ₽)" : "");
    st.players[i].hints.push("Подсмотрел: " + text);
    return text;
  };
  // Notary's ability: learn what was sold in guaranteed deal k.
  G.notaryPeek = function (st, i, k) {
    st.players[i].ability_used = true;
    var d = st.notary_book[k], text = G.name(st, d.seller) + " → " + G.name(st, d.buyer) + ": " + d.what;
    st.players[i].hints.push("Нотариус: " + text);
    return text;
  };

  G.aferistCancel = function (st, i) {
    var p = st.players[i];
    var refund = Math.min(p.last_fine, C.AFERIST_CANCEL_MAX);
    p.ability_used = true;
    p.last_fine = 0;
    p.secret_pending += refund;   // secretly, at the count: taking money from the bank in public gave the role away
    return refund;
  };

  // ---------- scoring ----------
  G.paySecretBonuses = function (st) {
    var lines = G.payCourt(st), cut = G.rulesOf(st).ACCOMPLICE_CUT || 0, th = G.thief(st);
    if (cut && st.safe_opened_by === th && G.hasRole(st, ACCOMPLICE)) {
      var acc = G.roleIndex(st, ACCOMPLICE);
      var paid = G.transfer(st, th, acc, cut);
      lines.push(G.name(st, th) + " → " + G.name(st, acc) + ": " + paid + " ₽ (доля сообщника из сейфа)");
    }
    st.players.forEach(function (p, i) {
      if (p.secret_pending) {
        G.bankPay(st, i, p.secret_pending, "(тайные выплаты)");
        lines.push(p.name + ": +" + p.secret_pending + " ₽ (тайные выплаты)");
        p.secret_pending = 0;
      }
    });
    return lines;
  };
  // Every condition with the player's numbers: [done, text]. See mission_checks in game/scoring.py.
  G.missionChecks = function (st, i) {
    var p = st.players[i], R = G.rulesOf(st), out = [], n1 = st.players.length - 1, k, need;
    function add(ok, yes, no) { out.push([!!ok, ok ? yes : no]); }
    function moneyGoal(m) { add(p.balance >= m, "денег " + p.balance + " ₽ — нужно от " + m + " ₽", "меньше " + m + " ₽"); }
    if (p.role === THIEF) {
      add(st.safe_opened_by === i, "вскрыл сейф", "не вскрыл сейф");
    } else if (p.role === DETECTIVE) {
      k = p.hints.length; need = R.DETECTIVE_MIN_HINTS;
      add(k >= need, "подсказок " + k + " из " + need, "подсказок " + k + " из " + need);
      add(p.vote === G.thief(st), "на суде назвал вора", "на суде назван не вор");
    } else if (p.role === SPY) {
      k = new Set(p.deal_partners).size;
      add(k >= 2, "сделки с разными игроками: " + k, "нет сделок с двумя разными игроками");
      moneyGoal(R.SPY_MIN);
    } else if (p.role === AFERIST) {
      moneyGoal(R.AFERIST_MIN);
      add(p.auctions_won >= 1, "выиграл лотов: " + p.auctions_won, "не выиграл ни одного лота");
      add(p.deal_partners.length, "сделок: " + p.deal_partners.length, "нет ни одной сделки");
    } else if (p.role === ACCOMPLICE) {
      k = G.guessedBy(st, G.thief(st));
      add(!G.exposed(st, G.thief(st)), "вора не разгадали (" + k + " из " + n1 + ")", "вора разгадали на суде (" + k + " из " + n1 + ")");
      moneyGoal(R.ACCOMPLICE_MIN);
    } else if (p.role === NOTARY) {
      k = (st.notary_book || []).length; need = R.NOTARY_DEALS;
      add(k >= need, "сделок с гарантией " + k + " из " + need, "сделок с гарантией " + k + " из " + need);
      moneyGoal(R.NOTARY_MIN);
      add(p.deal_partners.length, "своих сделок: " + p.deal_partners.length, "нет ни одной своей сделки");
    }
    if (p.role === THIEF || R.GUESS_ROLES !== false) {   // 3 players: only the thief can be «exposed»
      k = G.guessedBy(st, i);
      add(!G.exposed(st, i), "не разгадан: роль назвали " + k + " из " + n1, "разгадан на суде: роль назвали " + k + " из " + n1);
    }
    return out;
  };
  G.checkMission = function (st, i) {
    return G.missionChecks(st, i).filter(function (c) { return !c[0]; }).map(function (c) { return c[1]; });
  };
  G.finalResults = function (st) {
    var res = st.players.map(function (p, i) {
      var miss = G.checkMission(st, i), done = !miss.length;
      return { index: i, name: p.name, role: p.role, money: p.balance, mission: done, reasons: miss,
        total: p.balance + (done ? C.MISSION_BONUS : 0), clues: p.clues, place: 0, tie: false };
    });
    res.sort(function (a, b) { return b.total - a.total || b.clues - a.clues; });
    res.forEach(function (r) {
      r.tie = res.filter(function (x) { return x.total === r.total && x.clues === r.clues; }).length > 1;
      r.place = 1 + res.filter(function (x) { return x.total > r.total || (x.total === r.total && x.clues > r.clues); }).length;
    });
    return res;
  };

  root.G = G;
  if (typeof module !== "undefined") module.exports = G;
})(typeof window !== "undefined" ? window : globalThis);
