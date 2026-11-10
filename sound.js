// All sounds are synthesized in code (port of ui/sound.py). Phones allow audio only after a tap,
// so the context is created on the first touch.
(function (root) {
  var NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  function f(name) {
    var oct = +name.slice(-1), k = NOTES.indexOf(name.slice(0, -1));
    return 440 * Math.pow(2, (k - 9) / 12) * Math.pow(2, oct - 4);
  }
  var DEFS = {
    tick: [[[1800, 0.03, 0.5]], "sine", 8],
    chime: [[[f("E5"), 0.12, 0.5], [f("B5"), 0.35, 0.5]], "bell", 3],
    sting: [[[f("A2"), 0.25, 0.9], [f("E3"), 0.25, 0.8], [f("A3"), 0.7, 0.9]], "square", 2],
    timeup: [[[f("G4"), 0.18, 0.8], [f("E4"), 0.18, 0.8], [f("C4"), 0.18, 0.8], [f("G3"), 0.6, 0.9]], "square", 2.5],
    fanfare: [[[f("C5"), 0.12, 0.8], [f("E5"), 0.12, 0.8], [f("G5"), 0.12, 0.8], [f("C6"), 0.7, 0.9]], "bell", 2],
    alarm: [[[880, 0.18, 0.8], [660, 0.18, 0.8], [880, 0.18, 0.8], [660, 0.18, 0.8], [880, 0.18, 0.8],
      [660, 0.18, 0.8], [880, 0.18, 0.8], [660, 0.18, 0.8]], "square", 0.5],
    cash: [[[f("B5"), 0.06, 0.6], [f("E6"), 0.4, 0.7]], "bell", 3],
    click: [[[f("C6"), 0.03, 0.3]], "sine", 6],
    tension: [[[f("A2"), 0.25, 0.7], [0, 0.25, 0], [f("A2"), 0.25, 0.7], [f("A#2"), 0.25, 0.7],
      [f("A2"), 0.25, 0.7], [0, 0.25, 0], [f("A2"), 0.25, 0.7], [f("A#2"), 0.25, 0.7]], "square", 4],
    dial: [Array.from({ length: 18 }, function (_, k) { return [300 + 40 * (k % 5), 0.04, 0.4]; }), "square", 6],
  };

  var ctx = null, buffers = {}, loop = null;
  var muted = false;
  try { muted = localStorage.getItem("ten.muted") === "1"; } catch (e) { /* private mode */ }

  function build(parts, wave, decay) {
    var rate = ctx.sampleRate, total = 0;
    parts.forEach(function (p) { total += Math.floor(rate * p[1]); });
    var buf = ctx.createBuffer(1, total, rate), data = buf.getChannelData(0), o = 0;
    parts.forEach(function (p) {
      var n = Math.floor(rate * p[1]);
      for (var t = 0; t < n; t++) {
        var env = Math.exp(-decay * t / n) * Math.min(1, t / 200), v = 0;
        if (p[0] > 0) {
          var ph = 2 * Math.PI * p[0] * t / rate;
          if (wave === "square") v = (Math.sin(ph) > 0 ? 1 : -1) * 0.45;
          else if (wave === "bell") v = Math.sin(ph) * 0.7 + Math.sin(2 * ph) * 0.2 + Math.sin(3 * ph) * 0.1;
          else v = Math.sin(ph);
        }
        data[o++] = 0.37 * p[2] * env * v;
      }
    });
    return buf;
  }

  function unlock() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      Object.keys(DEFS).forEach(function (k) { buffers[k] = build(DEFS[k][0], DEFS[k][1], DEFS[k][2]); });
    } catch (e) { ctx = null; }
  }

  function play(name, loopIt) {
    if (!ctx || muted || !buffers[name]) return null;
    var src = ctx.createBufferSource();
    src.buffer = buffers[name];
    src.loop = !!loopIt;
    src.connect(ctx.destination);
    src.start();
    return src;
  }

  root.Sound = {
    unlock: unlock,
    play: function (name) { play(name, false); },
    startLoop: function (name) { if (!loop) loop = play(name, true); },
    stopLoop: function () { if (loop) { try { loop.stop(); } catch (e) { /* already stopped */ } loop = null; } },
    get muted() { return muted; },
    toggle: function () {
      muted = !muted;
      try { localStorage.setItem("ten.muted", muted ? "1" : "0"); } catch (e) { /* ignore */ }
      if (muted) this.stopLoop();
      return muted;
    },
  };

  // ---------------------------------------------------------------- voice of the host
  // The phone reads aloud only what is public anyway: round speeches, events, the host's tasks,
  // «pass the phone to …», deals. Never anything from a private screen.
  var synth = root.speechSynthesis || null, ruVoice = null, voiceOn = true, primed = false;
  try { voiceOn = localStorage.getItem("ten.voice") !== "0"; } catch (e) { /* private mode */ }
  function pickVoice() {
    if (!synth) return;
    var ru = synth.getVoices().filter(function (v) { return /^ru/i.test(v.lang); });
    ruVoice = ru.filter(function (v) { return v.localService; })[0] || ru[0] || null;
  }
  if (synth) { pickVoice(); try { synth.onvoiceschanged = pickVoice; } catch (e) { /* old browsers */ } }
  function clean(s) {
    return String(s).replace(/[«»"]/g, "").replace(/(\d)\s?₽/g, "$1 рублей").replace(/₽/g, "рублей")
      .replace(/№/g, "номер ").replace(/\s+/g, " ").trim();
  }
  root.Voice = {
    get available() { return !!synth; },
    get on() { return voiceOn; },
    toggle: function () {
      voiceOn = !voiceOn;
      try { localStorage.setItem("ten.voice", voiceOn ? "1" : "0"); } catch (e) { /* ignore */ }
      if (!voiceOn && synth) synth.cancel();
      return voiceOn;
    },
    // iPhone speaks only after a tap: the first button press «primes» the voice with an empty phrase.
    unlock: function () {
      if (!synth || primed) return;
      primed = true;
      try { var u = new SpeechSynthesisUtterance(" "); u.volume = 0; synth.speak(u); } catch (e) { /* ignore */ }
    },
    say: function (text, queue) {
      if (!synth || !voiceOn || !text) return;
      try {
        if (!queue) synth.cancel();
        var u = new SpeechSynthesisUtterance(clean(text));
        u.lang = "ru-RU"; u.rate = 1.0;
        if (ruVoice) u.voice = ruVoice;
        synth.speak(u);
      } catch (e) { /* no voice on this device */ }
    },
    stop: function () { if (synth) synth.cancel(); },
  };
})(window);
