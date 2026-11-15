/* Bladder treatments (intravesical therapy): personal treatment calendar and 100-dot figures.
   Everything runs in the browser. Choices are kept only in this browser's storage. */
(function () {
  "use strict";

  // ------------------------------------------------------------ 100-dot icon arrays
  Array.prototype.forEach.call(document.querySelectorAll(".da-icons"), function (el) {
    if (el.childNodes.length) return;
    var n = parseInt(el.getAttribute("data-n"), 10);
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", n + " out of 100");
    var html = "";
    for (var i = 0; i < 100; i++) html += "<i" + (i < n ? ' class="on"' : "") + "></i>";
    el.innerHTML = html;
  });

  var form = document.getElementById("ivt-form");
  if (!form) return;
  var KEY = "ivt-calendar-v1";
  var out = document.getElementById("ivt-cal");
  var actions = document.getElementById("ivt-actions");
  var saved = document.getElementById("ivt-saved");
  var startInput = document.getElementById("ivt-start");
  var maintSel = document.getElementById("ivt-maint");

  document.getElementById("ivt-nojs").hidden = true;
  form.hidden = false;
  saved.hidden = false;

  // ------------------------------------------------------------ schedules (see "How the dates are worked out")
  var TX = {
    bcg: { name: "BCG", short: "BCG", maintOptions: ["usual", "0", "12", "36"],
           usual: { low: 12, int: 12, high: 36 } },
    gemdoce: { name: "Gemcitabine–docetaxel (Gem/Doce)", short: "Gem/Doce", maintOptions: ["usual", "0", "12", "24"],
               usual: { low: 12, int: 12, high: 24 } },
    chemo: { name: "Gemcitabine or mitomycin on its own", short: "Chemotherapy", maintOptions: ["usual", "0", "12"],
             usual: { low: 0, int: 0, high: 0, unsure: 0 } },
    single: { name: "Single dose of chemotherapy after surgery only", short: "Single dose", maintOptions: [] }
  };
  var BCG_BLOCKS = [3, 6, 12, 18, 24, 30, 36];          // months after first induction treatment (SWOG 8507)
  var CYSTO = {                                          // months after start; AUA/SUO surveillance, aligned to maintenance
    low: [3, 12, 24, 36, 48, 60],
    int: [3, 6, 12, 18, 24, 36, 48, 60],
    high: [3, 6, 9, 12, 15, 18, 21, 24, 30, 36, 42, 48, 60],
    unsure: [3]
  };
  var AFTER = {
    low: "After 5 clear years, you and your urologist will decide whether to stop check-ups or space them out.",
    int: "After 5 years, check-ups usually continue once a year.",
    high: "After 5 years, check-ups usually continue once a year for many years, with a CT scan of the kidneys and ureters every 1 to 2 years along the way.",
    unsure: "After the first check-up, how often you have cystoscopy depends on your risk group. Ask your team, then choose it above to see the dates."
  };
  var RISK = { low: "Low risk", int: "Intermediate risk", high: "High risk", unsure: "Not sure yet" };

  // ------------------------------------------------------------ dates
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function parse(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3], 12);
    if (d.getMonth() !== +m[2] - 1 || d.getFullYear() < 2015 || d.getFullYear() > 2040) return null;
    return d;
  }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12); }
  function addMonths(d, n) {
    var y = d.getFullYear(), m = d.getMonth() + n, day = d.getDate();
    var last = new Date(y, m + 1, 0, 12).getDate();
    return new Date(y, m, Math.min(day, last), 12);
  }
  function sameWeekday(target, ref) {          // nearest date to target that falls on ref's weekday
    var shift = (ref.getDay() - target.getDay() + 7) % 7;
    if (shift > 3) shift -= 7;
    return addDays(target, shift);
  }
  function fmt(d) { return DAYS[d.getDay()] + " " + MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear(); }
  function fmtDates(list) {                    // "Mon Apr 5, 12 and 19, 2027"
    var sameYear = list.every(function (d) { return d.getFullYear() === list[0].getFullYear(); });
    if (!sameYear) return list.map(fmt).join("; ");
    var parts = list.map(function (d, i) {
      var head = i === 0 ? DAYS[d.getDay()] + " " : "";
      return head + (i === 0 || d.getMonth() !== list[i - 1].getMonth() ? MONTHS[d.getMonth()] + " " : "") + d.getDate();
    });
    return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1] + ", " + list[0].getFullYear();
  }
  function fmtMonth(d) { return MONTHS_LONG[d.getMonth()] + " " + d.getFullYear(); }

  // ------------------------------------------------------------ form state
  function val(name) {
    var el = form.elements[name];
    if (!el) return "";
    if (el.length && el[0] && el[0].type === "radio") {
      for (var i = 0; i < el.length; i++) if (el[i].checked) return el[i].value;
      return "";
    }
    return el.value;
  }
  function collect() { return { tx: val("tx"), risk: val("risk"), start: val("start"), maint: val("maint") }; }
  function restore(data) {
    ["tx", "risk"].forEach(function (n) {
      Array.prototype.forEach.call(form.querySelectorAll('input[name="' + n + '"]'), function (r) { r.checked = r.value === data[n]; });
    });
    startInput.value = data.start || "";
    maintSel.value = data.maint || "usual";
  }
  function store(get) {
    try {
      if (get) return JSON.parse(localStorage.getItem(KEY) || "{}") || {};
      if (get === false) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, JSON.stringify(collect()));
    } catch (e) { return {}; }
  }

  function syncFields(tx) {
    var single = tx === "single";
    document.getElementById("ivt-start-label").textContent = single ? "Date of your surgery (TURBT)" : "Date of your first weekly treatment";
    document.getElementById("ivt-start-help").textContent = single
      ? "The day your tumour was removed. Check-ups are counted from this date."
      : "If it hasn’t happened yet, use the date you were given, or a best guess.";
    var q = document.getElementById("ivt-maint-q");
    q.hidden = !tx || single;
    var allowed = tx && TX[tx] ? TX[tx].maintOptions : [];
    Array.prototype.forEach.call(maintSel.options, function (o) {
      var ok = allowed.indexOf(o.value) > -1;
      o.hidden = !ok; o.disabled = !ok;
    });
    if (allowed.length && allowed.indexOf(maintSel.value) < 0) maintSel.value = "usual";
  }

  // ------------------------------------------------------------ build the plan
  function list(nums) { return nums.length > 1 ? nums.slice(0, -1).join(", ") + " and " + nums[nums.length - 1] : String(nums[0]); }
  function plan(s) {
    var t = TX[s.tx], start = parse(s.start), risk = s.risk || "unsure";
    var ev = [], notes = [], months = 0, maintLabel = "", blocks = [], courseOnly = false;
    if (s.tx !== "single") {
      months = s.maint === "usual" ? (t.usual[risk] != null ? t.usual[risk] : null) : parseInt(s.maint, 10);
      for (var i = 0; i < 6; i++) ev.push({ d: addDays(start, 7 * i), kind: "tx", what: t.short + " " + (i + 1) + " of 6", sub: "weekly course (induction)", exact: i === 0 });
      if (months === null) {
        courseOnly = true;
        notes.push("Only the 6-week course is shown. Whether maintenance follows, and for how long, depends on your risk group. Choose your risk group, or the length your team has planned, to see those dates.");
      } else if (months > 0) {
        if (s.tx === "bcg") {
          blocks = BCG_BLOCKS.filter(function (m) { return m <= months; });
          blocks.forEach(function (m, bi) {
            var d0 = sameWeekday(addMonths(start, m), start);
            ev.push({ d: d0, dates: [d0, addDays(d0, 7), addDays(d0, 14)], count: 3, kind: "tx", what: "BCG maintenance: 3 treatments, a week apart",
                      sub: "block " + (bi + 1) + " of " + blocks.length + ", about " + m + " months after the first treatment, if the check-up just before is clear" });
          });
          maintLabel = "3 treatments, a week apart, at about " + list(blocks) + " months";
        } else {
          // one treatment a month from month 3; "12" or "24" = that many monthly treatments
          for (var k = 0; k < months; k++) {
            var m = 3 + k, dm = addMonths(start, m);
            ev.push({ d: dm, shown: dm, monthOnly: true, kind: "tx", what: t.short + " monthly maintenance " + (k + 1) + " of " + months,
                      sub: "about " + m + " months after the first treatment" + (k === 0 ? ", if the check-up just before is clear" : "") });
          }
          maintLabel = months + " monthly treatments (about " + (months === 12 ? "1 year" : months / 12 + " years") + "), starting about 3 months after the first treatment";
        }
      } else {
        maintLabel = "none planned";
        if (risk === "high" && s.tx !== "chemo") notes.push("For high-risk cancer, maintenance after the 6-week course is usually recommended. If none is planned, ask your team why.");
      }
      if (risk === "low" && s.tx !== "chemo") notes.push("A course of " + t.short + " is not usually needed for low-risk cancer. If you are having one, your risk group may be higher than low. Please check with your team.");
      if (s.tx === "chemo" && s.maint === "usual") notes.push("Some people also have one treatment a month for up to a year. If your team has planned this, choose “About 1 year” above.");
      if (s.tx === "chemo" && risk === "high") notes.push("High-risk cancer is usually treated with BCG or Gem/Doce rather than one chemotherapy medicine on its own. Please check your plan with your team.");
      if (s.tx !== "chemo") notes.push("If you need a second 6-week course (for example, if CIS or high-grade Ta cancer is still there at the 3-month check), your maintenance and check-up dates will move later.");
      var wd = start.getDay();
      if (wd === 0 || wd === 6) notes.push("The date you entered is a weekend. Clinics usually give treatments on weekdays, so check the date with your team.");
    } else {
      ev.push({ d: start, kind: "tx", what: "Surgery (TURBT) and single dose of chemotherapy", sub: "within 24 hours of surgery", exact: true });
      if (risk === "high") notes.push("People with high-risk cancer usually go on to a course of BCG or Gem/Doce. If you will have one, choose that treatment above instead.");
      if (risk === "int") notes.push("Many people with intermediate-risk cancer also have a 6-week course of treatments. If you will have one, choose that treatment above instead.");
    }
    // Check-ups: guideline schedule for the risk group, plus one before every BCG maintenance block.
    var cy = (CYSTO[risk] || CYSTO.unsure).slice();
    blocks.forEach(function (m) { if (cy.indexOf(m) < 0) cy.push(m); });
    cy.sort(function (a, b) { return a - b; });
    cy.forEach(function (m, ci) {
      var d = addMonths(start, m);
      ev.push({ d: addDays(d, -4), shown: d, kind: "cy", what: "Cystoscopy (camera check)" + (ci === 0 ? ": the first check" : ""),
                sub: "about " + m + " months after " + (s.tx === "single" ? "surgery" : "the first treatment") + (risk === "high" ? ", with urine cytology" : "") });
    });
    ev.sort(function (a, b) { return a.d - b.d || (a.kind === "cy" ? -1 : 1); });
    var nTx = ev.reduce(function (a, e) { return a + (e.kind === "tx" ? (e.count || 1) : 0); }, 0) - (s.tx === "single" ? 1 : 0);
    return { ev: ev, notes: notes, maintLabel: maintLabel, nTx: nTx, nCy: cy.length, risk: risk, start: start, t: t, courseOnly: courseOnly };
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function render() {
    var s = collect();
    syncFields(s.tx);
    if (!s.tx || !parse(s.start)) {
      out.hidden = false;
      actions.hidden = true;
      out.innerHTML = '<p class="da-empty">' + (!s.tx ? "Choose your treatment above to see your calendar." : "Enter a date above to see your calendar.") + "</p>";
      return;
    }
    var p = plan(s), today = new Date();
    var rows = [["Treatment", esc(p.t.name)], ["Risk group", esc(RISK[p.risk])],
                [s.tx === "single" ? "Surgery" : "First treatment", esc(fmt(p.start))]];
    var cyText = p.risk === "unsure" ? "" : p.nCy + " cystoscopies over 5 years";
    if (s.tx !== "single") {
      rows.push(["Plan", "6 weekly treatments" + (p.maintLabel ? "; maintenance: " + esc(p.maintLabel) : "")]);
      if (p.courseOnly) rows.push(["Shown", "The 6-week course and the first check-up. How long treatment continues depends on your risk group."]);
      else rows.push(["In total", p.nTx + " bladder treatments" + (cyText ? ", and " + cyText : " (check-ups after the first depend on your risk group)")]);
    } else if (cyText) {
      rows.push(["Check-ups", cyText]);
    }

    var years = {}, order = [];
    p.ev.forEach(function (e) {
      var y = (e.shown || e.d).getFullYear();
      if (!years[y]) { years[y] = []; order.push(y); }
      years[y].push(e);
    });
    var list = order.map(function (y) {
      return '<h4 class="ivt-year">' + y + '</h4><ol class="ivt-list">' + years[y].map(function (e) {
        var when = e.kind === "cy" || e.monthOnly ? "Around " + fmtMonth(e.shown) : (e.exact ? "" : "About ") + (e.dates ? fmtDates(e.dates) : fmt(e.d));
        return '<li class="ivt-ev ivt-ev-' + e.kind + '"><span class="ivt-when">' + when + '</span><span class="ivt-what"><strong>' + esc(e.what) + "</strong>" +
          (e.sub ? '<span class="ivt-sub">' + esc(e.sub) + "</span>" : "") + "</span></li>";
      }).join("") + "</ol>";
    }).join("");

    out.hidden = false;
    actions.hidden = false;
    out.innerHTML =
      '<div class="da-sum-head"><h3>My bladder treatment calendar</h3><p>Made ' + esc(fmt(today)) + "</p></div>" +
      '<p class="ivt-est"><strong>Estimate only.</strong> Your care team books and confirms every date. If a treatment is delayed, the later dates move too.</p>' +
      '<dl class="da-sum">' + rows.map(function (r) { return "<dt>" + r[0] + "</dt><dd>" + r[1] + "</dd>"; }).join("") + "</dl>" +
      p.notes.map(function (n) { return '<p class="da-agenote">' + esc(n) + "</p>"; }).join("") +
      '<p class="ivt-legend"><span class="ivt-key ivt-key-tx"></span> Bladder treatment <span class="ivt-key ivt-key-cy"></span> Check-up</p>' +
      list +
      '<p class="ivt-after">' + esc(AFTER[p.risk]) + "</p>" +
      '<div class="ivt-print-only ivt-print-foot"><p><strong>Go to emergency</strong> for a temperature of 38.5°C or higher or shaking chills (especially after BCG), if you can’t pass urine, or for heavy bleeding. Say you are having bladder treatment and which medicine.</p>' +
      "<p>Questions: Dr. Nicholas Power’s office, 1-888-909-2786 · nicholaspowerurology.com/education/intravesical-therapy</p></div>";
  }

  function update() { render(); store(); }

  restore(store(true));
  render();
  form.addEventListener("change", update);
  form.addEventListener("input", function (e) { if (e.target === startInput) update(); });
  form.addEventListener("submit", function (e) { e.preventDefault(); });

  document.getElementById("ivt-print").addEventListener("click", function () {
    document.documentElement.classList.add("ivt-print-mode");
    window.print();
  });
  window.addEventListener("afterprint", function () { document.documentElement.classList.remove("ivt-print-mode"); });
  document.getElementById("ivt-clear").addEventListener("click", function () {
    if (!window.confirm("Clear your calendar choices on this device?")) return;
    store(false);
    restore({});
    render();
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  });
})();
