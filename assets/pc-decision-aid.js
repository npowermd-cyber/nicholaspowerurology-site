/* Prostate cancer treatment decision aid.
   Everything runs in the browser. Answers are kept only in this browser's storage. */
(function () {
  "use strict";
  var root = document.getElementById("part-cancer");
  if (!root) return;
  var KEY = "pcda-v1";

  var NAMES = { as: "Active surveillance", surgery: "Surgery", ebrt: "External beam radiation", brachy: "Brachytherapy", ww: "Watchful waiting" };
  var ORDER = ["as", "surgery", "ebrt", "brachy", "ww"];

  var GROUPS = {
    low: { label: "Low risk", tone: "ok",
      desc: "Your cancer appears small and slow-growing. Low-risk prostate cancer is very unlikely to spread or shorten your life in the next 10 to 15 years.",
      guide: "For most men in this group, guidelines recommend <strong>active surveillance</strong> as the first choice. Surgery or radiation are alternatives for men who prefer treatment." },
    fav: { label: "Favourable intermediate risk", tone: "mid",
      desc: "Your cancer has one feature that puts it above low risk, but it is still likely to grow slowly.",
      guide: "Surgery and radiation are standard choices. <strong>Active surveillance</strong> is reasonable for some men, especially when there is only a small amount of Grade Group 2." },
    int: { label: "Intermediate risk", tone: "mid",
      desc: "Your cancer is more active than low-risk cancer but has not spread.",
      guide: "Surgery and radiation are standard choices. Whether active surveillance or hormone therapy is suitable depends on whether your cancer is the favourable or unfavourable type. Ask Dr. Power which applies to you." },
    unfav: { label: "Unfavourable intermediate risk", tone: "high",
      desc: "Your cancer is more likely to grow over time without treatment, though it has not spread.",
      guide: "Treatment is usually recommended: <strong>surgery</strong>, or <strong>radiation with about 4 to 6 months of hormone therapy</strong>, sometimes with a brachytherapy boost. Active surveillance is not usually advised." },
    high: { label: "High risk", tone: "high",
      desc: "Your cancer is more likely to spread if it is not treated. Treatment aims to cure it, and many men are cured.",
      guide: "Treatment is recommended: <strong>radiation with 18 months to 3 years of hormone therapy</strong> (often with a brachytherapy boost), or <strong>surgery with removal of nearby lymph nodes</strong>, sometimes followed by radiation." },
    vhigh: { label: "Very high risk", tone: "high",
      desc: "Your cancer has features that make it more likely to spread. Treatment aims to cure it, usually by combining treatments.",
      guide: "Treatment is recommended, usually <strong>radiation with 18 months to 3 years of hormone therapy</strong>, sometimes with an added hormone pill (abiraterone), or in selected men, <strong>surgery</strong> followed by other treatment as needed. A plan made together with a radiation oncologist is best." },
    regional: { label: "Spread to nearby lymph nodes", tone: "high",
      desc: "Cancer in the lymph nodes near the prostate, without spread elsewhere, is still often treated with the aim of cure.",
      guide: "The usual treatment is <strong>radiation to the prostate and lymph nodes with about 2 to 3 years of hormone therapy</strong>, often with an added hormone pill (abiraterone). <strong>Surgery</strong> with removal of the lymph nodes is an option for some men. This decision aid is designed mainly for cancer inside the prostate, so please talk through the details with Dr. Power and a radiation oncologist. <strong>If you don’t already have an appointment booked, call our office.</strong>" },
    metastatic: { label: "Spread to bones or other organs", tone: "high",
      desc: "When prostate cancer has spread to the bones or other parts of the body, treatment uses hormone therapy and other medicines that work throughout the body, sometimes with radiation. Many men live well for years.",
      guide: "This decision aid is designed for cancer that is still inside the prostate, so most of it does not apply to you. Your care team will go over the treatments that fit your situation. <strong>If you don’t already have an appointment booked, call our office soon.</strong>" }
  };

  // How each option fits each group: first, yes, some, boost, no
  var FIT = {
    as:      { low: "first", fav: "some", int: "some", unfav: "no", high: "no", vhigh: "no", regional: "no", metastatic: "no" },
    surgery: { low: "pref", fav: "yes", int: "yes", unfav: "yes", high: "yes", vhigh: "some", regional: "some", metastatic: "no" },
    ebrt:    { low: "pref", fav: "yes", int: "yes", unfav: "yes", high: "yes", vhigh: "yes", regional: "yes", metastatic: "some" },
    brachy:  { low: "pref", fav: "yes", int: "some", unfav: "boost", high: "boost", vhigh: "boost", regional: "no", metastatic: "no" }
  };
  var BADGE = {
    first: "Recommended first choice for your risk group",
    pref: "An option for men in your risk group who prefer treatment",
    yes: "Usually offered for your risk group",
    some: "An option for some men in your risk group",
    boost: "Usually given as a boost with external radiation for your risk group",
    le: "A reasonable choice if your life expectancy is under about 10 years",
    leshort: "Considered for your risk group only if life expectancy is about 5 years or less",
    lefit: "A reasonable choice with your estimated life expectancy"
  };
  var ADT = {
    low: "Hormone therapy is not usually needed for low-risk cancer.",
    fav: "Hormone therapy is not usually needed for favourable intermediate risk; some men have about 4 to 6 months.",
    int: "Depending on the type of intermediate risk, either no hormone therapy or about 4 to 6 months.",
    unfav: "For unfavourable intermediate risk, about 4 to 6 months of hormone therapy is usually added.",
    high: "For high-risk cancer, hormone therapy is usually given for about 18 months to 3 years.",
    vhigh: "For very high-risk cancer, hormone therapy is usually given for about 18 months to 3 years, sometimes with an added hormone pill (abiraterone).",
    regional: "When cancer has spread to nearby lymph nodes, hormone therapy is usually given for about 2 to 3 years, often with an added hormone pill (abiraterone).",
    metastatic: "When cancer has spread to the bones or other organs, hormone therapy is the main treatment, usually with other medicines."
  };

  // Statistics Canada life table, men, 2021 to 2023: remaining years of life at each age
  var LIFE = [[55, 27.6], [60, 23.4], [65, 19.3], [70, 15.5], [75, 12.1], [80, 9.0], [85, 6.4], [90, 4.3]];
  var HEALTH = { better: 1.5, average: 1, worse: 0.5 };

  var VALUE_TEXT = {
    treat: "having the cancer treated now", sex: "keeping erections and sex life", urine: "avoiding leaking urine",
    bowel: "avoiding bowel problems", hormones: "avoiding hormone therapy", nosurg: "avoiding an operation",
    time: "getting back to normal quickly", tests: "avoiding regular biopsies and tests", future: "keeping choices open for later",
    spread: "lowering the chance the cancer spreads"
  };
  var VALUES = ["treat", "spread", "sex", "urine", "bowel", "hormones", "nosurg", "time", "tests", "future"];

  // How each option relates to each priority: [fit | part | trade, explanation]
  function lineup(opt, value, g) {
    var hiADT = g === "high" || g === "vhigh" || g === "regional" || g === "metastatic";
    var midADT = g === "unfav" || g === "int";
    var lowGroup = g === "low" || g === "fav" || !g;
    var T = {
      as: { treat: ["trade", "you live with a cancer that is monitored, not treated"], spread: ["part", "the chance of spread is somewhat higher than with treatment (in ProtecT, 9 in 100 compared with 5 in 100 after 15 years)"],
        sex: ["fit", "no treatment effect on erections, unless you need treatment later"],
        urine: ["fit", "no treatment effect on the bladder, unless you need treatment later"], bowel: ["fit", "no effect on the bowel, unless you need radiation later"], hormones: ["fit", "no hormone therapy"],
        nosurg: ["fit", "no operation"], time: ["part", "no recovery time, but regular tests for years"],
        tests: ["trade", "regular PSA tests, MRIs and repeat biopsies"], future: ["fit", "all treatment choices stay open, as long as changes are caught early"] },
      surgery: { treat: ["fit", "the prostate and the cancer in it are removed"], spread: ["fit", "treatment lowers the chance of spread compared with monitoring"], sex: ["trade", "erections are usually weaker afterward, and orgasm is dry"],
        urine: ["trade", "leaking is expected at first, and some men have lasting leakage"], bowel: ["fit", "the bowel is not usually affected"],
        hormones: hiADT ? ["part", "not usually needed, but some men with higher-risk cancer need it afterward"] : ["fit", "hormone therapy is not usually needed"],
        nosurg: ["trade", "an operation under general anaesthetic"], time: ["trade", "2 to 6 weeks of recovery and a catheter for 1 to 2 weeks"],
        tests: ["fit", "follow-up is mainly PSA tests, which are easy to read after surgery"], future: ["part", "radiation is still possible later, though its side effects add to those of surgery"] },
      ebrt: { treat: ["fit", "the cancer is treated now"], spread: ["fit", "treatment lowers the chance of spread compared with monitoring"],
        sex: ["part", "erections tend to weaken gradually over years and there is less semen" + (hiADT || midADT ? "; hormone therapy also affects sex while you take it" : "")],
        urine: ["fit", "leaking is uncommon, though some men have lasting urgency or frequency"], bowel: ["trade", "a small number of men have lasting bowel urgency or bleeding"],
        hormones: hiADT ? ["trade", "usually 18 months to 3 years of hormone therapy for your risk group"] : g === "unfav" ? ["trade", "usually about 4 to 6 months of hormone therapy for your risk group"] : g === "int" ? ["part", "either none or about 4 to 6 months, depending on the type of intermediate risk"] : g === "fav" ? ["part", "sometimes about 4 to 6 months of hormone therapy"] : ["fit", "hormone therapy is not usually needed for your risk group"],
        nosurg: ["fit", "no operation or general anaesthetic"], time: lowGroup ? ["part", "between 5 and about 28 weekday visits; most men keep working"] : ["trade", "about 4 to 6 weeks of weekday visits, plus hormone therapy"],
        tests: ["fit", "follow-up is mainly PSA tests"], future: ["part", "further treatment is possible, but surgery afterward is harder"] },
      brachy: { treat: ["fit", "the cancer is treated now"], spread: ["fit", "treatment lowers the chance of spread compared with monitoring"], sex: ["part", "erections tend to weaken gradually over years and there is less semen"],
        urine: ["part", "leaking is uncommon, but urinary irritation for months is common"], bowel: ["fit", "lasting bowel problems are uncommon"],
        hormones: lowGroup ? ["fit", "hormone therapy is not usually needed"] : ["trade", "usually combined with hormone therapy for your risk group"],
        nosurg: ["part", "a short procedure under anaesthetic, without any cuts"], time: lowGroup ? ["fit", "1 or 2 short procedures, back to normal in days"] : ["part", "a short procedure plus a course of external radiation"],
        tests: ["fit", "follow-up is mainly PSA tests"], future: ["part", "further treatment is possible, but surgery afterward is harder"] },
      ww: { treat: ["trade", "the aim is not to cure the cancer"], spread: ["trade", "the cancer is not treated unless it causes symptoms, so it is more likely to grow"], sex: ["fit", "no treatment effect unless hormone therapy is needed later"],
        urine: ["fit", "no treatment effect on the bladder"], bowel: ["fit", "no effect on the bowel"], hormones: ["part", "hormone therapy may be used later to control symptoms"],
        nosurg: ["fit", "no operation"], time: ["fit", "occasional check-ups only"], tests: ["fit", "no routine biopsies or MRIs"],
        future: ["part", "the aim is control rather than cure"] }
    };
    return T[opt][value];
  }

  // ---------------------------------------------------------------- state
  function store(get) {
    try {
      if (get) return JSON.parse(localStorage.getItem(KEY) || "{}");
      localStorage.setItem(KEY, JSON.stringify(get === false ? {} : collect()));
    } catch (e) { return {}; }
  }
  function fields() { return document.querySelectorAll("main input[name], main select[name], main textarea[name]"); }
  function collect() {
    var data = {};
    Array.prototype.forEach.call(fields(), function (el) {
      if (el.type === "radio") { if (el.checked) data[el.name] = el.value; }
      else if (el.type === "checkbox") { if (el.checked) (data[el.name] = data[el.name] || []).push(el.value); }
      else if (el.value) data[el.name] = el.value;
    });
    return data;
  }
  function restore(data) {
    Array.prototype.forEach.call(fields(), function (el) {
      var v = data[el.name];
      if (el.type === "radio") el.checked = v === el.value;
      else if (el.type === "checkbox") el.checked = !!(v && v.indexOf(el.value) > -1);
      else el.value = v || "";
    });
  }
  function val(name) {
    var el = document.querySelector('main [name="' + name + '"]:checked') || document.querySelector('main select[name="' + name + '"], main input[type="text"][name="' + name + '"], main textarea[name="' + name + '"]');
    return el ? el.value : "";
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // ---------------------------------------------------------------- risk group
  function risk() {
    var spread = val("spread");
    if (spread === "nodes") return { group: "regional", notes: [], why: ["a scan showed cancer in nearby lymph nodes"], from: "spread" };
    if (spread === "distant") return { group: "metastatic", notes: [], why: ["a scan showed cancer in the bones or other parts of the body"], from: "spread" };
    var pick = val("grouppick");
    if (pick) return { group: pick, notes: [], why: [], from: "pick" };
    var gg = parseInt(val("gg"), 10);
    if (!gg) return null;
    var psaRaw = val("psa").replace(",", ".");
    var psa = parseFloat(psaRaw);
    var stage = val("stage");
    var cores = val("cores");
    var notes = [];
    if (isNaN(psa)) { psa = 0; notes.push("You didn’t enter a PSA, so this assumes it was under 10. A PSA of 10 or more could raise your risk group."); }
    if (!stage || stage === "unknown") { stage = "T1"; notes.push("You didn’t choose a stage, so this assumes nothing could be felt on exam (T1)."); }
    if (spread === "unknown" || !spread) notes.push("This assumes the cancer has not spread outside the prostate.");

    var why = [];
    var high = 0;
    if (stage === "T3a") { high++; why.push("the cancer is growing just outside the prostate (T3a)"); }
    if (gg >= 4) { high++; why.push("Grade Group " + gg); }
    if (psa > 20) { high++; why.push("a PSA over 20"); }
    if (stage === "T3b") { why.unshift("the cancer reaches the seminal vesicles or nearby organs (T3b or T4)"); return { group: "vhigh", notes: notes, why: why }; }
    if (high >= 2) return { group: "vhigh", notes: notes, why: why };
    if (high === 1) {
      if (gg >= 4) notes.push("If your biopsy showed Gleason 5+4 or 5+5, or Grade Group 4 or 5 cancer in more than 4 samples, your doctor would call this very high risk. The options are similar.");
      return { group: "high", notes: notes, why: why };
    }

    var irf = 0;
    if (stage === "T2b") { irf++; why.push("a larger lump on exam (T2b or T2c)"); }
    if (gg === 2 || gg === 3) { irf++; why.push("Grade Group " + gg); }
    if (psa >= 10) { irf++; why.push("a PSA between 10 and 20"); }
    if (irf === 0) {
      notes.push("Your doctor may call this “very low risk” if only a small amount of cancer was found. The options are the same.");
      return { group: "low", notes: notes, why: ["Grade Group 1", "a PSA under 10", "little or nothing felt on exam"] };
    }
    if (cores === "yes") why.push("cancer in half or more of the biopsy samples");
    if (gg === 3 || irf >= 2 || cores === "yes") return { group: "unfav", notes: notes, why: why };
    if (cores !== "no") notes.push("If cancer was found in half or more of your biopsy samples, your risk group would be unfavourable intermediate.");
    return { group: "fav", notes: notes, why: why };
  }

  function lifeYears() {
    var age = parseFloat(val("age"));
    var health = val("health");
    if (!age || age < 30 || age > 105) return null;
    var base;
    if (age <= LIFE[0][0]) base = LIFE[0][1] + (LIFE[0][0] - age) * 0.9;
    else if (age >= LIFE[LIFE.length - 1][0]) base = LIFE[LIFE.length - 1][1];
    else for (var i = 0; i < LIFE.length - 1; i++) {
      var a = LIFE[i], b = LIFE[i + 1];
      if (age >= a[0] && age <= b[0]) { base = a[1] + (b[1] - a[1]) * (age - a[0]) / (b[0] - a[0]); break; }
    }
    var est = health ? base * HEALTH[health] : null;
    return { age: Math.round(age), base: base, est: est, lo: est != null ? Math.max(1, Math.round(est * 0.75)) : null, hi: est != null ? Math.round(est * 1.25) : null, health: health };
  }

  function fitFor(opt, g, le) {
    var short = le && le.est != null;
    var highG = g === "high" || g === "vhigh" || g === "regional";
    if (opt === "ww") {
      if (g === "metastatic") return null;
      if (short) return (highG ? le.est <= 5 : le.est < 10) ? "lefit" : null;
      return highG ? "leshort" : "le";
    }
    if (!g) return "all";
    var f = FIT[opt][g];
    if (opt === "as" && g === "low" && short && le.est < 10) f = "some";
    return f === "no" ? null : f;
  }

  // ---------------------------------------------------------------- rendering
  function renderRisk(r) {
    var box = document.getElementById("da-risk");
    if (!r) { box.innerHTML = '<p class="da-empty">Answer the questions above to see your risk group. At a minimum, we need your Grade Group.</p>'; return; }
    var G = GROUPS[r.group];
    box.innerHTML = '<div class="da-badge da-tone-' + G.tone + '">' + esc(G.label) + '</div>' +
      (r.why && r.why.length ? "<p><strong>Based on:</strong> " + esc(r.why.join(", ")) + ".</p>" : "") +
      "<p>" + G.desc + "</p><p>" + G.guide + "</p>" +
      (r.notes.length ? '<ul class="da-notes">' + r.notes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul>" : "") +
      '<p class="da-small">This is an estimate from the answers you gave. Dr. Power may use more details, such as your MRI and the exact biopsy findings.</p>';
  }

  function renderLife(le) {
    var box = document.getElementById("da-le");
    if (!le) { box.innerHTML = '<p class="da-empty">Enter your age and health to see an estimate.</p>'; return; }
    var html = "<p>On average, Canadian men aged " + le.age + " live about <strong>" + Math.round(le.base) + " more years</strong>.</p>";
    if (le.est == null) { box.innerHTML = html + '<p class="da-empty">Choose how your health compares, for an estimate adjusted for you.</p>'; return; }
    var y = le.lo + " to " + le.hi, msg;
    if (le.est >= 15) msg = "This suggests a long time ahead, so it makes sense to choose an option that controls the cancer over many years. For low-risk cancer, active surveillance still does this well.";
    else if (le.est >= 10) msg = "This is around the 10 to 15 year range, where the right choice depends on your risk group and your own priorities.";
    else msg = "This suggests less than about 10 years. Low-risk and intermediate-risk cancers are unlikely to cause problems in that time, so <strong>watchful waiting</strong> may be a reasonable choice. For high-risk cancers, treatment usually still helps unless life expectancy is quite short.";
    box.innerHTML = html + "<p>Adjusted for your health, a rough range for you is <strong>" + y + " years</strong>. " + msg + "</p>" +
      '<p class="da-small">These are averages from Statistics Canada life tables, and rating your own health is hard. Nobody can predict how long one person will live, so talk this over with Dr. Power.</p>';
  }

  function renderOptions(g, le) {
    var main = document.getElementById("da-options"), notWrap = document.getElementById("da-not-usual"), notList = document.getElementById("da-not-list");
    var lead = document.getElementById("da-options-lead");
    var anyNot = false;
    ORDER.forEach(function (opt) {
      var card = document.getElementById("opt-" + opt);
      var f = fitFor(opt, g, le);
      var badge = card.querySelector("[data-fit]");
      if (f && f !== "all") { badge.textContent = BADGE[f]; badge.className = "da-fit da-fit-" + f; badge.hidden = false; }
      else { badge.textContent = ""; badge.hidden = true; }
      if (f) { if (card.parentNode !== main) main.appendChild(card); card.classList.remove("da-dim"); }
      else { notList.appendChild(card); card.classList.add("da-dim"); anyNot = true; }
    });
    ORDER.forEach(function (opt) { var c = document.getElementById("opt-" + opt); if (c.parentNode === main) main.appendChild(c); });
    notWrap.hidden = !anyNot;
    var adt = document.querySelector("[data-adt]");
    adt.textContent = g ? ADT[g] : "Hormone therapy is often added for intermediate- and high-risk cancers. Its length depends on your risk group.";
    lead.textContent = g ? "Options usually offered for your situation (" + GROUPS[g].label.toLowerCase() + ") are shown first. Open each section to read more." :
      "These are the main ways prostate cancer that hasn’t spread is managed. Once you enter your risk group in Part 1, this section shows which options are usually offered for it.";
  }

  function relevant(g, le) {
    return ORDER.filter(function (o) { return !!fitFor(o, g, le); });
  }

  function renderCompare(g, le) {
    var rel = relevant(g, le);
    var radiation = rel.indexOf("ebrt") > -1 || rel.indexOf("brachy") > -1;
    Array.prototype.forEach.call(document.querySelectorAll("#part-compare [data-option]"), function (el) {
      var os = el.getAttribute("data-option").split(" ");
      var show = !g || os.some(function (o) { return rel.indexOf(o) > -1 || (o === "ebrt" && radiation); });
      el.hidden = !show;
    });
    document.getElementById("da-compare-note").textContent = g ? "Only the options usually offered for your risk group are shown." :
      "Once you have entered your risk group, only the options usually offered for it are shown.";
  }

  function priorities() {
    var out = {};
    VALUES.forEach(function (v) { var x = val("v-" + v); if (x !== "") out[v] = parseInt(x, 10); });
    return out;
  }

  function renderLineup(g, le) {
    var box = document.getElementById("da-lineup");
    var pr = priorities();
    var marked = VALUES.filter(function (v) { return pr[v] > 0; });
    var head = "<h3>How the options line up with what you said</h3>";
    if (!Object.keys(pr).length) { box.innerHTML = head + '<p class="da-empty">Mark how important each item is to you, and this section will show where each option fits your priorities and where it asks you to accept a trade-off.</p>'; return; }
    if (!marked.length) { box.innerHTML = head + '<p>You marked everything as not important, so none of the trade-offs stand out for you. Your decision may come down to Dr. Power’s advice for your risk group.</p>'; return; }
    marked.sort(function (a, b) { return pr[b] - pr[a]; });
    var cards = relevant(g, le).map(function (opt) {
      var lists = { fit: [], part: [], trade: [] };
      marked.forEach(function (v) {
        var r = lineup(opt, v, g);
        lists[r[0]].push("<li><strong>" + esc(cap(VALUE_TEXT[v])) + "</strong>: " + esc(r[1]) + "." + (pr[v] === 2 ? ' <span class="da-vi">Very important to you</span>' : "") + "</li>");
      });
      function block(k, title) { return lists[k].length ? '<div class="da-lu-' + k + '"><h5>' + title + "</h5><ul>" + lists[k].join("") + "</ul></div>" : ""; }
      return '<div class="da-lu"><h4>' + NAMES[opt] + "</h4>" + block("fit", "Fits what you said") + block("part", "Partly fits") + block("trade", "Trade-offs to accept") + "</div>";
    }).join("");
    box.innerHTML = head + "<p>For each option" + (g ? " usually offered for your risk group" : "") + ", this shows how it matches the things you marked as important. It doesn’t add up a score: one “very important” item can outweigh several others. Use it to see which trade-offs you are most and least willing to accept.</p>" + '<div class="da-lu-grid">' + cards + "</div>";
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function renderSummary(r, le) {
    var box = document.getElementById("da-summary");
    var g = r && r.group;
    var pr = priorities();
    var very = VALUES.filter(function (v) { return pr[v] === 2; }).map(function (v) { return cap(VALUE_TEXT[v]); });
    var some = VALUES.filter(function (v) { return pr[v] === 1; }).map(function (v) { return cap(VALUE_TEXT[v]); });
    var lean = val("lean");
    var sure = [1, 2, 3, 4].map(function (i) { return val("sure" + i); });
    var answered = sure.filter(Boolean).length, yes = sure.filter(function (s) { return s === "yes"; }).length;
    var asks = Array.prototype.map.call(document.querySelectorAll('main input[name="ask"]:checked'), function (el) { return el.value; });
    var own = val("own");
    var facts = [];
    if (r && r.from !== "pick" && r.from !== "spread") {
      var gg = val("gg"), psa = val("psa"), st = val("stage");
      if (gg && gg !== "0") facts.push("Grade Group " + gg);
      if (psa) facts.push("PSA " + psa);
      if (st && st !== "unknown") facts.push("stage " + (st === "T2b" ? "T2b/T2c" : st === "T3b" ? "T3b/T4" : st));
    }
    var rows = [];
    rows.push(["Risk group", g ? GROUPS[g].label + (facts.length ? " (" + esc(facts.join(", ")) + ")" : "") + (r.from === "pick" ? " (as told by my doctor)" : "") : "Not entered"]);
    if (le) rows.push(["Life expectancy", "Age " + le.age + (le.est != null ? "; rough range " + le.lo + " to " + le.hi + " years" : "")]);
    if (g) rows.push(["Options usually offered", relevant(g, le).map(function (o) { return NAMES[o]; }).join(", ")]);
    rows.push(["Very important to me", very.length ? esc(very.join("; ")) : "Nothing marked"]);
    if (some.length) rows.push(["Somewhat important", esc(some.join("; "))]);
    rows.push(["Leaning toward", lean ? (lean === "unsure" ? "Not sure yet" : NAMES[lean]) : "Not answered"]);
    var sureText = answered < 4 ? "Not completed" : yes === 4 ? "Yes to all four questions" : yes + " of 4 answered yes. A good idea to talk things over further before deciding.";
    rows.push(["How sure I feel", sureText]);
    var today = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
    box.innerHTML = '<div class="da-sum-head"><h3>My prostate cancer decision summary</h3><p>' + today + "</p></div>" +
      '<dl class="da-sum">' + rows.map(function (x) { return "<dt>" + x[0] + "</dt><dd>" + x[1] + "</dd>"; }).join("") + "</dl>" +
      (asks.length || own ? "<h4>Questions to ask</h4><ul>" + asks.map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") + (own ? "<li>" + esc(own).replace(/\n/g, "<br>") + "</li>" : "") + "</ul>" : "") +
      '<p class="da-small">From the prostate cancer decision aid at nicholaspowerurology.com. For education only; it does not replace advice from your care team.</p>';
  }

  function drawIcons() {
    Array.prototype.forEach.call(document.querySelectorAll(".da-icons"), function (el) {
      if (el.childNodes.length) return;
      var n = parseInt(el.getAttribute("data-n"), 10);
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", n + " out of 100");
      var html = "";
      for (var i = 0; i < 100; i++) html += "<i" + (i < n ? ' class="on"' : "") + "></i>";
      el.innerHTML = html;
    });
  }

  function update() {
    var r = risk(), le = lifeYears(), g = r && r.group;
    renderRisk(r);
    renderLife(le);
    renderOptions(g, le);
    renderCompare(g, le);
    renderLineup(g, le);
    renderSummary(r, le);
    store();
  }

  // ---------------------------------------------------------------- events
  restore(store(true));
  drawIcons();
  update();
  var main = document.getElementById("main");
  main.addEventListener("change", update);
  main.addEventListener("input", function (e) { if (e.target.matches("input[type=text], textarea")) update(); });
  document.getElementById("da-group-pick").addEventListener("change", function () { if (this.value) this.closest("details").open = true; });
  if (val("grouppick")) document.querySelector(".da-shortcut").open = true;

  document.getElementById("da-print").addEventListener("click", function () {
    document.documentElement.classList.add("da-print-mode");
    window.print();
  });
  window.addEventListener("afterprint", function () { document.documentElement.classList.remove("da-print-mode"); });
  document.getElementById("da-clear").addEventListener("click", function () {
    if (!window.confirm("Clear all your answers on this device?")) return;
    store(false);
    restore({});
    update();
    document.getElementById("part-cancer").scrollIntoView({ behavior: "smooth" });
  });
})();
