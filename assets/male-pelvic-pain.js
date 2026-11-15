/* Male pelvic pain page: NIH-CPSI symptom tracker.
   Everything runs in the browser. Answers and saved scores are kept only in this
   browser's storage on this device, and can be cleared with one button. */
(function () {
  "use strict";
  var form = document.getElementById("mpp-cpsi");
  if (!form) return;
  var KEY = "mpp-cpsi-v1";
  var PARTS = ["q1a", "q1b", "q1c", "q1d", "q2a", "q2b", "q3", "q4", "q5", "q6", "q7", "q8", "q9"];
  var QUESTIONS = [["1", ["q1a", "q1b", "q1c", "q1d"]], ["2", ["q2a", "q2b"]], ["3", ["q3"]], ["4", ["q4"]],
    ["5", ["q5"]], ["6", ["q6"]], ["7", ["q7"]], ["8", ["q8"]], ["9", ["q9"]]];
  var MEANINGFUL = 6;   // Propert et al. 2006: a 6-point drop in total score best predicted improvement
  var LOW_START = 15;   // below this first total, the 6-point rule is not applied (it was derived in men with moderate or severe symptoms)

  var scoreBox = document.getElementById("mpp-score");
  var saveBox = document.getElementById("mpp-save");
  var dateInput = document.getElementById("mpp-date");
  var statusEl = document.getElementById("mpp-status");
  var historyBox = document.getElementById("mpp-history");

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || "{}");
      if (!s || typeof s !== "object") s = {};
      if (!Array.isArray(s.entries)) s.entries = [];
      s.entries = s.entries.filter(function (e) { return e && /^\d{4}-\d{2}-\d{2}$/.test(e.d) && typeof e.t === "number"; });
      if (!s.draft || typeof s.draft !== "object") s.draft = {};
      return s;
    } catch (e) { return { draft: {}, entries: [] }; }
  }
  function store() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable: page still works */ }
  }
  var state = load();

  function answers() {
    var a = {};
    PARTS.forEach(function (n) {
      var el = form.querySelector('input[name="' + n + '"]:checked');
      if (el) a[n] = parseInt(el.value, 10);
    });
    return a;
  }
  function sum(a, names) { return names.reduce(function (t, n) { return t + (a[n] || 0); }, 0); }
  function scores(a) {
    var p = sum(a, ["q1a", "q1b", "q1c", "q1d", "q2a", "q2b", "q3", "q4"]);
    var u = sum(a, ["q5", "q6"]);
    var q = sum(a, ["q7", "q8", "q9"]);
    return { p: p, u: u, q: q, t: p + u + q };
  }
  function missing(a) {
    return QUESTIONS.filter(function (qq) { return qq[1].some(function (n) { return !(n in a); }); }).map(function (qq) { return qq[0]; });
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function parseISO(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function nice(s) { return parseISO(s).toLocaleDateString("en-CA", { day: "numeric", month: "short", year: "numeric" }); }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }

  function tiles(s) {
    return '<dl class="mpp-subs">' +
      '<div><dt>Pain</dt><dd>' + s.p + ' <small>/ 21</small></dd></div>' +
      '<div><dt>Urinary</dt><dd>' + s.u + ' <small>/ 10</small></dd></div>' +
      '<div><dt>Life impact</dt><dd>' + s.q + ' <small>/ 12</small></dd></div>' +
      '<div class="mpp-total"><dt>Total</dt><dd>' + s.t + ' <small>/ 43</small></dd></div></dl>';
  }

  function renderScore() {
    var a = answers();
    var miss = missing(a);
    if (miss.length === 9) {
      scoreBox.innerHTML = '<p class="da-empty">Answer all 9 questions to see your scores.</p>';
      saveBox.hidden = true;
      return;
    }
    if (miss.length) {
      scoreBox.innerHTML = '<p class="mpp-progress">' + (9 - miss.length) + ' of 9 questions answered. Still to answer: question' +
        (miss.length > 1 ? "s " : " ") + miss.join(", ") + '.</p>';
      saveBox.hidden = true;
      return;
    }
    var s = scores(a);
    var html = '<h3>Your scores for the last week</h3>' + tiles(s) +
      '<p class="da-small">Lower is better. Save this score, then fill in the questionnaire again in a few weeks to compare.</p>';
    // Compare with the most recent saved score from an earlier date than the one this score will be saved under
    var d = dateInput.value || todayISO();
    var earlier = state.entries.filter(function (en) { return en.d < d; });
    var last = earlier.length ? earlier[earlier.length - 1] : null;
    if (last) {
      var diff = last.t - s.t;
      html += '<p>' + (diff > 0 ? "That is " + plural(diff, "point") + " lower than" : diff < 0 ? "That is " + plural(-diff, "point") + " higher than" : "That is the same as") +
        ' your last saved total (' + nice(last.d) + ').</p>';
    }
    scoreBox.innerHTML = html;
    saveBox.hidden = false;
  }

  function changeText() {
    var e = state.entries;
    if (e.length < 2) return '<p class="da-small">Save another score in a few weeks to see how things are changing.</p>';
    var first = e[0], prev = e[e.length - 2], last = e[e.length - 1], diff = first.t - last.t;
    var since = " since your first saved score on " + nice(first.d) + ".";
    var than = " than your first saved score on " + nice(first.d) + ".";
    // A clear rise, from the previous score or from the first, is said plainly
    var risePrev = last.t - prev.t, riseFirst = last.t - first.t;
    if (risePrev >= MEANINGFUL || riseFirst >= MEANINGFUL) {
      var fromPrev = risePrev >= riseFirst;
      return '<p class="mpp-change">Your total score has gone <strong>up by ' + plural(fromPrev ? risePrev : riseFirst, "point") + '</strong> since your ' +
        (fromPrev ? "previous" : "first") + ' saved score on ' + nice(fromPrev ? prev.d : first.d) + '. That is a clear change. ' +
        'Please contact your care team or book a visit to talk about your plan. If you have any <a href="#urgent">warning signs</a>, get help urgently.</p>';
    }
    if (first.t < LOW_START) {
      var lowNote = ' Your first score was fairly low, so smaller changes can still matter to you. The 6-point rule of thumb comes from men who started with moderate or severe symptoms.';
      if (diff > 0) return '<p class="mpp-change">Your total score is ' + plural(diff, "point") + ' lower' + than + lowNote + '</p>';
      if (diff === 0) return '<p class="mpp-change">Your total score is the same as' + since.replace(" since", "") + lowNote + '</p>';
      return '<p class="mpp-change">Your total score is ' + plural(-diff, "point") + ' higher' + than +
        ' Small ups and downs are common. If symptoms keep getting worse, or you notice any <a href="#urgent">warning signs</a>, contact your doctor.</p>';
    }
    if (diff >= MEANINGFUL) {
      return '<p class="mpp-change">Your total score has dropped by <strong>' + plural(diff, "point") + '</strong>' + since +
        ' In studies, a drop of 6 points or more was the size of change that matched men feeling better.</p>';
    }
    if (diff > 0) {
      return '<p class="mpp-change">Your total score is ' + plural(diff, "point") + ' lower' + than +
        ' Small ups and downs are common. Keep going and look at the trend over a month or more. In studies, a drop of 6 points or more matched men feeling better.</p>';
    }
    if (diff === 0) {
      return '<p class="mpp-change">Your total score is the same as' + since.replace(" since", "") + ' Recovery often takes a few months. Talk with your care team about whether to adjust your plan.</p>';
    }
    return '<p class="mpp-change">Your total score is ' + plural(-diff, "point") + ' higher' + than +
      ' Small ups and downs are common. If symptoms keep getting worse, or you notice any <a href="#urgent">warning signs</a>, contact your doctor.</p>';
  }

  function chart(width) {
    var e = state.entries;
    if (e.length < 2) return "";
    // Drawn at the real on-screen width so text stays readable on phones
    var W = Math.max(260, Math.min(640, Math.round(width || 600))), H = W < 420 ? 200 : 230, L = 30, R = 8, T = 14, B = 30;
    var t0 = parseISO(e[0].d).getTime(), t1 = parseISO(e[e.length - 1].d).getTime();
    var span = Math.max(t1 - t0, 1);
    function x(d) { return L + (parseISO(d).getTime() - t0) / span * (W - L - R); }
    function y(v) { return T + (1 - v / 43) * (H - T - B); }
    var g = "";
    [0, 10, 20, 30, 40].forEach(function (v) {
      g += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>' +
        '<text class="axis" x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v + '</text>';
    });
    var goal = e[0].t - MEANINGFUL;
    if (e[0].t >= LOW_START) {
      g += '<line class="goal" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(goal) + '" y2="' + y(goal) + '"/>' +
        '<text class="goal-label" x="' + (L + 6) + '" y="' + Math.min(y(goal) + 16, y(0) - 4) + '" text-anchor="start">6 points below your first score</text>';
    }
    var pts = e.map(function (en) { return x(en.d).toFixed(1) + "," + y(en.t).toFixed(1); }).join(" ");
    g += '<polyline class="line" points="' + pts + '"/>';
    e.forEach(function (en) {
      g += '<circle class="dot" cx="' + x(en.d).toFixed(1) + '" cy="' + y(en.t).toFixed(1) + '" r="5"><title>' + nice(en.d) +
        ": total " + en.t + " (pain " + en.p + ", urinary " + en.u + ", life impact " + en.q + ")</title></circle>";
    });
    var labels = e.length <= 6 ? e : [e[0], e[e.length - 1]];
    labels.forEach(function (en, i) {
      var anchor = en === e[0] ? "start" : en === e[e.length - 1] ? "end" : "middle";
      g += '<text class="axis" x="' + x(en.d).toFixed(1) + '" y="' + (H - 10) + '" text-anchor="' + anchor + '">' +
        parseISO(en.d).toLocaleDateString("en-CA", { day: "numeric", month: "short" }) + '</text>';
    });
    return '<svg class="mpp-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Total score over time, from ' +
      e[0].t + ' on ' + nice(e[0].d) + ' to ' + e[e.length - 1].t + ' on ' + nice(e[e.length - 1].d) + '. The table below lists every score.">' + g + '</svg>';
  }

  function renderHistory() {
    var e = state.entries;
    if (!e.length) { historyBox.hidden = true; historyBox.innerHTML = ""; return; }
    var rows = e.slice().reverse().map(function (en) {
      return '<tr><td>' + nice(en.d) + '</td><td>' + en.p + '</td><td>' + en.u + '</td><td>' + en.q + '</td><td>' + en.t +
        '</td><td><button class="mpp-del" type="button" data-del="' + en.d + '" aria-label="Delete the score for ' + nice(en.d) + '">Delete</button></td></tr>';
    }).join("");
    historyBox.innerHTML = '<h3>Your saved scores</h3>' + changeText() + '<div class="mpp-chart-box"></div>' +
      '<table class="mpp-table"><caption class="da-small" style="text-align:left;caption-side:bottom;padding-top:8px">NIH-CPSI scores. Pain 0 to 21, urinary 0 to 10, life impact 0 to 12, total 0 to 43. Lower is better.</caption>' +
      '<thead><tr><th scope="col">Date</th><th scope="col">Pain</th><th scope="col">Urinary</th><th scope="col">Life impact</th><th scope="col">Total</th><th scope="col"><span class="hp">Delete</span></th></tr></thead><tbody>' +
      rows + '</tbody></table>' +
      '<div class="button-row"><button class="button button-quiet" type="button" id="mpp-print">Print my scores</button>' +
      '<button class="button button-quiet" type="button" id="mpp-clear">Clear all my scores</button></div>';
    historyBox.hidden = false;
    drawChart();
  }
  function drawChart() {
    var box = historyBox.querySelector(".mpp-chart-box");
    if (box) box.innerHTML = chart(box.clientWidth);
  }
  var resizeTimer, lastWidth = window.innerWidth;
  window.addEventListener("resize", function () {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawChart, 150);
  });

  function restoreDraft() {
    Object.keys(state.draft).forEach(function (n) {
      if (PARTS.indexOf(n) < 0) return;
      var el = form.querySelector('input[name="' + n + '"][value="' + parseInt(state.draft[n], 10) + '"]');
      if (el) el.checked = true;
    });
  }

  form.addEventListener("change", function () {
    state.draft = answers();
    store();
    statusEl.textContent = "";
    renderScore();
  });

  document.getElementById("mpp-save-btn").addEventListener("click", function () {
    var a = answers();
    if (missing(a).length) return;
    var d = dateInput.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(parseISO(d).getTime())) {
      statusEl.textContent = "Please choose a date.";
      dateInput.focus();
      return;
    }
    if (d > todayISO()) {
      statusEl.textContent = "Please choose today or an earlier date.";
      dateInput.focus();
      return;
    }
    var s = scores(a);
    var entry = { d: d, p: s.p, u: s.u, q: s.q, t: s.t, a: a };
    var replaced = false;
    state.entries = state.entries.filter(function (en) { if (en.d === d) { replaced = true; return false; } return true; });
    state.entries.push(entry);
    state.entries.sort(function (x, y) { return x.d < y.d ? -1 : x.d > y.d ? 1 : 0; });
    // Clear the answers so they don't pre-fill the form next time
    form.reset();
    state.draft = {};
    store();
    statusEl.textContent = "";
    renderScore();
    scoreBox.innerHTML = '<p><strong>' + (replaced ? "Updated" : "Saved") + ' your score for ' + nice(d) + ': total ' + s.t +
      '.</strong> The questions have been cleared, ready for next time. Your saved scores are below.</p>';
    dateInput.value = todayISO();
    renderHistory();
  });
  dateInput.addEventListener("change", function () {
    if (!saveBox.hidden) renderScore();
  });

  document.getElementById("mpp-reset").addEventListener("click", function () {
    form.reset();
    state.draft = {};
    store();
    statusEl.textContent = "";
    dateInput.value = todayISO();
    renderScore();
    var first = form.querySelector("input");
    if (first) first.focus();
  });

  historyBox.addEventListener("click", function (ev) {
    var t = ev.target;
    if (t.matches("[data-del]")) {
      state.entries = state.entries.filter(function (en) { return en.d !== t.getAttribute("data-del"); });
      store();
      renderHistory();
      renderScore();
      statusEl.textContent = "Score deleted.";
    } else if (t.id === "mpp-print") {
      document.documentElement.classList.add("mpp-print-mode");
      window.print();
      setTimeout(function () { document.documentElement.classList.remove("mpp-print-mode"); }, 500);
    } else if (t.id === "mpp-clear") {
      if (!window.confirm("Clear all your saved scores and answers from this device? This can’t be undone.")) return;
      state = { draft: {}, entries: [] };
      try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
      form.reset();
      dateInput.value = todayISO();
      renderScore();
      renderHistory();
      statusEl.textContent = "";
      scoreBox.innerHTML = '<p class="da-empty">All your answers and saved scores have been cleared from this device.</p>';
    }
  });
  window.addEventListener("afterprint", function () { document.documentElement.classList.remove("mpp-print-mode"); });

  dateInput.value = todayISO();
  dateInput.max = todayISO();
  restoreDraft();
  renderScore();
  renderHistory();
})();
