// Game state and rules: a port of game/state.py + game/scoring.py. No DOM here.
// State is a plain object (saved as JSON in localStorage); functions take it as the first argument.
(function (root) {
  var D = root.DATA || (typeof require !== "undefined" ? require("./data.js") : null);
  var C = D.C;
  var THIEF = "thief", DETECTIVE = "detective", SPY = "spy", AFERIST = "aferist", ACCOMPLICE = "accomplice";
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
    return r;
  }
  function rolesFor(n, rng) {
    if (n === 3) return [THIEF, DETECTIVE, choice(rng, [SPY, AFERIST])];
    if (n === 5) return D.ROLE_IDS.concat([ACCOMPLICE]);
    return D.ROLE_IDS.slice();
  }

  function newPlayer(name, role) {
    return { name: name, role: role, balance: C.START_MONEY, clues: 0, fragments: 0, ability_used: false,
      suspect: null, vote: null, auctions_won: 0, deal_partners: [], last_fine: 0, secret_pending: 0,
      commissions: 0, hints: [], cleared: [], pairs: [], digits: {}, safe_tried: false, duel_cards: 0,
      shields: 0, double_vote: false };
  }

  var G = {
    D: D, C: C, THIEF: THIEF, DETECTIVE: DETECTIVE, SPY: SPY, AFERIST: AFERIST, ACCOMPLICE: ACCOMPLICE,
    FINAL_ROUND: FINAL_ROUND, seeded: seeded, choice: choice, sample: sample, shuffle: shuffle,
    randrange: randrange, range: range, fmt: fmt, rules: rules, rolesFor: rolesFor,
  };

  // ---------- setup ----------
  G.create = function (names, rng) {
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
      court_done: false, thief_caught: false, court_verdict: "", trial_done: false, fragment_step: 0,
      final_paid: false, spot_ids: sample(rng, range(D.SPOTS.length), C.TOTAL_CLUES + 2),
      alibi_places: [], alibi_true: 0, alibi_known: {}, alibi_answers: {}, forgetful: null,
      fake_armed: false, fake_given_to: null, timer_left: 0, log: [],
    };
    G.makeAlibis(st, rng);
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
  G.alibiMismatch = function (st) {
    var keys = Object.keys(st.alibi_answers);
    if (!keys.length) return [];
    var votes = {};
    keys.forEach(function (i) { var v = st.alibi_answers[i]; votes[v] = (votes[v] || 0) + 1; });
    var top = Math.max.apply(null, Object.values(votes));
    var common = Object.keys(votes).filter(function (k) { return votes[k] === top; });
    if (common.length > 1) return [];
    return keys.filter(function (i) { return String(st.alibi_answers[i]) !== common[0]; }).map(Number);
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
    if (fine && p.shields > 0) {
      p.shields -= 1;
      G.note(st, p.name + ": штраф " + amount + " ₽ отменён страховкой");
      return 0;
    }
    var paid = Math.min(amount, p.balance);
    p.balance -= paid;
    if (fine) p.last_fine = paid;
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
    var owed = st.ious.reduce(function (s, x) { return s + x[1]; }, 0);
    return st.bank + st.prize_in_safe + st.players.reduce(function (s, p) { return s + p.balance; }, 0) - owed;
  };

  // ---------- rounds ----------
  G.nextRound = function (st) {
    if (st.round_index >= FINAL_ROUND) return;
    st.round_index += 1;
    st.current_event = null;
    st.event_applied = false;
    if (st.round_index <= D.MAX_ROUND) {
      st.timer_left = G.round(st).minutes * 60;
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
      lines.push(paid ? "Отдай банку " + paid + " ₽." : "Штраф отменён твоей страховкой!");
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
  G.recordDeal = function (st, seller, buyer, price, item, digitPos) {
    var s = st.players[seller], b = st.players[buyer];
    item = item || "что-то";
    s.deal_partners.push(buyer);
    b.deal_partners.push(seller);
    var paid = price > 0 ? G.transfer(st, buyer, seller, price) : 0;
    if (digitPos && digitPos in s.digits) b.digits[digitPos] = s.digits[digitPos];
    var story = s.name + " продаёт " + item + " → " + b.name + (paid ? ", " + paid + " ₽" : ", без денег");
    G.note(st, "Сделка: " + story);
    [seller, buyer].forEach(function (i) {
      var p = st.players[i];
      if (p.role === AFERIST && p.commissions < C.AFERIST_COMMISSION_MAX) {
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
    if (card) {
      st.players[a].duel_cards -= 1;
      G.bankPay(st, win, C.DUEL_PRIZE, "(дуэль)");
    } else {
      st.players[a].ability_used = true;
      if (win === a) G.bankPay(st, a, C.DUEL_PRIZE, "(дуэль)");
    }
    return win;
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
      G.note(st, p.name + " вскрыл(а) сейф: +" + st.prize_in_safe + " ₽");
      st.prize_in_safe = 0;
      return true;
    }
    G.note(st, p.name + ": неверный код, сработала сигнализация");
    return false;
  };

  // ---------- round 6: court ----------
  G.votesAgainst = function (st, i) { return st.players.filter(function (p) { return p.vote === i; }).length; };
  G.setVotes = function (st, votes) {
    Object.keys(votes).forEach(function (i) { st.players[i].vote = votes[i]; });
    var th = G.thief(st), R = G.rulesOf(st), right = 0, wrong = 0, verdict;
    Object.keys(votes).forEach(function (i) {
      var w = st.players[i].double_vote ? 2 : 1;
      if (votes[i] === th) right += w; else wrong += w;
    });
    if (right > wrong) {
      st.thief_caught = true;
      var det = G.roleIndex(st, DETECTIVE), fine = R.CAUGHT_FINE;
      var paid = G.transfer(st, th, det, fine);
      if (paid < fine) G.bankPay(st, det, fine - paid, "(суд)");
      verdict = "Большинство угадало вора! Вор платит детективу " + fine + " ₽.";
    } else if (wrong > right) {
      var bonus = R.THIEF_FREE_BONUS;
      if (bonus) {
        G.bankPay(st, th, bonus, "(суд)");
        verdict = "Большинство ошиблось. " + bonus + " ₽ из банка получает вор.";
      } else verdict = "Большинство ошиблось. Вор ушёл от суда.";
    } else verdict = "Голоса разделились поровну. Бонус не получает никто.";
    var lucky = range(st.players.length).filter(function (i) { return st.players[i].suspect === th; });
    lucky.forEach(function (i) { G.bankPay(st, i, C.SUSPECT_REWARD, "(верное подозрение)"); });
    if (lucky.length)
      verdict += " Вора угадали ещё в раунде 1 (+300 ₽): " + lucky.map(function (i) { return G.name(st, i); }).join(", ") + ".";
    if (st.players.some(function (p) { return p.double_vote; }))
      verdict += " (Голос с картой «присяжного» считался за два.)";
    st.court_done = true;
    st.court_verdict = verdict;
    G.note(st, "Суд: " + verdict);
    return verdict;
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
  G.accomplicePeek = function (st, i) { st.players[i].ability_used = true; return G.digitHint(st, i); };
  G.aferistCancel = function (st, i) {
    var p = st.players[i];
    var refund = Math.min(p.last_fine, C.AFERIST_CANCEL_MAX);
    p.ability_used = true;
    p.last_fine = 0;
    if (refund) G.bankPay(st, i, refund, "");
    return refund;
  };

  // ---------- scoring ----------
  G.paySecretBonuses = function (st) {
    var lines = [], cut = G.rulesOf(st).ACCOMPLICE_CUT || 0, th = G.thief(st);
    if (cut && st.safe_opened_by === th && G.hasRole(st, ACCOMPLICE)) {
      var acc = G.roleIndex(st, ACCOMPLICE);
      var paid = G.transfer(st, th, acc, cut);
      lines.push(G.name(st, th) + " → " + G.name(st, acc) + ": " + paid + " ₽ (доля сообщника из сейфа)");
    }
    st.players.forEach(function (p, i) {
      if (p.secret_pending) {
        G.bankPay(st, i, p.secret_pending, "(тайный бонус роли)");
        lines.push(p.name + ": +" + p.secret_pending + " ₽ (тайный бонус роли)");
        p.secret_pending = 0;
      }
    });
    return lines;
  };
  G.checkMission = function (st, i) {
    var p = st.players[i], R = G.rulesOf(st), miss = [];
    if (p.role === THIEF) {
      if (st.safe_opened_by !== i) miss.push("не вскрыл сейф");
      if (st.thief_caught) miss.push("пойман на суде");
    } else if (p.role === DETECTIVE) {
      if (p.hints.length < R.DETECTIVE_MIN_HINTS) miss.push("подсказок " + p.hints.length + " из " + R.DETECTIVE_MIN_HINTS);
      if (p.vote !== G.thief(st)) miss.push("на суде назван не вор");
    } else if (p.role === SPY) {
      if (new Set(p.deal_partners).size < 2) miss.push("нет сделок с двумя разными игроками");
      if (p.balance < R.SPY_MIN) miss.push("меньше " + R.SPY_MIN + " ₽");
      var va = G.votesAgainst(st, i);
      if (va > C.SPY_MAX_VOTES) miss.push("на суде за шпиона голосовали " + va + " чел.");
    } else if (p.role === AFERIST) {
      if (p.balance < R.AFERIST_MIN) miss.push("меньше " + R.AFERIST_MIN + " ₽");
      if (p.auctions_won < 1) miss.push("не выиграл ни одного лота");
      if (!p.deal_partners.length) miss.push("нет ни одной сделки");
    } else if (p.role === ACCOMPLICE) {
      if (st.thief_caught) miss.push("вора поймали на суде");
      if (p.balance < R.ACCOMPLICE_MIN) miss.push("меньше " + R.ACCOMPLICE_MIN + " ₽");
    }
    return miss;
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
