/* Raised PSA decision aid.
   Everything runs in the browser. Answers are kept only in this browser's storage. */
(function () {
  "use strict";
  var root = document.getElementById("part-psa");
  if (!root) return;
  var KEY = "psada-v1";

  var STAGES = {
    referred: "Newly referred with a raised PSA",
    monitor: "Having repeat PSA tests (monitoring)",
    mri: "Waiting for, or just had, an MRI",
    pr12: "MRI was PI-RADS 1 or 2 (not suspicious)",
    pr3: "MRI was PI-RADS 3 (unclear)",
    pr45: "MRI was PI-RADS 4 or 5 (suspicious)",
    biopsy: "Booked for a biopsy",
    benign: "Biopsy showed no cancer",
    atyp: "Biopsy showed atypical cells (ASAP) or PIN",
    gg1: "Grade Group 1 cancer (Gleason 3+3=6)",
    gg2: "Grade Group 2 or higher cancer"
  };
  var LEAN = {
    monitor: "Keep checking my PSA for now",
    mri: "Have an MRI, then decide about a biopsy",
    biopsy: "Have a biopsy (after an MRI, or straight away if the need is obvious)",
    stop: "Stop PSA testing",
    unsure: "Not sure yet"
  };
  var PIRADS = { "12": "PI-RADS 1 or 2", "3": "PI-RADS 3", "45": "PI-RADS 4 or 5" };

  var VALUES = ["know", "miss", "nobx", "risk", "overdx", "wait", "life", "time"];
  var VALUE_TEXT = {
    know: "finding out for sure", miss: "not missing a cancer that could spread",
    nobx: "avoiding a biopsy unless needed", risk: "avoiding biopsy risks such as infection and bleeding",
    overdx: "not being told about a harmless cancer", wait: "not living with uncertainty",
    life: "avoiding tests that may not change my life", time: "keeping tests and visits to a minimum"
  };
  var OPTS = ["monitor", "mri", "biopsy", "stop"];
  var OPT_NAME = { monitor: "Monitor", mri: "MRI first", biopsy: "Biopsy", stop: "Stop PSA testing" };
  var OPT_NOTE = {
    monitor: "A repeat PSA (often in about 6 to 12 weeks), then PSA tests at intervals, with an MRI or biopsy only if something changes.",
    mri: "A scan to decide whether a biopsy is worthwhile. In London the wait is usually about 3 months.",
    biopsy: "After an MRI, or straight away when the need is obvious, such as a clearly abnormal exam.",
    stop: "No more PSA tests unless new symptoms appear. Often sensible for older men or men with serious health problems."
  };
  // How each next step relates to each priority: [fit | part | trade, explanation]
  var LINEUP = {
    monitor: {
      know: ["trade", "a PSA test can’t show for sure whether there is cancer"],
      miss: ["part", "regular PSA checks are meant to catch change, but a significant cancer would be found later rather than now"],
      nobx: ["fit", "no biopsy unless something changes"],
      risk: ["fit", "no biopsy risks for now"],
      overdx: ["fit", "less chance of finding a slow-growing cancer that would never matter"],
      wait: ["trade", "you live with some uncertainty between tests"],
      life: ["fit", "few tests, and less chance of finding a cancer that would never have mattered"],
      time: ["fit", "a blood test every few months"]
    },
    mri: {
      know: ["part", "MRI is good at finding significant cancer, but only a biopsy can confirm it"],
      miss: ["fit", "in PRECISION, an MRI first found more significant cancers than biopsy for everyone (38 compared with 26 in 100), though a normal MRI doesn’t rule out significant cancer completely"],
      nobx: ["part", "in PRECISION, 28 in 100 men had a reassuring MRI and no biopsy, but the other 72 still had one"],
      risk: ["fit", "no needles in the prostate; a biopsy only if the MRI or other factors point to it"],
      overdx: ["fit", "fewer slow-growing cancers found than with biopsy for everyone (9 compared with 22 in 100 in PRECISION)"],
      wait: ["part", "a wait for the scan and the result, and possibly a biopsy after that"],
      life: ["part", "an MRI can lead to a biopsy, and to finding a cancer that would never have affected you, especially if you are older or have serious health problems"],
      time: ["part", "one scan of about 30 to 45 minutes, sometimes followed by a biopsy"]
    },
    biopsy: {
      know: ["fit", "the only test that shows for sure whether there is cancer and how aggressive it is, though it can still miss some"],
      miss: ["fit", "the most direct way to find a significant cancer now"],
      nobx: ["trade", "you have the biopsy"],
      risk: ["trade", "infection is uncommon (in different trials, 0 to about 3 in 100 after a transperineal biopsy and about 1 to 6 in 100 after a transrectal one), and bleeding is common and sometimes bothersome"],
      overdx: ["part", "it may find a slow-growing cancer; most of these can be safely watched with active surveillance instead of treated"],
      wait: ["fit", "a clear answer, usually within a few weeks"],
      life: ["trade", "it can find cancers that would never affect you, especially if you are older or have serious health problems"],
      time: ["part", "a short procedure and a day or two of taking it easy"]
    },
    stop: {
      know: ["trade", "you won’t find out whether there is a cancer"],
      miss: ["trade", "a cancer that does grow would be found later, usually because of symptoms"],
      nobx: ["fit", "no biopsy"],
      risk: ["fit", "no biopsy risks"],
      overdx: ["fit", "you won’t be told about a cancer that would never have harmed you"],
      wait: ["part", "no more results to wait for, though some men keep wondering"],
      life: ["fit", "no more tests that are unlikely to change how long or how well you live"],
      time: ["fit", "no more PSA tests or visits for this"]
    }
  };

  // Statistics Canada life table, men, 2021 to 2023: remaining years of life at each age (same as the treatment aid)
  var LIFE = [[55, 27.6], [60, 23.4], [65, 19.3], [70, 15.5], [75, 12.1], [80, 9.0], [85, 6.4], [90, 4.3]];
  var HEALTH = { better: 1.5, average: 1, worse: 0.5 };
  var HEALTH_TEXT = { better: "better than most", average: "about average", worse: "worse than most" };

  // Age bands: "older" = 75+, or 70+ with worse health, or under about 10 years expected; "mid" = 70 to 74; "young" = under 70
  var BAND_NOTE = {
    older: "<strong>Monitoring, or stopping PSA tests, is often the most sensible choice for you</strong>, unless there are warning signs: a clearly abnormal prostate exam, a very high or fast-rising PSA, or symptoms such as new bone pain. A slow-growing cancer found now would be unlikely to affect your life, and more tests and treatment can cause real problems.",
    mid: "<strong>At 70 to 74 and in reasonable health, this is an individual decision.</strong> Canadian guidance stops routine PSA testing at 70 for most men, but healthy men may decide with their doctor to continue. Monitoring, an MRI if there is real concern, or stopping testing can all be reasonable.",
    young: "<strong>The usual approach applies.</strong> For men under 70 in reasonable health, a raised PSA is worth looking into, starting with a repeat test. Dr. Power will suggest monitoring, an MRI or a biopsy depending on your results."
  };
  var ROUTE_BADGE = {
    older: { monitor: ["first", "Often the most sensible choice at your age and health"], stop: ["first", "Often the most sensible choice at your age and health"],
      mri: ["", "Usually only if there is a strong reason and you would want treatment"], biopsy: ["", "Only if there is an obvious need, such as warning signs"] },
    mid: { monitor: ["", "A common choice at your age"], stop: ["", "A reasonable choice at your age; an individual decision"],
      mri: ["", "An option if there is real concern and you would want treatment"], biopsy: ["", "If there is an obvious need"] },
    young: { monitor: ["", "Often the first step, especially when the rise is modest"], mri: ["", "Often the next step if concern remains"],
      biopsy: ["", "When the need is obvious"], stop: ["", "Not usually the first choice for healthy men under 70, but it is your decision"] }
  };

  // ---------------------------------------------------------------- state
  function store(get) {
    try {
      if (get) return JSON.parse(localStorage.getItem(KEY) || "{}");
      localStorage.setItem(KEY, JSON.stringify(get === false ? {} : collect()));
    } catch (e) { return {}; }
  }
  function fields() { return document.querySelectorAll("main input[name], main textarea[name]"); }
  function collect() {
    var data = {};
    Array.prototype.forEach.call(fields(), function (el) {
      if (el.type === "radio") { if (el.checked && el.value) data[el.name] = el.value; }
      else if (el.type === "checkbox") { if (el.checked) (data[el.name] = data[el.name] || []).push(el.value); }
      else if (el.value) data[el.name] = el.value;
    });
    return data;
  }
  function restore(data) {
    Array.prototype.forEach.call(fields(), function (el) {
      var v = data[el.name];
      if (el.type === "radio") el.checked = v === el.value && v !== undefined;
      else if (el.type === "checkbox") el.checked = !!(v && v.indexOf(el.value) > -1);
      else el.value = v || "";
    });
  }
  function val(name) {
    var el = document.querySelector('main input[name="' + name + '"]:checked') ||
      document.querySelector('main input[type="text"][name="' + name + '"], main textarea[name="' + name + '"]');
    return el ? el.value : "";
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  // Read only the leading number: "38 cm3" -> 38, "6.2 (Oct 3)" -> 6.2, "6,2" -> 6.2
  function num(s) {
    var m = String(s).match(/^\s*(\d+(?:[.,]\d*)?|[.,]\d+)/);
    if (!m) return null;
    var x = parseFloat(m[1].replace(",", "."));
    return isNaN(x) ? null : x;
  }

  // ---------------------------------------------------------------- where am I
  var stagesBox = document.getElementById("psa-stages");
  var allWrap = document.getElementById("psa-stage-all-wrap");
  function renderStage(scroll) {
    var s = val("stage");
    Array.prototype.forEach.call(stagesBox.querySelectorAll(".psa-stage"), function (d) {
      var match = d.getAttribute("data-stage") === s;
      d.hidden = !!s && !match;
      if (s) d.open = match;
    });
    stagesBox.classList.toggle("psa-picked", !!s);
    allWrap.hidden = !s;
    if (scroll && s) {
      var card = stagesBox.querySelector('[data-stage="' + s + '"]');
      if (card && card.getBoundingClientRect().top > window.innerHeight - 80) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  // ---------------------------------------------------------------- PSA density
  function density() {
    var psa = num(val("psa")), vol = num(val("vol"));
    if (psa == null || vol == null) return { empty: true, psa: psa, vol: vol };
    if (psa <= 0 || psa > 500) return { err: "Check your PSA: enter a number such as 6.2." };
    if (vol < 5 || vol > 400) return { err: "Check the prostate volume: most are between about 15 and 150 mL. Enter the number from your report, such as 45." };
    // Everything (number shown, band, guideline sentence) uses the same value rounded to 2 decimals
    var d = Math.round((psa / vol) * 100) / 100;
    return { psa: psa, vol: vol, d: d, band: d < 0.10 ? "low" : d < 0.15 ? "mid" : "high" };
  }
  function fmt(d) { return d < 0.01 ? "under 0.01" : d.toFixed(2); }
  var BAND = {
    low: ["Lower", "For its size, your prostate is making a fairly small amount of PSA. American guidelines link a PSA density of 0.10 or less with a low chance of significant cancer."],
    mid: ["In between", "This is in the middle range. On its own it neither rules a biopsy in nor out; your MRI score, PSA trend, exam and family history matter more here."],
    high: ["Higher", "For its size, your prostate is making more PSA than expected. Canadian and American guidelines mention 0.15 or more as a sign of a higher chance of significant cancer, so a biopsy is more often advised, even when the MRI looks normal."]
  };
  function guideFor(p, r) {
    if (!p || !r || r.d == null) return "";
    var d = r.d;   // already rounded, same value as the band
    if (p === "12") return d < 0.15
      ? "With a negative MRI (PI-RADS 1 or 2) and a PSA density under 0.15, many men choose, after talking it over, to <strong>skip a biopsy</strong> and keep checking their PSA, if the exam is normal and there is no strong family history."
      : "With a negative MRI (PI-RADS 1 or 2) but a PSA density of 0.15 or more, a biopsy is <strong>often still offered</strong>, because the MRI may have missed a significant cancer.";
    if (p === "3") return "In Ontario, PI-RADS 3 counts as a positive MRI, and a biopsy with targeted and systematic samples is <strong>usually recommended</strong>." +
      (d < 0.10 ? " Because your PSA density is under 0.10, European guidelines would allow skipping the biopsy and checking your PSA instead, if there is no strong family history. This is something to discuss with Dr. Power, not the usual approach here." : "");
    return "With a suspicious MRI (PI-RADS 4 or 5), a biopsy with targeted and systematic samples is <strong>usually recommended</strong>, whatever the PSA density.";
  }
  function renderDensity() {
    var box = document.getElementById("psa-calc-out");
    var r = density();
    if (r.err) { box.innerHTML = "<p>" + esc(r.err) + "</p>"; return r; }
    if (r.empty) {
      box.innerHTML = '<p class="da-empty">Enter your PSA and your prostate volume to see your PSA density.</p>' +
        (r.psa != null && r.vol == null ? '<p class="da-small">Your prostate volume is on your MRI or ultrasound report. If you don’t have it, ask our office.</p>' : "");
      return r;
    }
    var b = BAND[r.band];
    var pos = Math.min(100, (r.d / 0.30) * 100);
    var g = guideFor(val("pirads"), r);
    box.innerHTML =
      "<p><strong>Your PSA density</strong></p>" +
      '<p><span class="psa-psad">' + fmt(r.d) + '</span><span class="psa-psad-band psa-band-' + r.band + '">' + b[0] + "</span></p>" +
      '<p class="da-small">PSA ' + esc(String(r.psa)) + " ÷ prostate volume " + esc(String(r.vol)) + " mL = " + fmt(r.d) + " (rounded to two decimal places)</p>" +
      '<div class="psa-scale" aria-hidden="true"><i style="left:' + pos.toFixed(1) + '%"></i></div>' +
      '<div class="psa-scale-labels" aria-hidden="true"><span style="left:0">0</span><span style="left:33.3%">0.10</span><span style="left:50%">0.15</span><span style="left:100%">0.30+</span></div>' +
      "<p>" + b[1] + "</p>" +
      (g ? "<p>" + g + "</p>" : '<p class="da-small">Choose your MRI score above, if you know it, to see how the Ontario guidance combines it with PSA density.</p>') +
      '<p class="da-small">This is a guide for your conversation with Dr. Power, not a diagnosis or a risk estimate. Your age, exam, PSA trend, family history and wishes also count.</p>';
    return r;
  }

  // ---------------------------------------------------------------- age and health
  function lifeYears() {
    var age = num(val("age"));
    var health = val("health");
    if (!age || age < 30 || age > 105) return null;
    age = Math.round(age);
    var base;
    if (age <= LIFE[0][0]) base = LIFE[0][1] + (LIFE[0][0] - age) * 0.9;
    else if (age >= LIFE[LIFE.length - 1][0]) base = LIFE[LIFE.length - 1][1];
    else for (var i = 0; i < LIFE.length - 1; i++) {
      var a = LIFE[i], b = LIFE[i + 1];
      if (age >= a[0] && age <= b[0]) { base = a[1] + (b[1] - a[1]) * (age - a[0]) / (b[0] - a[0]); break; }
    }
    var est = health ? base * HEALTH[health] : null;
    return { age: age, base: base, est: est, lo: est != null ? Math.max(1, Math.round(est * 0.75)) : null, hi: est != null ? Math.round(est * 1.25) : null, health: health };
  }
  function ageBand(le) {
    if (!le) return "";
    if (le.age >= 75 || (le.age >= 70 && le.health === "worse") || (le.est != null && le.est < 10)) return "older";
    if (le.age >= 70) return "mid";
    return "young";
  }
  function bandNote(le) {
    var band = ageBand(le);
    if (!band) return "";
    var t = BAND_NOTE[band];
    if (band === "older" && le.health === "better" && le.est != null && le.est >= 10)
      t += " Because your health is better than most, you may still have many years ahead; some men in your situation choose to look further, and that is worth discussing with Dr. Power.";
    return t;
  }
  function renderLife(le) {
    var box = document.getElementById("psa-le");
    var raw = val("age");
    if (!le) {
      box.innerHTML = raw ? '<p>Enter your age as a number, such as 72.</p>' : '<p class="da-empty">Enter your age and health to see how they affect your choices.</p>';
      return;
    }
    var band = ageBand(le);
    var html = "<p>On average, Canadian men aged " + le.age + " live about <strong>" + Math.round(le.base) + " more years</strong>.</p>";
    if (le.est != null) html += "<p>Adjusted for your health, a rough range for you is <strong>" + le.lo + " to " + le.hi + " years</strong>.</p>";
    else html += '<p class="da-empty">Choose how your health compares, for an estimate adjusted for you.</p>';
    html += '<p class="da-agenote">' + bandNote(le) + "</p>";
    if (le.age < 45) html += '<p class="da-small">PSA testing is rarely recommended before 45, so a raised result at your age is worth discussing carefully with Dr. Power.</p>';
    html += '<p class="da-small">These are averages from Statistics Canada life tables, and rating your own health is hard. Nobody can predict how long one person will live, so talk this over with Dr. Power.</p>';
    box.innerHTML = html;
  }
  function renderRoutes(le) {
    var band = ageBand(le);
    Array.prototype.forEach.call(document.querySelectorAll("[data-route-fit]"), function (el) {
      var bd = band && ROUTE_BADGE[band][el.getAttribute("data-route-fit")];
      el.hidden = !bd;
      el.textContent = bd ? bd[1] : "";
      el.className = "da-fit" + (bd && bd[0] ? " da-fit-" + bd[0] : "");
    });
    var note = document.getElementById("psa-age-note");
    if (band) { note.innerHTML = "<p><strong>Your age and health:</strong></p><p>" + bandNote(le) + '</p><p class="da-small">Based on what you entered in <a href="#part-age">Part 2</a>.</p>'; note.hidden = false; }
    else { note.innerHTML = '<p class="da-small">Enter your age and health in <a href="#part-age">Part 2</a> to see which routes usually make the most sense for you.</p>'; note.hidden = false; }
  }

  // ---------------------------------------------------------------- values
  function priorities() {
    var out = {};
    VALUES.forEach(function (v) { var x = val("v-" + v); if (x !== "") out[v] = parseInt(x, 10); });
    return out;
  }
  function renderLineup() {
    var box = document.getElementById("psa-lineup");
    var pr = priorities();
    var marked = VALUES.filter(function (v) { return pr[v] > 0; });
    var head = "<h3>How the next steps line up with what you said</h3>";
    if (!Object.keys(pr).length) { box.innerHTML = head + '<p class="da-empty">Mark how important each item is to you, and this section will show where each next step fits your priorities and where it asks you to accept a trade-off.</p>'; return; }
    if (!marked.length) { box.innerHTML = head + "<p>You marked everything as not important, so none of the trade-offs stand out for you. Your decision may come down to Dr. Power’s advice for your situation.</p>"; return; }
    marked.sort(function (a, b) { return pr[b] - pr[a]; });
    var stage = val("stage"), note = "", le = lifeYears(), band = ageBand(le);
    var old = band === "older" || band === "mid";
    var opts = old ? ["monitor", "stop", "mri", "biopsy"] : ["monitor", "mri", "biopsy", "stop"];
    if (stage === "gg1" || stage === "gg2") {
      box.innerHTML = head + '<p>You told us in Part 3 that your biopsy found cancer, so the next decision is not about an MRI or biopsy but about active surveillance or treatment. The <a href="../prostate-cancer-decision-aid/">prostate cancer decision aid</a> lines up those options with what matters to you.</p>';
      return;
    }
    if (stage === "pr45") {
      opts = band === "older" ? ["biopsy", "monitor", "stop"] : ["biopsy"];
      note = "<p><strong>Your MRI was PI-RADS 4 or 5.</strong> At this point a biopsy is usually recommended, and the MRI step is already done." +
        (band === "older" ? " At your age and health, it is still reasonable to ask whether a biopsy would change what you would do, so keeping watch and stopping testing are also shown. Talk this over with Dr. Power." :
          " Keeping watch with PSA tests alone is not usually advised, so only the biopsy is shown. If you are thinking of not having a biopsy, talk it over with Dr. Power.") + "</p>";
    } else if (stage === "pr12" || stage === "pr3") {
      opts = old ? ["monitor", "stop", "biopsy"] : ["monitor", "biopsy"];
      note = "<p><strong>You have already had your MRI</strong>, so the choice now is between a biopsy and keeping watch with PSA tests" + (old ? ", or stopping testing" : "") + "." +
        (stage === "pr3" ? " With PI-RADS 3, the Ontario guidance usually recommends a biopsy; keeping watch is an option to discuss if your PSA density is very low." : "") + "</p>";
    } else if (stage === "benign" || stage === "atyp") {
      note = "<p><strong>You have already had a biopsy.</strong> From here, the choices are usually to keep checking your PSA, have a repeat MRI, or have a repeat biopsy" + (old ? ", or to stop testing" : "") + "." +
        (stage === "atyp" ? " After ASAP, further testing is usually advised, so keeping watch alone is less often suggested." : "") + "</p>";
    } else {
      note = "<p>Which routes make sense depends on your results, your age and health, and where you are. Choose your situation in <a href=\"#part-path\">Part 3</a> and enter your age in <a href=\"#part-age\">Part 2</a> to narrow this down.</p>";
    }
    if (band) note += '<p class="da-agenote">' + bandNote(le) + "</p>";
    var cards = opts.map(function (opt) {
      var lists = { fit: [], part: [], trade: [] };
      marked.forEach(function (v) {
        var r = LINEUP[opt][v];
        lists[r[0]].push("<li><strong>" + esc(cap(VALUE_TEXT[v])) + "</strong>: " + esc(r[1]) + "." + (pr[v] === 2 ? ' <span class="da-vi">Very important to you</span>' : "") + "</li>");
      });
      function block(k, title) { return lists[k].length ? '<div class="da-lu-' + k + '"><h5>' + title + "</h5><ul>" + lists[k].join("") + "</ul></div>" : ""; }
      var bd = band && ROUTE_BADGE[band][opt];
      return '<div class="da-lu"><h4>' + OPT_NAME[opt] + "</h4>" + (bd ? '<p class="da-fit' + (bd[0] ? " da-fit-" + bd[0] : "") + '">' + bd[1] + "</p>" : "") + '<p class="da-small">' + OPT_NOTE[opt] + "</p>" +
        block("fit", "Fits what you said") + block("part", "Partly fits") + block("trade", "Trade-offs to accept") + "</div>";
    }).join("");
    box.innerHTML = head + "<p>This shows how each next step matches the things you marked as important. It doesn’t add up a score: one “very important” item can outweigh several others.</p>" + note +
      '<div class="da-lu-grid">' + cards + "</div>";
  }

  // ---------------------------------------------------------------- summary
  function renderSummary(r) {
    var box = document.getElementById("psa-summary");
    var pr = priorities();
    var very = VALUES.filter(function (v) { return pr[v] === 2; }).map(function (v) { return cap(VALUE_TEXT[v]); });
    var some = VALUES.filter(function (v) { return pr[v] === 1; }).map(function (v) { return cap(VALUE_TEXT[v]); });
    var stage = val("stage"), lean = val("lean"), pir = val("pirads");
    var sure = [1, 2, 3, 4].map(function (i) { return val("sure" + i); });
    var answered = sure.filter(Boolean).length, yes = sure.filter(function (s) { return s === "yes"; }).length;
    var asks = Array.prototype.map.call(document.querySelectorAll('main input[name="ask"]:checked'), function (el) { return el.value; });
    var own = val("own");
    var rows = [];
    var le = lifeYears(), band = ageBand(le);
    if (le) rows.push(["Age and health", "Age " + le.age + (le.health ? "; health " + HEALTH_TEXT[le.health] + "; rough life expectancy " + le.lo + " to " + le.hi + " years" : "")]);
    if (band) rows.push(["At my age and health", { older: "Monitoring or stopping PSA tests is often the most sensible choice, unless there are warning signs.", mid: "An individual decision: monitoring, an MRI if there is real concern, or stopping testing can all be reasonable.", young: "The usual approach: a repeat test, then monitoring, an MRI or a biopsy depending on results." }[band]]);
    rows.push(["Where I am", stage ? STAGES[stage] : "Not entered"]);
    if (pir) rows.push(["MRI score", PIRADS[pir]]);
    if (r && r.d) rows.push(["PSA density", fmt(r.d) + " (PSA " + esc(String(r.psa)) + ", prostate " + esc(String(r.vol)) + " mL): " + BAND[r.band][0].toLowerCase()]);
    rows.push(["Very important to me", very.length ? esc(very.join("; ")) : "Nothing marked"]);
    if (some.length) rows.push(["Somewhat important", esc(some.join("; "))]);
    rows.push(["Leaning toward", lean ? LEAN[lean] : "Not answered"]);
    rows.push(["How sure I feel", answered < 4 ? "Not completed" : yes === 4 ? "Yes to all four questions" : yes + " of 4 answered yes. A good idea to talk things over further before deciding."]);
    var today = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
    box.innerHTML = '<div class="da-sum-head"><h3>My raised PSA decision summary</h3><p>' + today + "</p></div>" +
      '<dl class="da-sum">' + rows.map(function (x) { return "<dt>" + x[0] + "</dt><dd>" + x[1] + "</dd>"; }).join("") + "</dl>" +
      (asks.length || own ? "<h4>Questions to ask</h4><ul>" + asks.map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") + (own ? "<li>" + esc(own).replace(/\n/g, "<br>") + "</li>" : "") + "</ul>" : "") +
      '<p class="da-small">From the raised PSA decision aid at nicholaspowerurology.com. For education only; it does not replace advice from your care team.</p>';
  }

  function drawIcons() {
    Array.prototype.forEach.call(document.querySelectorAll(".da-icons"), function (el) {
      if (el.childNodes.length) return;
      var n = parseInt(el.getAttribute("data-n"), 10) || 0;
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", n + " out of 100");
      var html = "";
      for (var i = 0; i < 100; i++) html += "<i" + (i < n ? ' class="on"' : "") + "></i>";
      el.innerHTML = html;
    });
  }

  function update(e) {
    var le = lifeYears();
    renderLife(le);
    renderRoutes(le);
    renderStage(e && e.target && e.target.name === "stage");
    var r = renderDensity();
    renderLineup();
    renderSummary(r);
    store();
  }

  // ---------------------------------------------------------------- events
  document.getElementById("psa-where").hidden = false;
  document.getElementById("psa-calc").hidden = false;
  document.getElementById("psa-actions").hidden = false;
  document.getElementById("psa-life").hidden = false;
  restore(store(true));
  drawIcons();
  update();
  var main = document.getElementById("main");
  main.addEventListener("change", update);
  main.addEventListener("input", function (e) { if (e.target.matches("input[type=text], textarea")) update(e); });

  document.getElementById("psa-stage-all").addEventListener("click", function () {
    Array.prototype.forEach.call(document.querySelectorAll('input[name="stage"]'), function (el) { el.checked = false; });
    update();
    Array.prototype.forEach.call(stagesBox.querySelectorAll(".psa-stage"), function (d) { d.open = false; });
  });
  document.getElementById("psa-print").addEventListener("click", function () {
    document.documentElement.classList.add("da-print-mode");
    window.print();
  });
  window.addEventListener("afterprint", function () { document.documentElement.classList.remove("da-print-mode"); });
  document.getElementById("psa-clear").addEventListener("click", function () {
    if (!window.confirm("Clear all your answers on this device?")) return;
    store(false);
    restore({});
    update();
    Array.prototype.forEach.call(stagesBox.querySelectorAll(".psa-stage"), function (d) { d.open = false; });
    document.getElementById("part-path").scrollIntoView({ behavior: "smooth" });
  });
})();
