// Screens of the phone version. Port of ui/app.py: same scenes on a stack, same flow.
// Secret things are shown only through PrivateScene: "pass the phone → open → hide".
(function () {
  "use strict";
  var D = DATA, C = D.C;
  var THIEF = G.THIEF, DETECTIVE = G.DETECTIVE, SPY = G.SPY, AFERIST = G.AFERIST, ACCOMPLICE = G.ACCOMPLICE;
  var SAVE_KEY = "ten.current", BACKUP_KEY = "ten.backup", NAMES_KEY = "ten.names";
  var PROMPT_EVERY = 70;
  var SITE_URL = "https://aipanov.github.io/ten/";   // shown in the single-file version

  // ===================================================================== tiny DOM helpers
  function h(tag, props) {
    var el = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "html") el.innerHTML = v;
      else if (k === "style") el.style.cssText = v;
      else if (k.slice(0, 2) === "on") el[k] = v;
      else el.setAttribute(k, v === true ? "" : v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, kid) {
    if (kid === null || kid === undefined || kid === false) return;
    if (Array.isArray(kid)) { kid.forEach(function (k) { add(el, k); }); return; }
    el.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  function money(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽"; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); }
  function rules() { return G.rulesOf(A.st); }

  function btn(label, fn, o) {
    o = o || {};
    var b = h("button", { type: "button", class: "btn " + (o.kind || "") + " " + (o.cls || "") }, label);
    if (o.disabled) b.disabled = true;
    b.onclick = function () {
      Sound.unlock();
      Sound.play("click");
      if (fn) fn();
      A.save();
      renderSoon();
    };
    return b;
  }
  function card(title, body, o) {
    o = o || {};
    return h("div", { class: "card " + (o.cls || "warm") },
      (title || o.icon) ? h("div", { class: "head" }, o.icon ? icon(o.icon, 36) : null, h("div", { class: "label" }, title)) : null,
      body);
  }
  function rule() { return h("div", { class: "rule" }, h("i")); }
  function bar() { return h("div", { class: "bar" }, h("div", { class: "inner" }, Array.prototype.slice.call(arguments))); }

  // ===================================================================== art (SVG)
  var GOLD = "#d6b048";
  var ICONS = {
    magnifier: '<circle cx="20" cy="20" r="12"/><line x1="29" y1="29" x2="42" y2="42" stroke-width="6" stroke-linecap="round"/>',
    envelope: '<rect x="5" y="11" width="38" height="26" rx="3"/><polyline points="5,12 24,27 43,12"/>',
    safe: '<rect x="6" y="6" width="36" height="36" rx="4"/><circle cx="23" cy="24" r="9"/><line x1="23" y1="15" x2="23" y2="20"/><line x1="38" y1="18" x2="38" y2="30" stroke-width="4"/>',
    scales: '<line x1="24" y1="6" x2="24" y2="41"/><line x1="9" y1="12" x2="39" y2="12"/><line x1="15" y1="42" x2="33" y2="42"/><path d="M3 27 L9 12 L15 27 Z M33 27 L39 12 L45 27 Z"/>',
    eye: '<path d="M3 24 Q24 5 45 24 Q24 43 3 24 Z"/><circle cx="24" cy="24" r="6" fill="currentColor"/>',
    handshake: '<path d="M6 17 H38 M31 10 L38 17 L31 24"/><path d="M42 31 H10 M17 24 L10 31 L17 38"/>',
    coin: '<circle cx="24" cy="24" r="17"/><path d="M19 34 V14 H27 A6 6 0 0 1 27 26 H16 M16 30 H27"/>',
    mask: '<path d="M4 16 Q24 10 44 16 Q44 32 32 32 Q27 32 24 27 Q21 32 16 32 Q4 32 4 16 Z"/><ellipse cx="15" cy="21" rx="4" ry="3" fill="currentColor"/><ellipse cx="33" cy="21" rx="4" ry="3" fill="currentColor"/>',
  };
  function icon(name, size, color) {
    return h("span", { style: "display:inline-flex;color:" + (color || GOLD), html:
      '<svg width="' + size + '" height="' + size + '" viewBox="0 0 48 48" fill="none" stroke="currentColor" ' +
      'stroke-width="3" stroke-linejoin="round">' + (ICONS[name] || "") + "</svg>" });
  }
  function fedora(size, fill, rim) {
    fill = fill || "#08060a"; rim = rim || GOLD;
    return h("span", { style: "display:inline-flex", html:
      '<svg width="' + size + '" height="' + size + '" viewBox="0 0 100 100">' +
      '<polygon fill="' + fill + '" points="19,88 29,61 41,57 50,65 59,57 71,61 81,88"/>' +
      '<ellipse fill="' + fill + '" cx="50" cy="46" rx="10.5" ry="12.5"/>' +
      '<polygon fill="' + fill + '" points="36.5,35 39,19 50,22 61,19 63.5,35"/>' +
      '<ellipse fill="' + fill + '" cx="50" cy="35" rx="24" ry="4.5"/>' +
      '<line x1="37" y1="32.5" x2="63" y2="32.5" stroke="' + rim + '" stroke-width="2.5"/>' +
      '<path d="M27 36 Q50 43 73 36" stroke="' + rim + '" stroke-width="1.5" fill="none"/></svg>' });
  }
  function painting(width) {
    return h("img", { class: "painting", src: window.MONA_SRC || "mona_lisa.jpg", alt: "Мона Лиза",
      width: width, height: Math.round(width * 700 / 469), style: "width:" + width + "px;height:auto" });
  }
  var PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  function die(value, cls) {
    var el = h("div", { class: "die " + (cls || "") });
    for (var k = 0; k < 9; k++) el.appendChild(h("i", { class: value && PIPS[value].indexOf(k) >= 0 ? "on" : "" }));
    return el;
  }
  function logo() {
    return h("div", { class: "logo" }, h("div", { class: "word" }, "ТЕНЬ"),
      h("div", { class: "sub" }, "ПОСЛЕДНИЙ МИЛЛИОН"), rule());
  }

  // ===================================================================== app core
  function Scene() {}
  Scene.prototype.modal = false;
  Scene.prototype.render = function () { return h("div"); };
  Scene.prototype.back = function () { if (this.modal && this.cancellable !== false) A.pop(); };
  function inherit(Child, props) {
    Child.prototype = Object.create(Scene.prototype);
    Child.prototype.constructor = Child;
    Object.keys(props || {}).forEach(function (k) { Child.prototype[k] = props[k]; });
    return Child;
  }

  var A = {
    st: null, stack: [], toasts: [], installEvt: null, wake: null, scrollTop: false,
    push: function (s) { this.stack.push(s); if (!s.modal) this.scrollTop = true; renderSoon(); },
    pop: function () { this.stack.pop(); renderSoon(); },
    reset: function (s) { Sound.stopLoop(); this.stack = [s]; this.scrollTop = true; renderSoon(); },
    top: function () { return this.stack[this.stack.length - 1]; },
    save: function () {
      if (!this.st) return;
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.st)); } catch (e) { /* storage full or blocked */ }
    },
    toast: function (msg, color, seconds) { this.toasts.push({ msg: msg, color: color || "gold", seconds: seconds || 4, shown: null }); },
    hub: function () { for (var i = 0; i < this.stack.length; i++) if (this.stack[i] instanceof HubScene) return this.stack[i]; return null; },
  };
  function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }

  var pending = false;
  function renderSoon() {
    if (pending) return;
    pending = true;
    Promise.resolve().then(function () { pending = false; render(); });
  }
  var lastTop = null;
  function render() {
    var root = document.getElementById("app");
    var y = window.scrollY, sheet = root.querySelector(".sheet"), sy = sheet ? sheet.scrollTop : 0;
    var start = A.stack.length - 1;
    while (start > 0 && A.stack[start].modal) start--;
    var base = A.stack[start], top = A.top();
    root.innerHTML = "";
    root.appendChild(base.render());
    if (top !== base) {
      var fresh = top !== lastTop ? " fresh" : "";
      root.appendChild(h("div", { class: "veil" + fresh, onclick: function () { top.back(); } }));
      var sh = h("div", { class: "sheet" + fresh }, top.render());
      root.appendChild(h("div", { class: "sheet-wrap" }, sh));
      if (top === lastTop) sh.scrollTop = sy;
    }
    if (A.scrollTop) { window.scrollTo(0, 0); A.scrollTop = false; } else window.scrollTo(0, y);
    lastTop = top;
    drawToast(true);
  }

  function drawToast(force) {
    var old = document.getElementById("toast");
    var now = Date.now();
    A.toasts = A.toasts.filter(function (t) { return t.shown === null || now - t.shown < t.seconds * 1000; }).slice(-3);
    var show = A.toasts.length && A.top() instanceof HubScene ? A.toasts[0] : null;
    if (show && show.shown === null) { show.shown = now; force = true; }
    if (!force && old && show && old.dataset.msg === show.msg) return;
    if (old) old.remove();
    if (show) {
      var el = h("div", { id: "toast", class: "toast " + (show.color === "red" ? "red" : "") }, show.msg);
      el.dataset.msg = show.msg;
      document.body.appendChild(el);
    }
  }

  function keepAwake() {
    if (!("wakeLock" in navigator) || A.wake || document.visibilityState !== "visible") return;
    navigator.wakeLock.request("screen").then(function (w) {
      A.wake = w;
      w.addEventListener("release", function () { A.wake = null; });
    }).catch(function () { /* not allowed: fine */ });
  }

  // ===================================================================== small dialogs
  var MessageDialog = inherit(function (title, body, then, ic) {
    this.title = title; this.body = body; this.then = then; this.ic = ic;
  }, {
    modal: true,
    close: function () { A.pop(); if (this.then) this.then(); },
    back: function () { this.close(); },
    render: function () {
      var self = this;
      return h("div", null, h("h2", null, this.ic ? icon(this.ic, 32) : null, this.title),
        h("p", { class: "pre" }, this.body),
        h("div", { class: "actions" }, btn("Понятно", function () { self.close(); }, { kind: "accent" })));
    },
  });

  var ConfirmDialog = inherit(function (title, body, onYes, yes) {
    this.title = title; this.body = body; this.onYes = onYes; this.yes = yes || "Да";
  }, {
    modal: true,
    render: function () {
      var self = this;
      return h("div", null, h("h2", null, this.title), h("p", { class: "pre" }, this.body),
        h("div", { class: "actions" }, btn("Отмена", function () { A.pop(); }, { kind: "ghost" }),
          btn(this.yes, function () { A.pop(); self.onYes(); }, { kind: "accent" })));
    },
  });

  var PickDialog = inherit(function (title, options, onPick) {
    this.title = title; this.options = options; this.onPick = onPick;
  }, {
    modal: true,
    render: function () {
      var self = this;
      return h("div", null, h("h2", null, this.title),
        h("div", { class: "grid2" }, this.options.map(function (o) {
          return btn(o[0], function () { A.pop(); self.onPick(o[1]); }, { kind: "big" });
        })),
        h("div", { class: "actions" }, btn("Отмена", function () { A.pop(); }, { kind: "ghost" })));
    },
  });

  var TurnTimer = inherit(function (title, seconds, names, note) {
    this.title = title; this.total = seconds; this.names = names; this.note = note || "";
    this.idx = 0; this.left = seconds; this.running = true; this.lastTick = seconds;
    Sound.play("chime");
  }, {
    modal: true,
    update: function (dt) {
      if (!this.running) return;
      this.left = Math.max(0, this.left - dt);
      var sec = Math.ceil(this.left);
      if (sec !== this.lastTick && sec <= 5) Sound.play("tick");
      this.lastTick = sec;
      var el = document.getElementById("tt-sec");
      if (el) { el.textContent = sec; el.className = "tt-sec " + (sec <= 5 ? "red" : ""); }
      if (this.left === 0) { this.nextPlayer(); renderSoon(); }
    },
    nextPlayer: function () {
      this.idx += 1;
      if (this.idx >= this.names.length) { this.running = false; Sound.play("timeup"); return; }
      this.left = this.total;
      Sound.play("chime");
    },
    render: function () {
      var self = this, done = this.idx >= this.names.length;
      return h("div", { class: "center stack" }, h("h2", { style: "justify-content:center" }, this.title),
        this.note ? h("p", { class: "muted" }, this.note) : null,
        done ? h("h1", { style: "margin:30px 0" }, "Все высказались!") : [
          h("p", { class: "muted" }, "Сейчас говорит"),
          h("div", { class: "pass" , style: "min-height:0" }, h("div", { class: "who" }, this.names[this.idx])),
          h("div", { id: "tt-sec", class: "tt-sec" }, Math.ceil(this.left)),
          h("p", { class: "muted" }, (this.idx + 1) + " из " + this.names.length),
          h("div", { class: "row" },
            btn(this.running ? "Пауза" : "Дальше", function () { self.running = !self.running; }, { kind: "accent" }),
            btn("Следующий", function () { self.nextPlayer(); })),
        ],
        btn("Закрыть", function () { A.pop(); }, { kind: "ghost" }));
    },
  });

  function howToWin() {
    return h("div", { class: "stack" },
      h("h2", null, "Как играть и как выиграть"),
      D.HOW_TO_WIN.map(function (t) {
        return h("div", null, h("div", { class: "label" }, t[0]), h("p", null, t[1]));
      }),
      h("div", { class: "label", style: "margin-top:18px" }, "Раунды"),
      D.ROUND_MAP.map(function (r) {
        return h("div", { class: "row", style: "align-items:flex-start" },
          h("div", { style: "flex:none" }, icon(D.ROUNDS[+r[0]].icon, 30)),
          h("div", { style: "flex:1" }, h("b", null, r[0] + ". " + r[1]), h("p", { class: "muted small" }, r[2])));
      }));
  }
  var RulesDialog = inherit(function () {}, {
    modal: true,
    render: function () {
      return h("div", null, howToWin(), h("div", { class: "actions" }, btn("Закрыть", function () { A.pop(); }, { kind: "accent" })));
    },
  });

  // ===================================================================== dice
  var RollsDialog = inherit(function (title, rows, onDone, o) {
    o = o || {};
    this.title = title; this.rows = rows; this.onDone = onDone;
    this.uniqueTop = !!o.uniqueTop; this.note = o.note || ""; this.cancellable = o.cancellable !== false;
    this.rolls = {}; this.anim = {};
  }, {
    modal: true,
    roll: function (key) { this.anim[key] = Date.now() + 700; delete this.rolls[key]; Sound.play("dial"); },
    rollAll: function () { var self = this; this.rows.forEach(function (r) { if (!(r[0] in self.rolls)) self.roll(r[0]); }); },
    update: function () {
      var self = this, now = Date.now(), any = false;
      Object.keys(this.anim).forEach(function (k) {
        any = true;
        if (now >= self.anim[k]) { delete self.anim[k]; self.rolls[k] = 1 + G.randrange(null, 6); }
      });
      if (any && A.top() === this) renderSoon();
    },
    tied: function () {
      var vals = Object.keys(this.rolls);
      if (!this.uniqueTop || vals.length < this.rows.length || Object.keys(this.anim).length) return [];
      var self = this, top = Math.max.apply(null, vals.map(function (k) { return self.rolls[k]; }));
      var t = vals.filter(function (k) { return self.rolls[k] === top; });
      return t.length > 1 ? t : [];
    },
    ready: function () {
      return Object.keys(this.rolls).length === this.rows.length && !Object.keys(this.anim).length && !this.tied().length;
    },
    render: function () {
      var self = this, t = this.tied();
      return h("div", null, h("h2", null, this.title),
        this.note ? h("p", { class: "muted small" }, this.note) : null,
        this.rows.map(function (r) {
          var k = String(r[0]), rolling = k in self.anim;
          return h("div", { class: "roll-row" }, h("div", { class: "nm" }, r[1]),
            rolling ? die(1 + G.randrange(null, 6), "roll") : (k in self.rolls ? die(self.rolls[k]) : die(0, "empty")),
            btn("Бросить", function () { self.roll(k); }, { cls: "slim" }),
            h("div", { class: "pips" }, h("span", { class: "muted small", style: "align-self:center;margin-right:4px" }, "или:"),
              [1, 2, 3, 4, 5, 6].map(function (v) {
                return btn(String(v), function () { delete self.anim[k]; self.rolls[k] = v; },
                  { kind: self.rolls[k] === v && !rolling ? "selected" : "" });
              })));
        }),
        t.length ? h("p", { class: "red", style: "margin-top:10px" }, "Ничья: " + this.rows.filter(function (r) {
          return t.indexOf(String(r[0])) >= 0; }).map(function (r) { return r[1]; }).join(", ") + ". Перебросьте.") : null,
        h("div", { class: "actions" },
          t.length ? btn("Сбросить ничью", function () { t.forEach(function (k) { delete self.rolls[k]; }); }) :
            [this.cancellable ? btn("Отмена", function () { A.pop(); }, { kind: "ghost" }) : null,
              this.rows.length > 1 ? btn("Бросить всем", function () { self.rollAll(); }) : null],
          btn("Готово", function () {
            var res = {};
            Object.keys(self.rolls).forEach(function (k) { res[k] = self.rolls[k]; });
            A.pop(); self.onDone(res);
          }, { kind: "accent", disabled: !this.ready() })));
    },
  });

  // ===================================================================== transactions
  var TX_TITLES = { money: "Деньги", deal: "Сделка", contract: "Секретный контракт", auction: "Аукцион", duel: "Дуэль кубиков" };
  var TX_ICONS = { money: "coin", deal: "handshake", contract: "handshake", auction: "envelope" };
  var TxDialog = inherit(function (mode, onOk, o) {
    o = o || {};
    this.mode = mode; this.onOk = onOk; this.lot = o.lot || 0; this.sub = "bank_pay";
    this.a = null; this.b = null; this.amount = mode === "auction" ? C.AUCTION_START : 0;
    this.item = o.item || D.DEAL_ITEMS[0]; this.honest = false; this.pos = null;
  }, {
    modal: true,
    needsB: function () { return ["deal", "contract", "duel"].indexOf(this.mode) >= 0 || (this.mode === "money" && this.sub === "transfer"); },
    needsAmount: function () { return ["money", "deal", "auction"].indexOf(this.mode) >= 0; },
    labels: function () {
      if (this.mode === "money") return { bank_pay: ["Кому банк платит", ""], pay_bank: ["Кто платит банку", ""], transfer: ["Кто платит", "Кому"] }[this.sub];
      return { deal: ["Кто ПРОДАЁТ", "Кто ПОКУПАЕТ (платит)"], contract: ["Игрок 1", "Игрок 2"],
        auction: ["Кто дал больше всех", ""], duel: ["Кто вызывает", "Кого вызывают"] }[this.mode];
    },
    payer: function () {
      if (this.mode === "deal") return this.b;
      if (this.mode === "money" && this.sub === "bank_pay") return null;
      return this.a;
    },
    digitDeal: function () { return this.mode === "deal" && this.item === "цифру кода"; },
    valid: function () {
      var st = A.st;
      if (this.a === null) return false;
      if (this.needsB() && (this.b === null || this.b === this.a)) return false;
      var pay = this.payer(), bal = pay !== null ? st.players[pay].balance : 1e9;
      if (this.mode === "money") return this.amount > 0 && (this.sub !== "transfer" || this.amount <= bal);
      if (this.mode === "deal") {
        if (this.digitDeal() && this.honest && this.pos === null) return false;
        return this.amount <= bal;
      }
      if (this.mode === "auction") return this.amount >= C.AUCTION_START && this.amount <= bal;
      return true;
    },
    ok: function () {
      var st = A.st, a = this.a, b = this.b, amt = this.amount;
      A.pop();
      if (this.mode === "money") {
        var msg;
        if (this.sub === "bank_pay") { G.bankPay(st, a, amt); msg = "Банк → " + G.name(st, a) + ": " + money(amt); }
        else if (this.sub === "pay_bank") { G.payBank(st, a, amt, "", true); msg = G.name(st, a) + " отдаёт в банк " + money(amt) + "."; }
        else { G.transfer(st, a, b, amt); msg = G.name(st, a) + " → " + G.name(st, b) + ": " + money(amt); }
        A.toast(msg);
      } else if (this.mode === "deal") {
        var pos = this.digitDeal() && this.honest ? this.pos : null;
        var story = G.recordDeal(st, a, b, amt, this.item, pos);
        Sound.play("cash");
        A.push(new DealAnnounce(story, amt));
        if (pos) {
          var d = st.players[b].digits[pos];
          A.push(new PrivateScene("Честная цифра", [b], renderMessage("Цифра кода",
            "Продавец: " + G.name(st, a) + ". Передано честно:\n\nЦифра №" + pos + " = " + d), null, false));
        }
      } else if (this.mode === "auction") this.onOk(this.lot, a, amt);
      else if (this.onOk) this.onOk(a, b);
      A.save();
    },
    playerRow: function (label, attr) {
      var self = this;
      return h("div", { style: "margin-top:12px" }, h("div", { class: "muted small", style: "margin-bottom:6px" }, label),
        h("div", { class: "chips" }, A.st.players.map(function (p, i) {
          return btn(h("span", null, p.name, h("small", null, money(p.balance))), function () { self[attr] = i; },
            { kind: self[attr] === i ? "selected" : "", cls: "col" });
        })));
    },
    render: function () {
      var self = this, st = A.st, lab = this.labels();
      var title = this.mode === "auction" ? "Конверт " + (this.lot + 1) + " продан" : TX_TITLES[this.mode];
      var pay = this.payer();
      return h("div", null,
        h("h2", null, TX_ICONS[this.mode] ? icon(TX_ICONS[this.mode], 30) : null, title),
        this.mode === "money" ? h("div", { class: "grid3" }, [["bank_pay", "Банк платит игроку"], ["pay_bank", "Игрок платит банку"],
          ["transfer", "Игрок → игрок"]].map(function (s) {
          return btn(s[1], function () { self.sub = s[0]; }, { kind: self.sub === s[0] ? "selected" : "", cls: "slim" });
        })) : null,
        this.mode === "deal" ? h("div", null, h("div", { class: "muted small", style: "margin-bottom:6px" }, "Что продаёт"),
          h("div", { class: "chips" }, D.DEAL_ITEMS.map(function (it) {
            return btn(it, function () { self.item = it; }, { kind: self.item === it ? "selected" : "", cls: "slim" });
          }))) : null,
        this.playerRow(lab[0], "a"),
        this.needsB() ? this.playerRow(lab[1], "b") : null,
        this.digitDeal() ? h("div", { style: "margin-top:12px" },
          btn((this.honest ? "☑ " : "☐ ") + "Честно — через телефон", function () { self.honest = !self.honest; },
            { kind: this.honest ? "selected" : "", cls: "slim" }),
          this.honest && this.a !== null ? (function () {
            var known = Object.keys(st.players[self.a].digits).sort();
            if (!known.length) return h("p", { class: "red small", style: "margin-top:6px" }, "Продавец не знает ни одной цифры");
            return h("div", { class: "chips", style: "margin-top:8px" }, known.map(function (pos) {
              return btn("цифра №" + pos, function () { self.pos = pos; }, { kind: self.pos === pos ? "selected" : "", cls: "slim" });
            }));
          })() : h("p", { class: "muted small", style: "margin-top:6px" }, "Без галочки цифру говорят вслух — можно соврать.")) : null,
        this.needsAmount() ? h("div", { style: "margin-top:14px" },
          h("div", { class: "muted small" }, { deal: "Цена (0 — без денег)", auction: "Его ставка" }[this.mode] || "Сумма"),
          h("div", { class: "amount" }, money(this.amount)),
          h("div", { class: "bills" }, C.BILLS.map(function (bill) {
            return btn("+" + bill, function () { self.amount += bill; });
          }), btn("Сброс", function () { self.amount = self.mode === "auction" ? C.AUCTION_START : 0; }, { kind: "ghost" })),
          pay !== null && this.amount > st.players[pay].balance ? h("p", { class: "red small", style: "margin-top:6px" },
            "Не хватает денег: " + G.name(st, pay)) : null) : null,
        h("div", { class: "actions" }, btn("Отмена", function () { A.pop(); }, { kind: "ghost" }),
          btn("Подтвердить", function () { self.ok(); }, { kind: "accent", disabled: !this.valid() })));
    },
  });

  var DealAnnounce = inherit(function (story, amount) { this.story = story; this.amount = amount; }, {
    modal: true,
    render: function () {
      return h("div", { class: "center stack" }, icon("handshake", 80), h("h1", null, "СДЕЛКА!"),
        h("p", { class: "big" }, this.story + "."),
        this.amount ? h("p", { class: "muted" }, "Передайте купюры из рук в руки.") : null,
        btn("Отлично", function () { A.pop(); }, { kind: "accent big" }));
    },
  });

  // ===================================================================== private screens
  var PrivateScene = inherit(function (title, players, renderFn, onDone, cancellable) {
    this.title = title; this.players = players; this.renderFn = renderFn; this.onDone = onDone;
    this.cancellable = cancellable !== false; this.idx = 0; this.phase = "pass"; this.results = {}; this.data = {};
  }, {
    current: function () { return this.players[this.idx]; },
    finish: function (value) {
      this.results[this.current()] = value === undefined ? null : value;
      this.idx += 1; this.phase = "pass"; this.data = {};
      A.scrollTop = true;
      if (this.idx >= this.players.length) {
        A.pop();
        if (this.onDone) this.onDone(this.results);
        A.save();
      }
    },
    back: function () {
      if (this.phase === "show") return;              // never drop a secret screen by accident
      if (this.cancellable && this.idx === 0) A.pop();
    },
    render: function () {
      var self = this, i = this.current(), name = G.name(A.st, i);
      if (this.phase === "pass") {
        return h("div", { class: "screen" }, h("div", { class: "pass" },
          fedora(140), h("p", { class: "muted" }, this.title),
          h("h3", null, "Передай телефон игроку"), h("div", { class: "who" }, name),
          h("p", { class: "muted" }, "Остальные — отвернитесь"),
          btn("Я — " + name + ". Открыть", function () { self.phase = "show"; A.scrollTop = true; }, { kind: "accent huge" }),
          this.players.length > 1 ? h("p", { class: "muted" }, (this.idx + 1) + " из " + this.players.length) : null,
          this.cancellable && this.idx === 0 ? btn("Отмена", function () { A.pop(); }, { kind: "ghost" }) : null));
      }
      return h("div", { class: "screen with-bar" }, h("div", { class: "private-head" }, name + " — только для тебя"),
        this.renderFn(this, i));
    },
  });

  function hideBar(scene, label) {
    return bar(btn(label || "Запомнил. Скрыть", function () { scene.finish(); }, { kind: "accent big" }));
  }

  function suspectBoard(i, title) {
    var st = A.st, p = st.players[i], th = G.thief(st);
    var cands = p.role !== THIEF ? G.candidates(st, i) : G.others(st, i);
    var cols = Math.min(st.players.length, 5);
    var cards = st.players.map(function (q, j) {
      if (j === i) return h("div", { class: "sus me" }, h("div", { class: "tag" }, "это ты"), fedora(44, "#46424e", "#9694a0"), h("div", { class: "nm" }, q.name));
      if (p.role === ACCOMPLICE && j === th)
        return h("div", { class: "sus thief" }, h("div", { class: "tag" }, "ВОР"), fedora(44, "#0a080c", "#cc4848"), h("div", { class: "nm" }, q.name));
      var on = cands.indexOf(j) >= 0;
      return h("div", { class: "sus " + (on ? "" : "out") }, h("div", { class: "tag" }, on ? "" : "не вор"),
        fedora(44, on ? "#0a080c" : "#3c3c40", on ? GOLD : "#424254"), h("div", { class: "nm" }, q.name));
    });
    var fake = rules().FAKE_HINT, msg;
    if (p.role === THIEF) msg = "Ты вор. Доска нужна остальным — тебе нужно, чтобы она их запутала.";
    else if (p.role === ACCOMPLICE) msg = "Ты сообщник: вор отмечен красным. Помогай ему — путай остальных.";
    else if (!cands.length) msg = "Подсказки противоречат друг другу — одна из них фальшивка вора!";
    else if (cands.length === 1 && fake) msg = "Остался " + G.name(st, cands[0]) + ". Но помни: вор мог подбросить фальшивку.";
    else if (cands.length === 1) msg = "Остался один подозреваемый: " + G.name(st, cands[0]) + ". Это вор!";
    else msg = "Осталось подозреваемых: " + cands.length + ". Ищи ещё подсказки, чтобы вычеркнуть невиновных.";
    return h("div", { class: "card" }, h("div", { class: "label" }, title || "Твоя доска подозреваемых"),
      h("div", { class: "board-cards" + (cols >= 5 ? " five" : ""), style: "grid-template-columns:repeat(" + cols + ",1fr)" }, cards),
      h("p", { class: cands.length === 1 ? "gold" : "" }, msg));
  }

  function hintLines(p) {
    var lines = p.hints.slice();
    var ds = Object.keys(p.digits).sort();
    if (ds.length) lines.push("Код сейфа: " + ds.map(function (k) { return "№" + k + " = " + p.digits[k]; }).join(",  "));
    if (p.duel_cards) lines.push("Карт «Дуэль»: " + p.duel_cards);
    if (p.shields) lines.push("Страховка: следующий штраф отменится");
    if (p.double_vote) lines.push("На суде твой голос считается за два");
    return lines;
  }

  function roleCard(i, o) {
    var st = A.st, p = st.players[i], role = D.ROLES[p.role], R = rules();
    var ability = R.FAKE_HINT && role.ability_fake ? role.ability_fake : role.ability;
    var showSecret = role.secret && !(p.role === ACCOMPLICE && !R.ACCOMPLICE_CUT);
    return h("div", { class: "stack" },
      h("div", null, h("div", { class: "muted small" }, "Твоя роль"), h("div", { class: "role-name" }, role.name), h("p", null, role.intro)),
      h("div", { class: "card warm" }, h("div", { class: "label" }, "Твоя миссия (+2000 ₽ в конце)"),
        h("ul", { class: "dots" }, role.goals.map(function (g) { return h("li", null, G.fmt(g, R)); }))),
      h("div", { class: "card" }, h("div", { class: "label" }, "Способность"), h("p", null, ability),
        showSecret ? h("p", { class: "green", style: "margin-top:6px" }, role.secret) : null),
      o.plan ? h("div", { class: "card" }, h("div", { class: "label" }, "Твой план по раундам"),
        h("ul", { class: "dots plan", style: "list-style:none;padding-left:0" }, role.plan.map(function (s, k) {
          return h("li", { class: k + 1 === st.round_index ? "cur" : "" }, G.fmt(s, R));
        }))) : null,
      o.hints ? h("div", { class: "card" }, h("div", { class: "label" }, "Твои подсказки и цифры"),
        (function () {
          var lines = hintLines(p);
          return lines.length ? h("ul", { class: "dots" }, lines.map(function (l) { return h("li", null, l); }))
            : h("p", { class: "muted" }, "Пока нет.");
        })()) : null);
  }

  function renderRole(scene, i) { return [roleCard(i, { plan: true, hints: false }), hideBar(scene)]; }

  function renderMessage(title, body, board) {
    return function (scene, i) {
      return [h("h2", null, title), h("p", { class: "pre big", style: "font-weight:500" }, body),
        board ? h("div", { style: "margin-top:14px" }, suspectBoard(i)) : null, hideBar(scene)];
    };
  }

  function renderPick(prompt, note) {
    return function (scene, i) {
      return [h("h2", null, prompt), note ? h("p", { class: "muted", style: "margin:6px 0 12px" }, note) : null,
        h("div", { class: "stack" }, G.others(A.st, i).map(function (j) {
          return btn(G.name(A.st, j), function () { scene.finish(j); }, { kind: "big" });
        })),
        h("div", { style: "margin-top:16px" }, suspectBoard(i))];
    };
  }

  function renderAbility(scene, i) {
    var st = A.st, p = st.players[i], msg = scene.data.msg, R = rules(), act;
    if (msg) act = h("p", { class: "big" }, msg);
    else if (p.ability_used) act = h("p", { class: "muted" }, "Уже использована.");
    else if (p.role === THIEF && R.FAKE_HINT)
      act = btn("Подбросить фальшивку", function () {
        G.plantFake(st, i);
        scene.data.msg = "Фальшивка подброшена. Следующая подсказка другому игроку назовёт тебя невиновным.";
      }, { kind: "accent" });
    else if (p.role === THIEF) act = h("p", null, "На общем экране: «Ещё» → «Дуэль». Ты — тот, кто вызывает.");
    else if (p.role === ACCOMPLICE)
      act = btn("Подсмотреть цифру кода", function () {
        scene.data.msg = G.accomplicePeek(st, i) + ". Продай её вору — или кому выгоднее.";
      }, { kind: "accent" });
    else if (p.role === DETECTIVE)
      act = btn("Получить подсказку", function () { scene.data.msg = "Подсказка: " + G.detectiveHint(st, i); }, { kind: "accent" });
    else if (p.role === SPY) {
      var open = G.range(st.lot_ids.length).filter(function (k) { return !(String(k) in st.lots_sold); });
      act = open.length ? h("div", { class: "grid2" }, open.map(function (k) {
        return btn("Заглянуть в " + (k + 1), function () { scene.data.msg = G.spyPeek(st, i, k); }, { kind: "accent" });
      })) : h("p", { class: "muted" }, "Все конверты уже проданы.");
    } else if (p.role === AFERIST) {
      act = p.last_fine > 0 ? btn("Отменить штраф (" + money(Math.min(p.last_fine, C.AFERIST_CANCEL_MAX)) + ")", function () {
        var got = G.aferistCancel(st, i);
        scene.data.msg = "Штраф отменён: возьми у банка " + money(got) + ".";
      }, { kind: "accent" }) : h("p", { class: "muted" }, "Штрафов пока не было — отменять нечего.");
    }
    return [
      h("div", { class: "card gold", style: "margin-bottom:12px" }, h("div", { class: "label" }, "Использовать способность"),
        h("div", { style: "margin-top:8px" }, act)),
      suspectBoard(i), h("div", { class: "spacer" }), roleCard(i, { plan: true, hints: true }), hideBar(scene, "Скрыть"),
    ];
  }

  // ===================================================================== safe
  function safeArt(state) {
    return h("div", { class: "safe " + (state || "") },
      h("div", { class: "box" }, h("div", { class: "inside" }, state === "open" ? h("img", { src: window.MONA_SRC || "mona_lisa.jpg", alt: "" }) : null)),
      h("div", { class: "door" }, h("div", { class: "dial" }), h("div", { class: "handle" })));
  }
  var SafeScene = inherit(function () { this.phase = "pick"; this.who = null; this.code = []; this.ok = false; }, {
    back: function () { if (this.phase === "pick" || this.phase === "result") A.pop(); else if (this.phase === "pass") this.phase = "pick"; },
    submit: function () {
      var self = this;
      this.ok = G.trySafe(A.st, this.who, this.code);
      this.phase = "spin";
      A.scrollTop = true;
      Sound.play("dial");
      A.save();
      setTimeout(function () {
        self.phase = "result";
        Sound.play(self.ok ? "fanfare" : "alarm");
        renderSoon();
      }, 1600);
    },
    render: function () {
      var self = this, st = A.st, el = h("div", { class: "screen" });
      if (this.phase === "pick") {
        add(el, [h("h1", { class: "center" }, "СЕЙФ"), safeArt(),
          h("h2", null, "Кто пробует вскрыть?"),
          h("p", { class: "muted", style: "margin:6px 0 12px" }, "У каждого одна попытка за игру. Код из 3 цифр (1–9). " +
            "Ошибка — сигнализация, и все узнают, что ты пытался."),
          h("div", { class: "stack" }, st.players.map(function (p, k) {
            return btn(p.name + (p.safe_tried ? " (попытка потрачена)" : ""), function () { self.who = k; self.phase = "pass"; },
              { kind: "accent big", disabled: p.safe_tried || st.safe_opened_by !== null });
          })),
          h("div", { class: "spacer" }), btn("Назад", function () { A.pop(); }, { kind: "ghost" })]);
      } else if (this.phase === "pass") {
        var name = G.name(st, this.who);
        add(el, h("div", { class: "pass" }, safeArt(), h("h3", null, "Передай телефон игроку"), h("div", { class: "who" }, name),
          h("p", { class: "muted" }, "Остальные — отвернитесь"),
          btn("Я — " + name + ". Ввести код", function () { self.phase = "keypad"; }, { kind: "accent huge" }),
          btn("Назад", function () { self.phase = "pick"; }, { kind: "ghost" })));
      } else if (this.phase === "keypad") {
        var p = st.players[this.who];
        var known = Object.keys(p.digits).sort().map(function (k) { return "№" + k + " = " + p.digits[k]; }).join(",  ") || "ни одной";
        var cells = h("div", { class: "code-cells" });
        for (var k = 0; k < C.CODE_LEN; k++) cells.appendChild(h("div", null, k < this.code.length ? this.code[k] : ""));
        add(el, [h("div", { class: "private-head" }, G.name(st, this.who) + " — только для тебя"),
          h("p", { class: "muted center" }, "Цифры, которые ты знаешь точно: " + known), cells,
          h("div", { class: "keypad" }, [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (d) {
            return btn(String(d), function () { if (self.code.length < C.CODE_LEN) self.code.push(d); }, { disabled: self.code.length >= C.CODE_LEN });
          })),
          h("div", { class: "row", style: "max-width:320px;margin:12px auto 0" },
            btn("Стереть", function () { self.code.pop(); }, { kind: "ghost" }),
            btn("ВСКРЫТЬ", function () { self.submit(); }, { kind: "danger big", disabled: this.code.length !== C.CODE_LEN })),
          h("div", { class: "spacer" }),
          btn("Передумал", function () { self.phase = "pick"; self.code = []; }, { kind: "ghost" })]);
      } else if (this.phase === "spin") {
        add(el, h("div", { class: "pass" }, safeArt("spin"), h("h2", null, G.name(st, this.who) + " вскрывает сейф…"),
          h("div", { class: "amount" }, "✱ ✱ ✱")));
      } else if (this.ok) {
        add(el, h("div", { class: "pass" }, safeArt("open"), h("h1", null, "СЕЙФ ОТКРЫТ!"),
          h("p", { class: "big" }, "Внутри — «Мона Лиза»! " + G.name(st, this.who) + " получает награду музея " +
            money(C.FINAL_PRIZE) + " из коробки."),
          btn("Отлично", function () { A.pop(); }, { kind: "accent big" })));
      } else {
        add(el, [h("div", { class: "flash-red" }), h("div", { class: "pass" }, safeArt("alarm"), h("h1", { class: "red" }, "ТРЕВОГА!"),
          h("p", { class: "big" }, "Код неверный. " + G.name(st, this.who) + " потратил(а) свою попытку. Все слышали сигнализацию…"),
          btn("Понятно", function () { A.pop(); }, { kind: "accent big" }))]);
      }
      return el;
    },
  });

  // ===================================================================== menu, names, preparation
  function installHelp() {
    if (A.installEvt) {
      A.installEvt.prompt();
      A.installEvt.userChoice.finally(function () { A.installEvt = null; renderSoon(); });
      return;
    }
    var body = "iPhone (Safari): кнопка «Поделиться» (квадрат со стрелкой) → «На экран „Домой“».\n\n" +
      "Android (Chrome): меню ⋮ → «Установить приложение» или «Добавить на главный экран».\n\n" +
      "После установки игра открывается как приложение и работает без интернета.";
    if (window.SINGLE_FILE)
      body = "Это версия одним файлом: она работает без интернета прямо из браузера, но установить её как приложение нельзя." +
        (SITE_URL ? "\n\nДля установки откройте сайт игры:\n" + SITE_URL : "") +
        "\n\nПартия сохраняется в этом браузере.";
    A.push(new MessageDialog("Установить на телефон", body));
  }
  function shareLink() {
    var url = location.href.split("#")[0].replace(/index\.html$/, "");
    if (navigator.share) { navigator.share({ title: "Тень: Последний миллион", url: url }).catch(function () {}); return; }
    try { navigator.clipboard.writeText(url); } catch (e) { /* no clipboard */ }
    A.push(new MessageDialog("Ссылка на игру", url + "\n\nСсылка скопирована. Отправьте её в мессенджер — игра откроется в браузере."));
  }
  function isStandalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  }

  var MenuScene = inherit(function () {}, {
    newGame: function () {
      if (hasSave()) A.push(new ConfirmDialog("Новая партия?", "Незаконченная партия будет заменена новой.", function () {
        try { localStorage.setItem(BACKUP_KEY, localStorage.getItem(SAVE_KEY)); localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
        A.push(new CountScene());
      }, "Начать новую"));
      else A.push(new CountScene());
    },
    continueGame: function () {
      try {
        A.st = JSON.parse(localStorage.getItem(SAVE_KEY));
        if (!A.st || !A.st.players) throw new Error("bad save");
      } catch (e) {
        A.push(new MessageDialog("Не получилось", "Сохранение повреждено. Начните новую партию."));
        return;
      }
      var r = A.st.round_index;
      if (r === 0) A.reset(new PrepScene());
      else if (r >= G.FINAL_ROUND) A.reset(new FinalScene());
      else { A.reset(new HubScene()); keepAwake(); }
    },
    render: function () {
      var self = this;
      return h("div", { class: "screen center" },
        h("div", { class: "hero" }, h("div", { class: "stolen" }, painting(150), h("div", { class: "stamp" }, "УКРАДЕНА")),
          fedora(110)),
        logo(),
        h("p", { class: "muted" }, "семейная детективная игра на 3–5 игроков · 70–80 минут"),
        h("div", { class: "stack", style: "margin-top:18px" },
          btn("Новая игра", function () { self.newGame(); }, { kind: "accent huge" }),
          btn("Продолжить партию", function () { self.continueGame(); }, { kind: "big", disabled: !hasSave() }),
          h("div", { class: "grid2" },
            btn("Как играть", function () { A.push(new RulesDialog()); }),
            btn(Sound.muted ? "Звук: выкл" : "Звук: вкл", function () { Sound.toggle(); })),
          isStandalone() ? null : btn(window.SINGLE_FILE ? "Как установить" : "Установить на телефон", installHelp, { kind: "ghost" }),
          window.SINGLE_FILE || !/^https?:/.test(location.protocol) ? null : h("div", { class: "grid2" },
            btn("Поделиться ссылкой", shareLink, { kind: "ghost", cls: "slim" }),
            h("a", { class: "btn ghost slim", href: "ten.html", download: "ten.html", style: "text-decoration:none" }, "Скачать файлом"))),
        h("p", { class: "muted small", style: "margin-top:18px" }, "Положите телефон в центр стола. Тайное смотрим по очереди."));
    },
  });

  var CountScene = inherit(function () {}, {
    back: function () { A.pop(); },
    render: function () {
      var info = {
        3: ["3 игрока", "Вор, Детектив и Шпион или Аферист. Вор может подбросить фальшивую улику."],
        4: ["4 игрока", "Классика: Вор, Детектив, Шпион, Аферист."],
        5: ["5 игроков", "Плюс Сообщник — он знает вора и помогает ему."],
      };
      var cards = [];
      for (var n = D.MIN_PLAYERS; n <= D.MAX_PLAYERS; n++) (function (n) {
        cards.push(h("div", { class: "card warm deco", style: "display:flex;gap:14px;align-items:center" },
          h("div", { style: "font-size:64px;font-weight:900;color:var(--gold);line-height:1;width:52px;text-align:center" }, n),
          h("div", { style: "flex:1" }, h("h3", null, info[n][0]), h("p", { class: "muted small", style: "margin:2px 0 8px" }, info[n][1]),
            btn("Нас " + n, function () { A.pop(); A.push(new SetupScene(n)); }, { kind: "accent" }))));
      })(n);
      return h("div", { class: "screen" }, h("h1", { class: "center" }, "Сколько вас?"), rule(),
        h("div", { class: "stack" }, cards), h("div", { class: "spacer" }),
        btn("Назад", function () { A.pop(); }, { kind: "ghost" }));
    },
  });

  var SetupScene = inherit(function (count) {
    this.count = count;
    var saved = [];
    try { saved = JSON.parse(localStorage.getItem(NAMES_KEY) || "[]"); } catch (e) { saved = []; }
    this.names = G.range(D.MAX_PLAYERS).map(function (k) { return saved[k] || ""; });
    this.error = "";
  }, {
    back: function () { A.pop(); A.push(new CountScene()); },
    start: function () {
      var names = this.names.slice(0, this.count).map(function (n, k) { return n.trim() || "Игрок " + (k + 1); });
      var low = names.map(function (n) { return n.toLowerCase(); });
      if (new Set(low).size < names.length) { this.error = "Имена должны быть разными."; return; }
      try { localStorage.setItem(NAMES_KEY, JSON.stringify(this.names)); } catch (e) { /* ignore */ }
      A.st = G.create(names);
      A.save();
      A.reset(new PrepScene());
    },
    render: function () {
      var self = this, inputs = [];
      for (var k = 0; k < this.count; k++) (function (k) {
        var inp = h("input", { class: "name-input", type: "text", maxlength: "14", placeholder: "Игрок " + (k + 1),
          value: self.names[k], autocomplete: "off", enterkeyhint: k < self.count - 1 ? "next" : "done", "aria-label": "Игрок " + (k + 1) });
        inp.oninput = function () { self.names[k] = inp.value; };
        inp.onkeydown = function (e) {
          if (e.key !== "Enter") return;
          e.preventDefault();
          var next = document.querySelectorAll(".name-input")[k + 1];
          if (next) next.focus(); else inp.blur();
        };
        inputs.push(inp);
      })(k);
      return h("div", { class: "screen with-bar" }, h("h1", { class: "center" }, "Кто играет?"), rule(),
        h("p", { class: "muted center", style: "margin-bottom:12px" }, "Игроков: " + this.count + ". Введите имена в именительном падеже."),
        h("div", { class: "stack" }, inputs),
        this.error ? h("p", { class: "red center", style: "margin-top:10px" }, this.error) : null,
        bar(btn("Назад", function () { self.back(); }, { kind: "ghost" }),
          btn("Дальше", function () { self.start(); }, { kind: "accent big", cls: "grow" })));
    },
  });

  var PREP_STEPS = ["Пролог", "Как играть", "Банк", "Тайники", "Роли"];
  var PrepScene = inherit(function () { this.step = 0; this.clueShown = false; this.fragShown = false; }, {
    back: function () { if (this.step > 0) this.step -= 1; },
    showSpots: function (who, slots, label, flag) {
      var self = this, st = A.st;
      A.push(new PrivateScene("Места для тайников", [who], function (scene) {
        return [h("h2", null, "Где спрятать бумажки «" + label + "»"),
          h("p", { class: "muted", style: "margin-bottom:12px" }, "Остальные пока ждут на кухне. Не прячь внутри техники и там, куда " +
            "надо лезть. Если такого места у вас нет — нажми «Заменить»."),
          h("div", { class: "stack" }, slots.map(function (slot, n) {
            var spot = D.SPOTS[st.spot_ids[slot]];
            return h("div", { class: "card warm" }, h("h3", { class: "gold" }, (n + 1) + ". " + spot.answer),
              h("p", { style: "margin:4px 0 10px" }, "Куда: " + spot.hide),
              btn("Заменить", function () { G.replaceSpot(st, slot); }, { cls: "slim" }));
          })),
          hideBar(scene, "Спрятал. Скрыть")];
      }, function () { self[flag] = true; }));
    },
    dealRoles: function () {
      A.push(new PrivateScene("Раздача ролей", G.range(A.st.players.length), renderRole, function () {
        var st = A.st;
        st.roles_shown = true;
        G.nextRound(st);
        A.save();
        var hub = new HubScene();
        A.reset(hub);
        hub.beginRound();
        keepAwake();
      }));
    },
    hiderRow: function (label, attr, other) {
      var st = A.st;
      return h("div", { style: "margin-top:14px" }, h("h3", { style: "margin-bottom:8px" }, label),
        h("div", { class: "chips" }, st.players.map(function (p, i) {
          var taken = st[other] === i;
          return btn(p.name + (taken ? " (занят)" : ""), function () { st[attr] = i; },
            { kind: st[attr] === i ? "selected" : "", disabled: taken });
        })));
    },
    render: function () {
      var self = this, st = A.st, R = rules(), body, next = ["Дальше", function () { self.step += 1; }, true];
      if (this.step === 0) {
        body = [h("div", { class: "center" }, painting(190)), h("h1", { style: "margin-top:14px" }, "Пролог"),
          h("p", { class: "muted small" }, "Прочитайте вслух всем:"),
          h("p", { class: "big", style: "font-weight:600;margin:8px 0 12px" }, "«" + D.STORY + "»"),
          h("p", { class: "muted" }, "Деньги «Монополии» — это ваши деньги в игре. В конце побеждает самый богатый. Как именно — на следующем экране.")];
        next[0] = "Дальше: как играть";
      } else if (this.step === 1) {
        body = [h("p", { class: "muted small" }, "Прочитайте вслух всем:"), howToWin()];
        next[0] = "Понятно, дальше";
      } else if (this.step === 2) {
        body = [h("div", { class: "row", style: "align-items:center;flex:none" }, h("div", { style: "flex:none" }, icon("coin", 46)), h("h1", null, "Банк и сейф")),
          h("p", { style: "margin:10px 0 14px" }, "Один из игроков держит кассу — все деньги «Монополии». Он такой же игрок, просто " +
            "выдаёт и принимает купюры. Телефон скажет, кому и сколько."),
          h("ol", { class: "list" }, [
            "Каждому игроку выдайте 1500 ₽: две по 500, четыре по 100 и две по 50.",
            "Коробка — это сейф с картиной. Положите в неё 3000 ₽ (награду музея) и закройте. Её вскроют в раунде 5 — кодом на телефоне.",
            "Всё остальное — касса банка (около " + money(Math.round(st.bank / 1000) * 1000) + ").",
            "Нужны ещё: кубик, ручка и листок каждому — записывать подсказки и цифры.",
            "Бумажные конверты НЕ нужны: аукцион идёт прямо на экране.",
          ].map(function (s) { return h("li", null, s); }))];
        next[0] = "Деньги розданы, дальше";
      } else if (this.step === 3) {
        var ch = st.clue_hider, fh = st.fragment_hider;
        body = [h("div", { class: "row", style: "align-items:center" }, h("div", { style: "flex:none" }, icon("magnifier", 46)), h("h1", null, "Тайники")),
          h("p", { style: "margin-top:10px" }, "Нарежьте 5 бумажек. На трёх напишите «УЛИКА», на двух — «ФРАГМЕНТ». Их спрячут по квартире. " +
            "В игре телефон покажет загадку — ответ на неё и есть место, где лежит бумажка. Нашёл — телефон тайно скажет, кто не вор " +
            "(улика) или цифру кода (фрагмент)."),
          this.hiderRow("Кто прячет улики?", "clue_hider", "fragment_hider"),
          this.hiderRow("Кто прячет фрагменты?", "fragment_hider", "clue_hider"),
          h("p", { class: "muted small", style: "margin:10px 0" }, "Кто прятал — тот не ищет свои бумажки (телефон не даст их записать)."),
          h("div", { class: "stack" },
            btn((this.clueShown ? "✓ " : "") + "Показать места улик" + (ch !== null ? " — " + G.name(st, ch) : ""),
              function () { self.showSpots(ch, [0, 1, 2], "УЛИКА", "clueShown"); },
              { kind: this.clueShown ? "" : "accent", disabled: ch === null }),
            btn((this.fragShown ? "✓ " : "") + "Показать места фрагментов" + (fh !== null ? " — " + G.name(st, fh) : ""),
              function () { self.showSpots(fh, [3, 4], "ФРАГМЕНТ", "fragShown"); },
              { kind: this.fragShown ? "" : "accent", disabled: fh === null }))];
        next = ["Всё спрятано, дальше", next[1], this.clueShown && this.fragShown];
      } else {
        body = [h("div", { class: "row", style: "align-items:center" }, h("div", { style: "flex:none" }, icon("mask", 46)), h("h1", null, "Раздача ролей")),
          h("p", { style: "margin:10px 0" }, "Телефон по очереди обойдёт всех. Каждый тайно увидит свою роль, миссию и ПЛАН ПО РАУНДАМ — что " +
            "делать, чтобы выиграть. Прочитай план внимательно: это твоя инструкция на всю игру. Свою роль, план и подсказки " +
            "можно открыть снова в любой момент — кнопка «Моя роль»."),
          h("div", { class: "card" }, D.ROLE_ORDER.filter(function (r) { return G.hasRole(st, r); }).map(function (r) {
            return h("p", { class: "small", style: "margin:4px 0" }, h("b", { class: "gold" }, D.ROLES[r].name + ": "), D.ROLES[r].intro);
          })),
          R.FAKE_HINT ? h("p", { class: "gold", style: "margin-top:10px" }, "Игра втроём: вор может один раз подбросить фальшивую улику — " +
            "не верьте подсказкам на 100%.") : null,
          h("p", { class: "gold big", style: "margin-top:10px" }, "Сразу после этого начнётся раунд 1.")];
        next = ["Раздать роли", function () { self.dealRoles(); }, true];
      }
      return h("div", { class: "screen with-bar" },
        h("div", { class: "steps" }, PREP_STEPS.map(function (s, k) { return h("i", { class: k === self.step ? "on" : (k < self.step ? "done" : "") }); })),
        h("p", { class: "label", style: "margin-bottom:8px" }, "Подготовка · шаг " + (this.step + 1) + " из 5 · " + PREP_STEPS[this.step]),
        body,
        bar(this.step > 0 ? btn("Назад", function () { self.step -= 1; A.scrollTop = true; }, { kind: "ghost" }) : null,
          btn(next[0], function () { next[1](); A.scrollTop = true; }, { kind: "accent big", cls: "grow", disabled: !next[2] })));
    },
  });

  // ===================================================================== round intro & events
  var IntroScene = inherit(function (hub) { this.hub = hub; Sound.play("sting"); }, {
    render: function () {
      var self = this, st = A.st, rnd = G.round(st), R = rules();
      return h("div", { class: "screen with-bar intro" },
        h("div", { class: "card deco gold", style: "background:rgba(14,12,18,.92)" },
          st.round_index === 1 ? h("div", { style: "margin-bottom:8px" }, painting(110)) : null,
          icon(rnd.icon, 64),
          h("p", { class: "muted", style: "font-weight:800;letter-spacing:.1em" }, "РАУНД " + st.round_index + " ИЗ " + D.MAX_ROUND),
          h("h1", { style: "font-size:36px" }, rnd.title.toUpperCase()), rule(),
          h("div", { class: "label", style: "text-align:left" }, "Ведущий говорит (прочитайте вслух):"),
          h("p", { class: "speech", style: "margin:6px 0 14px" }, "«" + G.fmt(rnd.speech, R) + "»"),
          h("div", { class: "label", style: "text-align:left;margin-bottom:6px" }, "Сейчас важно для каждой роли:"),
          h("div", { class: "remind" }, D.ROLE_ORDER.filter(function (r) { return G.hasRole(st, r); }).map(function (r) {
            return [h("b", null, cap(D.ROLES[r].name) + ":"), h("span", null, rnd.remind[r])];
          })),
          h("p", { class: "muted small", style: "margin-top:12px" }, "На раунд: " + rnd.minutes + " минут. Таймер запустится сам.")),
        bar(btn("Начать раунд", function () { A.pop(); self.hub.afterIntro(); }, { kind: "accent big" })));
    },
  });

  var EventDialog = inherit(function (hub, auto) {
    var st = A.st;
    this.hub = hub; this.result = "";
    if (auto !== false && !st.event_applied && D.AUTO_EVENTS.indexOf(st.current_event) >= 0) this.applyAuto();
    this.pendingTimer = auto !== false && D.TIMER_EVENTS.indexOf(st.current_event) >= 0 && !st.event_applied;
  }, {
    modal: true,
    back: function () { if (!(D.DICE_EVENTS.indexOf(A.st.current_event) >= 0 && !A.st.event_applied)) this.close(); },
    update: function () {
      if (this.pendingTimer && A.top() === this) {
        this.pendingTimer = false;
        A.st.event_applied = true;
        A.push(new TurnTimer("Паника", 20, A.st.players.map(function (p) { return p.name; }), "Назови самого подозрительного и объясни почему"));
      }
    },
    applyAuto: function () {
      var st = A.st;
      if (st.current_event === 1) {
        var payers = G.applyBankruptcy(st);
        this.result = "Платят в банк по 500 ₽: " + payers.map(function (i) { return G.name(st, i); }).join(", ") + ".";
      } else {
        G.applyCrisis(st);
        this.result = "Каждый отдаёт в банк 200 ₽ купюрами.";
      }
      Sound.play("cash");
    },
    lucky: function () {
      var self = this, st = A.st;
      A.push(new RollsDialog("Счастливый билет", st.players.map(function (p, i) { return [i, p.name]; }), function (rolls) {
        G.applyLucky(st, rolls);
        var parts = [];
        Object.keys(rolls).forEach(function (i) {
          if (rolls[i] === 6) parts.push(G.name(st, +i) + ": 6 — берёт у банка 1000 ₽");
          else if (rolls[i] === 1) parts.push(G.name(st, +i) + ": 1 — платит банку 200 ₽");
        });
        self.result = parts.length ? parts.join("; ") + "." : "Ни у кого не выпало 6 или 1.";
      }, { note: "6 — получи 1000 ₽, 1 — заплати 200 ₽." }));
    },
    contract: function () {
      var self = this;
      A.push(new TxDialog("contract", function (a, b) {
        G.applyContract(A.st, a, b);
        self.result = G.name(A.st, a) + " и " + G.name(A.st, b) + " заключили сделку. Банк даёт каждому 300 ₽.";
        Sound.play("cash");
      }));
    },
    close: function () { A.pop(); this.hub.afterEvent(); },
    render: function () {
      var self = this, st = A.st, ev = st.current_event, e = D.EVENTS[ev];
      var must = D.DICE_EVENTS.indexOf(ev) >= 0 && !st.event_applied, action = null;
      if (!st.event_applied) {
        if (D.DICE_EVENTS.indexOf(ev) >= 0) action = btn("Бросить кубики", function () { self.lucky(); }, { kind: "accent big" });
        else if (D.DEAL_EVENTS.indexOf(ev) >= 0) action = btn("Записать контракт", function () { self.contract(); }, { kind: "accent big" });
      } else if (D.TIMER_EVENTS.indexOf(ev) >= 0) {
        action = btn("Ещё раз по 20 секунд", function () {
          A.push(new TurnTimer("Паника", 20, st.players.map(function (p) { return p.name; })));
        });
      }
      return h("div", { class: "stack" },
        h("p", { class: "label" }, "Событие раунда — случайная карточка, как «Шанс» в Монополии"),
        h("h1", { style: "color:var(--text)" }, e[0]), h("p", { class: "big", style: "font-weight:500" }, e[1]),
        this.result ? h("p", { class: "gold big" }, this.result) : null,
        action,
        btn(must ? "Сначала бросьте" : "К раунду", function () { self.close(); }, { kind: must ? "" : "accent big", disabled: must }));
    },
  });

  // ===================================================================== hub
  var HubScene = inherit(function () {
    this.running = false; this.rang = false; this.saveT = 0; this.prompt = ""; this.promptT = 0; this.lastSec = null; this.flags = {};
    if (A.st) this.newPrompt(false);
  }, {
    beginRound: function () {
      A.toasts = [];
      this.running = false; this.rang = false; this.flags = {};
      this.newPrompt(false);
      A.push(new IntroScene(this));
    },
    afterIntro: function () {
      if (A.st.current_event) A.push(new EventDialog(this));
      else this.afterEvent();
    },
    afterEvent: function () {
      if (!this.flags.started) {
        this.flags.started = true;
        this.running = true;
        A.toast("Раунд начался! " + G.round(A.st).minutes + " минут.");
      }
    },
    newPrompt: function (sound) {
      var st = A.st, ab = G.sample(null, G.range(st.players.length), 2);
      this.prompt = G.fmt(G.choice(null, G.round(st).prompts), { a: G.name(st, ab[0]), b: G.name(st, ab[1]) });
      this.promptT = 0;
      if (sound !== false) Sound.play("chime");
      var el = document.getElementById("host-prompt");
      if (el) el.textContent = this.prompt;
    },
    update: function (dt) {
      var st = A.st;
      if (A.top() === this) {
        this.promptT += dt;
        if (this.promptT > PROMPT_EVERY) this.newPrompt();
      }
      if (!this.running) { Sound.stopLoop(); return; }
      var total = G.round(st).minutes * 60;
      st.timer_left = Math.max(0, st.timer_left - dt);
      var left = st.timer_left, sec = Math.ceil(left);
      if (left <= 30 && left > 0) Sound.startLoop("tension");
      if (sec !== this.lastSec && sec > 0 && sec <= 10) Sound.play("tick");
      this.lastSec = sec;
      if (left <= total / 2 && !this.flags.half) { this.flags.half = true; A.toast("Половина времени позади!"); }
      if (left <= 120 && total > 240 && !this.flags.two) { this.flags.two = true; A.toast("Осталось 2 минуты!", "red"); }
      if (left === 0 && !this.rang) {
        this.rang = true; this.running = false;
        Sound.stopLoop(); Sound.play("timeup");
        A.toast("Время вышло! Доделайте шаг и жмите «Дальше»", "red", 8);
        renderSoon();
      }
      this.drawTimer();
      this.saveT += dt;
      if (this.saveT > 10) { this.saveT = 0; A.save(); }
    },
    timerText: function () { var l = Math.ceil(A.st.timer_left); return String(Math.floor(l / 60)).padStart(2, "0") + ":" + String(l % 60).padStart(2, "0"); },
    timerClass: function () {
      var l = A.st.timer_left;
      return "timer " + (l <= 30 ? "hot" : (this.running ? "run" : "paused")) + (l <= 10 && this.running ? " flash" : "");
    },
    drawTimer: function () {
      var el = document.getElementById("timer");
      if (!el) return;
      var t = this.timerText(), c = this.timerClass();
      if (el.textContent !== t) el.textContent = t;
      if (el.className !== c) el.className = c;
    },

    // ---- round 1, court
    alibi: function () {
      var st = A.st;
      A.push(new PrivateScene("Алиби: карточка и ответ", G.range(st.players.length), function (scene, i) {
        return [h("h2", null, "Твоя карточка алиби"), h("p", { class: "big", style: "font-weight:500" }, G.alibiCard(st, i)),
          h("h3", { style: "margin-top:18px" }, "Вопрос телефона: где ты был в ночь кражи?"),
          h("p", { class: "muted small", style: "margin:4px 0 10px" }, "Ответы откроются у всех одновременно. Выбор сразу скроется."),
          h("div", { class: "stack" }, st.alibi_places.map(function (place, n) {
            return btn(cap(place.charAt(0)) + place.slice(1), function () { scene.finish(n); }, { kind: "accent big" });
          }))];
      }, function (res) {
        G.setAlibiAnswers(st, res);
        A.push(new AlibiReveal());
      }));
    },
    suspects: function () {
      A.push(new PrivateScene("Тайное подозрение", G.range(A.st.players.length),
        renderPick("Кого ты подозреваешь?", "Угадаешь вора — получишь 300 ₽ на суде. Если ты вор — выбери кого угодно."),
        function (res) { G.setSuspects(A.st, res); A.toast("Подозрения записаны. Жмите «Дальше»"); }));
    },
    speeches: function () {
      this.flags.speeches = true;
      A.push(new TurnTimer("Речи на суде", 30, A.st.players.map(function (p) { return p.name; }), "Кого обвиняешь и почему? Или защищайся."));
    },
    court: function () {
      A.push(new PrivateScene("Суд: тайное голосование", G.range(A.st.players.length),
        renderPick("Кто вор?", "Голос нельзя изменить. Ниже — твоя доска."), function (res) {
          var st = A.st;
          G.setVotes(st, res);
          var lines = Object.keys(res).map(function (i) { return G.name(st, +i) + " считает вором: " + G.name(st, res[i]); }).join("\n");
          Sound.play("sting");
          A.push(new MessageDialog("Голоса открыты", lines + "\n\n" + st.court_verdict +
            "\n\nПередайте деньги купюрами. Дальше — подсчёт и раскрытие ролей.", null, "scales"));
        }));
    },

    // ---- round 2 & 5: riddles
    foundClue: function (i) {
      var hint = G.findClue(A.st, i);
      Sound.play("chime");
      A.push(new PrivateScene("Улика найдена", [i], renderMessage("Улика! Алиби подтверждено",
        hint + "  Это имя вычеркнуто с твоей доски. +300 ₽ — возьми у банка.", true), null, false));
    },
    foundFragment: function (i) {
      var d = G.findFragment(A.st, i);
      Sound.play("chime");
      A.push(new PrivateScene("Фрагмент кода", [i], renderMessage("Фрагмент кода", d + "\n\nЗапомни или запиши тайно. " +
        "Можешь продать эту цифру — честно через телефон или на словах (тогда можно соврать)."), null, false));
    },
    showAnswer: function (answer, skip) {
      A.push(new ConfirmDialog("Сдаётесь?", "Ответ: «" + answer + "». Бумажку уже никто не получит — переходим к следующей загадке.",
        skip, "Следующая"));
    },
    sellLot: function (k) {
      A.push(new TxDialog("auction", function (lot, winner, price) {
        var lines = G.sellLot(A.st, lot, winner, price);
        Sound.play("cash");
        var body = lines.slice(1).join("\n") + "\n\nОтдай в банк " + money(price) + ". Молчи, ври или продай.";
        A.push(new PrivateScene("Конверт " + (lot + 1), [winner], renderMessage(lines[0], body, true), null, false));
      }, { lot: k }));
    },
    trial: function () {
      var st = A.st;
      A.push(new RollsDialog("Испытание: фрагмент №1", st.players.map(function (p, i) { return [i, p.name]; }), function (rolls) {
        var win = +Object.keys(rolls).reduce(function (a, b) { return rolls[b] > rolls[a] ? b : a; });
        var d = G.trialWinner(st, win);
        A.push(new PrivateScene("Испытание выиграно", [win], renderMessage("Фрагмент кода №1", d + "\n\nЗапомни. Никому не показывай — или продай."), null, false));
        A.toast(G.name(st, win) + " выигрывает фрагмент №1!");
      }, { uniqueTop: true, note: "У кого больше всех — тайно узнаёт первую цифру кода." }));
    },
    openSafe: function () { A.push(new SafeScene()); },
    myRole: function () {
      A.push(new PickDialog("Кто смотрит свою роль?", A.st.players.map(function (p, i) { return [p.name, i]; }), function (i) {
        A.push(new PrivateScene("Моя роль", [i], renderAbility));
      }));
    },
    duel: function () {
      A.push(new TxDialog("duel", function (a, b) {
        var st = A.st, p = st.players[a], card;
        if (p.duel_cards > 0) card = true;
        else if (p.role === THIEF && !p.ability_used && !rules().FAKE_HINT) card = false;
        else { A.push(new MessageDialog("Дуэль невозможна", p.name + ": нет карты «Дуэль» и нет права на дуэль.")); return; }
        A.push(new RollsDialog("Дуэль кубиков", [[a, p.name], [b, G.name(st, b)]], function (rolls) {
          var win = G.duel(st, a, b, rolls[a], rolls[b], card), paid = card || win === a;
          A.push(new MessageDialog("Итог дуэли", "Победил " + G.name(st, win) + "." +
            (paid ? " Банк платит победителю " + money(C.DUEL_PRIZE) + "." : " Выплаты нет.")));
        }, { uniqueTop: true, cancellable: false }));
      }));
    },
    dice: function () {
      A.push(new RollsDialog("Кубик", [[0, "Бросок"]], function () {}, { note: "Для споров: у кого больше — тот прав, ничья — перебросить." }));
    },
    nextRound: function () {
      var self = this, st = A.st, ri = st.round_index, warn = "";
      if (ri === 1 && !st.suspects_done) warn = "Тайные подозрения ещё не записаны! ";
      if (ri === 2 && st.clue_step < C.TOTAL_CLUES) warn = "Не все загадки пройдены (" + st.clue_step + " из 3). ";
      if (ri === 3 && st.lot_step < st.lot_ids.length) warn = "Проданы не все конверты (" + st.lot_step + " из " + st.lot_ids.length + "). ";
      if (ri === 5 && !st.trial_done) warn = "Испытание за фрагмент ещё не проведено. ";
      if (ri === 6 && !st.court_done) warn = "Голосование ещё не проведено! ";
      var nxt = ri === D.MAX_ROUND ? "подсчёт и раскрытие ролей" : "раунд " + (ri + 1) + " — " + D.ROUNDS[ri + 1].title;
      A.push(new ConfirmDialog("Дальше?", warn + "Следующий этап: " + nxt + ".", function () {
        G.nextRound(st);
        Sound.stopLoop();
        A.save();
        if (st.round_index >= G.FINAL_ROUND) A.reset(new FinalScene());
        else { A.scrollTop = true; self.beginRound(); }
      }, "Перейти"));
    },

    // ---- drawing
    render: function () {
      var self = this, st = A.st, rnd = G.round(st), R = rules();
      var top = h("div", { class: "hub-top" },
        h("div", { class: "line" }, icon(rnd.icon, 36),
          h("div", { class: "title" }, h("b", null, rnd.title), h("span", null, "Раунд " + st.round_index + " из " + D.MAX_ROUND)),
          h("div", { id: "timer", class: this.timerClass() }, this.timerText())),
        h("div", { class: "timer-ctl" },
          btn(this.running ? "Пауза" : "Продолжить", function () { self.running = !self.running; }, { kind: this.running ? "" : "accent" }),
          btn("+1 мин", function () { st.timer_left += 60; self.rang = false; }),
          btn("Сброс", function () { st.timer_left = rnd.minutes * 60; self.running = false; self.rang = false; })));
      var host = h("div", { class: "card warm host" }, fedora(40),
        h("div", { class: "txt" }, h("div", { class: "label" }, "Ведущий"), h("b", { id: "host-prompt" }, this.prompt)),
        btn("Другое", function () { self.newPrompt(); }, { cls: "slim" }));
      var why = h("details", { class: "card why" }, h("summary", null, h("span", { class: "label" }, "Зачем этот раунд и что делать")),
        h("p", { style: "margin-top:8px" }, G.fmt(rnd.why, R)),
        h("ol", { class: "list muted small", style: "margin-top:6px" }, rnd.steps.map(function (s) { return h("li", null, s); })));
      if (!this.flags.whyClosed && st.round_index === 1) why.open = true;
      return h("div", { class: "screen with-bar" }, top,
        h("div", { class: "stack" },
          host,
          st.current_event ? btn("Событие раунда: " + D.EVENTS[st.current_event][0], function () { A.push(new EventDialog(self, false)); },
            { cls: "slim ev-chip" }) : null,
          this["area" + st.round_index](),
          why,
          this.players()),
        bar(btn("Деньги", function () { A.push(new TxDialog("money")); }, { cls: "slim" }),
          btn("Сделка", function () { A.push(new TxDialog("deal")); }, { cls: "slim" }),
          btn("Моя роль", function () { self.myRole(); }, { cls: "slim" }),
          btn("Ещё", function () { A.push(new MoreDialog(self)); }, { cls: "slim" }),
          btn("Дальше »", function () { self.nextRound(); }, { kind: "accent", cls: "slim grow" })));
    },
    playerChips: function (can, cb, hider) {
      var st = A.st;
      return h("div", { class: "chips" }, st.players.map(function (p, i) {
        return btn(p.name + (i === hider ? " (прятал)" : ""), function () { cb(i); }, { kind: "accent", disabled: !can(i) });
      }));
    },
    area1: function () {
      var self = this, st = A.st;
      if (!Object.keys(st.alibi_answers).length)
        return h("div", { class: "stack" }, card("Шаг 1 из 3 — Алиби", h("p", { class: "big" },
          "Телефон обойдёт всех: каждый тайно прочитает, где был в ночь кражи, и тайно ответит. Ответы собирает телефон."), { icon: "eye" }),
          btn("Начать: карточки алиби", function () { self.alibi(); }, { kind: "accent huge" }));
      if (st.suspects_done) return card("Готово", h("p", { class: "big green" }, "Подозрения записаны. Жмите «Дальше»."), { icon: "eye" });
      var mism = G.alibiMismatch(st);
      var body = mism.length ? "Не совпали: " + mism.map(function (i) { return G.name(st, i); }).join(", ") +
        ". Это вор — или забывчивый. Расспросите их (задания ведущего выше)."
        : "Все ответы совпали! Вор угадал. Расспросите всех — кто путается в деталях?";
      return h("div", { class: "stack" }, card("Шаг 2 из 3 — Допрос", h("p", { class: "big" }, body), { icon: "eye" }),
        btn("Шаг 3: тайное подозрение", function () { self.suspects(); }, { kind: "accent big" }),
        btn("Ответы ещё раз", function () { A.push(new AlibiReveal()); }, { cls: "slim" }));
    },
    area2: function () {
      var self = this, st = A.st;
      if (st.clue_step >= C.TOTAL_CLUES) return card("Все загадки пройдены", h("p", { class: "big green" }, "Жмите «Дальше» — чёрный рынок."), { icon: "magnifier" });
      var spot = G.clueSpot(st, st.clue_step);
      return h("div", { class: "stack" },
        card("Загадка " + (st.clue_step + 1) + " из 3 — где лежит «УЛИКА»?", h("p", { class: "riddle" }, "«" + spot.riddle + "»"), { icon: "magnifier" }),
        h("p", null, "Кто нашёл бумажку и принёс к телефону?"),
        this.playerChips(function (i) { return G.canFindClue(st, i); }, function (i) { self.foundClue(i); }, st.clue_hider),
        btn("Не можем найти — ответ", function () { self.showAnswer(spot.answer, function () { G.skipClue(st); }); }, { kind: "ghost", cls: "slim" }));
    },
    area3: function () {
      var self = this, st = A.st, k = st.lot_step;
      if (k >= st.lot_ids.length) return card("Торги закончены", h("p", { class: "big green" }, "Жмите «Дальше» — тайные сделки."), { icon: "envelope" });
      var kind = G.lot(st, k)[1];
      return h("div", { class: "stack" },
        card("Конверт " + (k + 1) + " из " + st.lot_ids.length + " · старт 100 ₽", [
          h("p", { class: "riddle" }, "На конверте надпись: «" + D.TEASERS[kind] + "»"),
          h("p", { class: "muted small", style: "margin-top:6px" }, "Внутри всегда: подсказка «кто не вор» + сюрприз (деньги, штраф, карта или " +
            "цифра кода). Колода из 30 конвертов — каждый раз новые.")], { icon: "envelope" }),
        btn("Продано! Кто купил конверт " + (k + 1) + "?", function () { self.sellLot(k); }, { kind: "accent big" }),
        btn("Никто не купил", function () { G.skipLot(st, k); }, { kind: "ghost", cls: "slim" }),
        k === 0 ? h("p", { class: "muted small" }, "Шпион может заглянуть в конверт до торгов: «Моя роль».") : null);
    },
    area4: function () {
      var st = A.st, deals = st.log.filter(function (l) { return l.indexOf("Сделка: ") === 0; }).map(function (l) { return l.slice(8); });
      return h("div", { class: "stack" },
        card("Что можно продать", h("ul", { class: "dots" }, ["«Скажу, кто точно не вор — 200 ₽»", "«Мой голос на суде — 300 ₽»",
          "«Цифра кода в раунде 5 — 400 ₽»", "«Союз: делимся подсказками»"].map(function (s) { return h("li", null, s); })), { icon: "handshake" }),
        btn("Записать сделку", function () { A.push(new TxDialog("deal")); }, { kind: "accent big" }),
        h("p", { class: "muted" }, "Сделок за игру: " + deals.length),
        deals.length ? h("ul", { class: "dots muted small" }, deals.slice(-3).map(function (d) { return h("li", null, d); })) : null);
    },
    area5: function () {
      var self = this, st = A.st;
      if (!st.trial_done)
        return h("div", { class: "stack" }, card("Шаг 1 из 3 — Испытание", h("p", { class: "big" }, "Все бросают кубик. У кого больше — тайно узнаёт цифру №1."), { icon: "safe" }),
          btn("Бросить кубики", function () { self.trial(); }, { kind: "accent big" }));
      if (st.fragment_step < 2) {
        var spot = G.fragmentSpot(st, st.fragment_step);
        return h("div", { class: "stack" },
          card("Шаг 2 из 3 — где «ФРАГМЕНТ» №" + (st.fragment_step + 2) + "?", h("p", { class: "riddle" }, "«" + spot.riddle + "»"), { icon: "magnifier" }),
          h("p", null, "Кто нашёл бумажку «ФРАГМЕНТ»?"),
          this.playerChips(function (i) { return G.canFindFragment(st, i); }, function (i) { self.foundFragment(i); }, st.fragment_hider),
          btn("Не можем найти — ответ", function () { self.showAnswer(spot.answer, function () { G.skipFragment(st); }); }, { kind: "ghost", cls: "slim" }));
      }
      if (st.safe_opened_by !== null)
        return card("Сейф вскрыт", h("p", { class: "big green" }, G.name(st, st.safe_opened_by) + " забрал(а) 3000 ₽. Жмите «Дальше» — суд."), { icon: "safe" });
      var tried = st.players.filter(function (p) { return p.safe_tried; }).map(function (p) { return p.name; });
      return h("div", { class: "stack" },
        card("Шаг 3 из 3 — Торг и взлом", h("p", null, "Торгуйте цифрами: «Сделка с цифрой». Знаешь цифры — жми «Вскрыть сейф». Попытка одна!" +
          (tried.length ? " Уже пробовали: " + tried.join(", ") + "." : "")), { icon: "safe" }),
        btn("ВСКРЫТЬ СЕЙФ", function () { self.openSafe(); }, { kind: "danger huge" }),
        btn("Сделка с цифрой", function () { A.push(new TxDialog("deal", null, { item: "цифру кода" })); }, { kind: "accent" }));
    },
    area6: function () {
      var self = this, st = A.st;
      if (st.court_done) return card("Приговор", h("p", { class: "big" }, st.court_verdict + " Жмите «Дальше» — подсчёт и роли."), { icon: "scales" });
      return h("div", { class: "stack" },
        card("Порядок суда", h("p", { class: "big" }, "Сначала речи (по 30 секунд, таймер сам переключает). Потом голосование."), { icon: "scales" }),
        h("div", { class: "row" }, btn("1. Речи", function () { self.speeches(); }, { kind: this.flags.speeches ? "" : "accent big" }),
          btn("2. Голосование", function () { self.court(); }, { kind: "accent big" })),
        st.safe_opened_by === null && st.players.some(function (p) { return !p.safe_tried; })
          ? btn("Последний шанс: сейф", function () { self.openSafe(); }, { kind: "danger", cls: "slim" }) : null);
    },
    players: function () {
      var st = A.st;
      return h("div", { class: "players" },
        h("div", { class: "label" }, "Игроки"),
        st.players.map(function (p) {
          return h("div", { class: "card pl" }, h("div", { class: "nm" }, h("b", null, p.name),
            h("div", null, "улик: " + p.clues + " · фрагм.: " + p.fragments + " · сделок: " + p.deal_partners.length),
            st.round_index >= 5 ? h("div", { class: p.safe_tried ? "red" : "green" }, p.safe_tried ? "попытка сейфа потрачена" : "попытка сейфа: есть") : null),
            h("div", { class: "mn" }, money(p.balance)));
        }),
        h("div", { class: "card warm pl" }, icon("coin", 32), h("div", { class: "nm" }, h("b", null, "Банк: " + money(st.bank)),
          h("div", null, "Деньги на экране = купюры на руках"),
          st.ious.length ? h("div", { class: "red" }, "Расписки банка: " + money(st.ious.reduce(function (s, x) { return s + x[1]; }, 0))) : null),
          h("div", { class: "mn", style: "font-size:15px" }, "Сейф: " + (st.safe_opened_by !== null ? "вскрыт" : money(st.prize_in_safe)))));
    },
  });

  var MoreDialog = inherit(function (hub) { this.hub = hub; }, {
    modal: true,
    render: function () {
      var hub = this.hub, st = A.st;
      function go(fn) { return function () { A.pop(); fn(); }; }
      return h("div", null, h("h2", null, "Ещё"),
        h("div", { class: "menu-list" },
          st.round_index >= 5 ? btn("Сейф: попробовать вскрыть", go(function () { hub.openSafe(); }), { kind: "danger" }) : null,
          h("div", { class: "grid2" },
            btn("Дуэль", go(function () { hub.duel(); })),
            btn("Кубик", go(function () { hub.dice(); }))),
          h("div", { class: "grid2" },
            btn("Как играть", go(function () { A.push(new RulesDialog()); })),
            btn("Журнал", go(function () { A.push(new LogScene()); }))),
          btn(Sound.muted ? "Звук: выкл — включить" : "Звук: вкл — выключить", function () { Sound.toggle(); }),
          btn("Выйти в меню", go(function () { A.save(); A.reset(new MenuScene()); }), { kind: "ghost" })),
        h("div", { class: "actions" }, btn("Закрыть", function () { A.pop(); }, { kind: "accent" })));
    },
  });

  var AlibiReveal = inherit(function () { Sound.play("sting"); }, {
    modal: true,
    render: function () {
      var st = A.st, mism = G.alibiMismatch(st);
      return h("div", null, h("h2", null, icon("eye", 30), "Где вы были в ночь кражи?"),
        h("div", { class: "stack" }, st.players.map(function (p, i) {
          var v = st.alibi_answers[String(i)], bad = mism.indexOf(i) >= 0;
          return h("div", { class: "alibi-row " + (bad ? "bad" : "") },
            h("div", null, h("div", { class: "pl-n" }, p.name), h("div", { class: bad ? "red" : "gold" }, v !== undefined ? st.alibi_places[v] : "—")),
            bad ? h("b", { class: "red small" }, "не совпало") : null);
        })),
        h("p", { class: "muted", style: "margin-top:12px" }, mism.length
          ? "Невиновные помнят точно. Не совпал — значит вор… или забывчивый невиновный. Пусть объяснит!"
          : "Все совпали — вор угадал удачно. Ищите его по деталям рассказа."),
        h("div", { class: "actions" }, btn("Обсуждаем", function () { A.pop(); }, { kind: "accent big" })));
    },
  });

  var LogScene = inherit(function () {}, {
    modal: true,
    render: function () {
      return h("div", null, h("h2", null, "Журнал"), h("p", { class: "muted small" }, "Новое — сверху."),
        h("ul", { class: "dots small", style: "margin-top:8px" }, A.st.log.slice().reverse().map(function (l) { return h("li", null, l); })),
        h("div", { class: "actions" }, btn("Закрыть", function () { A.pop(); }, { kind: "accent" })));
    },
  });

  // ===================================================================== final
  var FinalScene = inherit(function () {
    this.bonusLines = ["Тайные бонусы уже выданы."];
    if (!A.st.final_paid) {
      var lines = G.paySecretBonuses(A.st);
      this.bonusLines = lines.length ? lines : ["Тайных бонусов нет."];
      A.st.final_paid = true;
      A.save();
    }
    this.show = false;
  }, {
    render: function () {
      var self = this, st = A.st;
      if (!this.show)
        return h("div", { class: "screen center" }, icon("scales", 80), h("h1", { style: "font-size:42px;margin-top:8px" }, "Подсчёт"), rule(),
          h("p", { style: "margin:10px 0 16px" }, "Сейчас откроются все роли. Банк выдаёт тайные бонусы ролей " +
            "(детектив — за улики, аферист — комиссия за сделки, сообщник — доля из сейфа):"),
          h("div", { class: "card stack" }, this.bonusLines.map(function (l) { return h("p", { class: "big" }, l); })),
          h("div", { class: "spacer" }),
          btn("Раскрыть роли и итог", function () { self.show = true; Sound.play("fanfare"); A.scrollTop = true; }, { kind: "accent huge" }));
      var res = G.finalResults(st);
      var winners = res.filter(function (r) { return r.place === 1; });
      var notes = ["Вор — " + G.name(st, G.thief(st)) + ".", "Код сейфа: " + st.code.join("") + "."];
      if (winners.some(function (r) { return r.tie; })) notes.push("Ничья — бросьте кубик.");
      if (st.safe_opened_by === null) notes.push("Сейф не вскрыли: " + money(st.prize_in_safe) + " — в банк.");
      return h("div", { class: "screen" },
        h("div", { class: "center" }, fedora(90), h("p", { class: "muted" }, "Победитель"),
          h("h1", { style: "font-size:36px" }, winners.map(function (r) { return r.name; }).join(" и ") + "!"), rule()),
        h("div", { class: "stack" }, res.map(function (r) {
          return h("div", { class: "card res " + (r.place === 1 ? "gold deco" : "") },
            h("div", { class: "place" }, r.place),
            h("div", { class: "info" }, h("b", { style: "font-size:19px" }, r.name), h("div", { class: "gold small", style: "font-weight:800" }, D.ROLES[r.role].name),
              h("div", { class: "small " + (r.mission ? "green" : "red") }, r.mission ? "Миссия выполнена: +" + money(C.MISSION_BONUS) : "Миссия провалена: " + r.reasons.join(", ")),
              h("div", { class: "muted small" }, "на руках " + money(r.money))),
            h("div", { class: "tot" }, money(r.total)));
        })),
        h("p", { class: "gold", style: "margin:14px 0" }, notes.join(" ")),
        h("div", { class: "grid2" },
          btn("Кубик", function () {
            A.push(new RollsDialog("Финальная дуэль", winners.map(function (r) { return [r.index, r.name]; }), function () {}, { uniqueTop: true }));
          }),
          btn("Меню", function () { A.reset(new MenuScene()); }, { kind: "ghost" })));
    },
  });

  // ===================================================================== start
  var last = performance.now();
  setInterval(function () {
    var now = performance.now(), dt = Math.min((now - last) / 1000, 3600);
    last = now;
    A.stack.slice().forEach(function (s) { if (s.update) s.update(dt); });
    drawToast(false);
  }, 200);

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") { if (A.hub()) keepAwake(); }
    else A.save();
  });
  window.addEventListener("pagehide", function () { A.save(); });
  document.addEventListener("pointerdown", function () { Sound.unlock(); }, { passive: true });
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); A.installEvt = e; renderSoon(); });

  // Android "back": close the top dialog instead of leaving the game.
  try {
    history.replaceState({ ten: 0 }, "");
    history.pushState({ ten: 1 }, "");
    window.addEventListener("popstate", function () {
      history.pushState({ ten: 1 }, "");
      var top = A.top();
      if (top) { top.back(); renderSoon(); }
    });
  } catch (e) { /* file:// in some browsers */ }

  if ("serviceWorker" in navigator && /^https?:/.test(location.protocol) && !window.SINGLE_FILE)
    navigator.serviceWorker.register("sw.js").catch(function () { /* offline cache is optional */ });

  window.TEN = { A: A, render: render };   // for tests in the browser console
  A.reset(new MenuScene());
})();
