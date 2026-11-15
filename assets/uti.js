/* Urinary tract infections page: "Where should I get care?" guide and prevention plan builder.
   Everything runs in the browser. Nothing is sent anywhere. Only the prevention plan is kept,
   in this browser's storage, so a patient can add to their UTI log later. */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function checked(form, name) {
    return Array.prototype.filter.call(form.querySelectorAll('input[name="' + name + '"]'), function (i) { return i.checked; })
      .map(function (i) { return i.value; });
  }
  function radio(form, name) {
    var el = form.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : "";
  }
  function list(items) { return "<ul>" + items.filter(Boolean).map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ul>"; }

  // ------------------------------------------------------------------ Where should I get care?
  var tri = document.getElementById("uti-triage");
  if (tri) {
    tri.hidden = false;
    var qSym = document.getElementById("uti-q-sym");
    var qYou = document.getElementById("uti-q-you");
    var out = document.getElementById("uti-result");
    var actions = document.getElementById("uti-triage-actions");

    var FLAG_WHY = {
      fever: "Fever or shaking chills with urinary symptoms can mean the infection has reached the kidneys, the prostate or the blood.",
      flank: "Pain in the side or back can mean a kidney infection, or a kidney stone blocking the kidney.",
      vomit: "Nausea or vomiting with urinary symptoms can be a sign of a kidney infection. If you can’t keep fluids or pills down, antibiotics by mouth won’t work and you can become dehydrated.",
      pregnant: "Contractions, bleeding or leaking fluid in pregnancy need to be checked right away by the obstetrical team.",
      sepsis: "These can be signs of sepsis, an infection spreading through the body, which needs treatment within hours.",
      confused: "Sudden confusion can be a sign of a serious infection or another illness. Often the cause is not a UTI, but it needs checking right away.",
      retention: "A bladder that can’t empty, or a blocked catheter, needs draining quickly, and makes infection more serious.",
      clots: "Heavy bleeding or clots can block the flow of urine and need to be checked."
    };
    var YOU_WHY = {
      male: "UTIs in men always need an assessment and a urine culture. Pharmacists in Ontario don’t treat UTIs in men.",
      preg: "In pregnancy a UTI is always treated, a culture is always done, and the antibiotic must be safe for the baby.",
      child: "Children with UTI symptoms should be seen by a doctor or nurse practitioner the same day. A baby under 3 months old with a fever needs emergency care.",
      tract: "A catheter, stent, stones, kidney disease, a recent procedure or a bladder that doesn’t empty make a UTI more likely to be complicated.",
      immune: "With a weakened immune system, infections can become serious more quickly.",
      failing: "The bacteria may be resistant to your antibiotic. You may need a culture and a different treatment.",
      relapse: "Symptoms that come back within 4 weeks can mean the bacteria weren’t fully cleared, or are resistant.",
      recurrent: "With frequent UTIs, a culture each time matters, so you get the right antibiotic and a clear record. It is also worth talking about prevention.",
      blood: "Blood you can see in your urine often comes with a bladder infection, but it needs a doctor or nurse practitioner rather than a pharmacist, and it should be checked again after the infection has cleared. Ontario pharmacists refer anyone with visible blood in their urine."
    };
    var GET_WORSE = '<p class="uti-why"><strong>This guide doesn’t diagnose.</strong> If you get worse, or develop a fever, chills, side or back pain, nausea or vomiting, or confusion, go to an emergency department. If you are unsure, call Health811 (dial <a href="tel:811">8-1-1</a>) any time.</p>';

    function exclusive(e) {
      var t = e.target;
      if (t.type !== "checkbox") return;
      var group = tri.querySelectorAll('input[name="' + t.name + '"]');
      Array.prototype.forEach.call(group, function (i) {
        if (t.checked && i !== t && (t.value === "none" || i.value === "none")) i.checked = false;
      });
    }

    function render() {
      var flags = checked(tri, "flag");
      var sym = checked(tri, "sym");
      var you = checked(tri, "you");
      var redFlags = flags.filter(function (f) { return f !== "none"; });
      var res = null;

      qSym.hidden = !(flags.length && !redFlags.length);
      qYou.hidden = qSym.hidden || !sym.length || (sym.length === 1 && sym[0] === "none");

      if (redFlags.length) {
        res = { cls: "uti-res-er", tone: "da-tone-high", badge: redFlags.indexOf("pregnant") > -1 ? "Get help now: obstetrical triage or emergency" : "Go to an emergency department now",
                body: (redFlags.indexOf("sepsis") > -1 || redFlags.indexOf("confused") > -1
                  ? '<p class="uti-call">Call <a href="tel:911">9-1-1</a> if the person is very unwell, very drowsy or confused, or can’t get to hospital safely.</p>' : "") +
                  list([redFlags.indexOf("pregnant") > -1
                          ? "Go to obstetrical triage (Labour and Delivery) at the hospital where you plan to give birth, or the nearest emergency department."
                          : "Go to the nearest emergency department. In London, adults: Victoria Hospital or University Hospital.",
                        redFlags.indexOf("pregnant") > -1 ? "" : "For a child: the Children’s Emergency Department at Children’s Hospital, Victoria Hospital site (800 Commissioners Road East, London).",
                        "Don’t drive yourself if you feel faint or very unwell.",
                        "Bring a list of your medicines. Tell the team about any antibiotics or urine tests in the last few weeks, and any recent urology procedure."]),
                why: redFlags.map(function (f) { return FLAG_WHY[f]; }) };
      } else if (!qSym.hidden && sym.length === 1 && sym[0] === "none") {
        res = { cls: "uti-res-none", tone: "da-tone-ok", badge: "This doesn’t sound like a UTI",
                body: "<p>Urine that looks cloudy or dark, or smells different, and a positive urine test without symptoms, usually don’t need antibiotics.</p>" +
                  list(["Drink more water for a day or two and see if it clears.",
                        "If a doctor did the test, ask what the result means for you. Bacteria without symptoms usually aren’t treated (see <a href=\"#not-uti\">Part 2</a>).",
                        "If you are pregnant, or are about to have a urology procedure, follow your care team’s advice: bacteria are treated in these situations.",
                        "If symptoms such as burning or urgency start, come back to this guide."]),
                why: [] };
      } else if (!qYou.hidden && you.length) {
        var items = you.filter(function (y) { return y !== "none"; });
        var symReal = sym.filter(function (s) { return s !== "none"; });
        if (symReal.indexOf("blood") > -1) items.push("blood");
        var today = items.filter(function (y) { return ["male", "preg", "child", "tract", "immune", "failing"].indexOf(y) > -1; });
        var soon = items.filter(function (y) { return ["relapse", "recurrent", "blood"].indexOf(y) > -1; });
        var self = items.indexOf("selfstart") > -1;
        var typical = symReal.indexOf("burn") > -1 ||
          symReal.filter(function (s) { return s === "freq" || s === "pain" || s === "blood"; }).length >= 2;

        if (today.length) {
          var first = items.indexOf("preg") > -1
            ? "Call your prenatal care provider (doctor or midwife) today. If you can’t reach them, go to obstetrical triage (Labour and Delivery) at the hospital where you plan to give birth."
            : items.indexOf("child") > -1
            ? "Call your child’s doctor or nurse practitioner and ask for a visit today. If they can’t see your child today, or your child seems unwell, go to the Children’s Emergency Department at Children’s Hospital, Victoria Hospital site."
            : "Call your family doctor’s or nurse practitioner’s office and ask to be seen today. If they can’t see you, go to an urgent care centre or walk-in clinic.";
          res = { cls: "uti-res-today", tone: "da-tone-mid", badge: "See a doctor or nurse practitioner today",
                  body: list([first,
                              "Ask for a urine culture before you start any antibiotic (or a new one).",
                              "If you develop a fever, chills, side or back pain, nausea or vomiting before you are seen, go to emergency."]),
                  why: today.map(function (y) { return YOU_WHY[y]; }) };
        } else if (self && !items.some(function (y) { return y === "relapse" || y === "blood"; })) {
          res = { cls: "uti-res-soon", tone: "da-tone-ok", badge: "Follow your self-start plan",
                  body: list(["Give a urine sample for culture first, using your requisition.",
                              "Then start the antibiotic exactly as your doctor prescribed.",
                              "Call your doctor if you aren’t clearly better in 2 to 3 days, if this feels different from your usual UTIs, or if the culture shows a resistant germ."]),
                  why: ["You have a plan from your doctor for infections like this one."] };
        } else if (soon.length || !typical) {
          var why = soon.map(function (y) { return YOU_WHY[y]; });
          if (!typical) why.push("One of these symptoms on its own, without burning, is less likely to be a UTI. A doctor or nurse practitioner can look for other causes.");
          res = { cls: "uti-res-soon", tone: "da-tone-mid", badge: "See your family doctor or nurse practitioner within a day or two",
                  body: list(["Ask for a urine culture before starting any antibiotic, and for a copy of the result.",
                              "If you can’t be seen within a day or two, a walk-in clinic can do the culture.",
                              self ? "You can start your self-start antibiotic after giving the culture sample, but still contact your doctor." : "Add it to your <a href=\"#plan\">UTI log</a>.",
                              "If you develop a fever, chills, side or back pain, nausea or vomiting, go to emergency."]),
                  why: why };
        } else {
          res = { cls: "uti-res-pharm", tone: "da-tone-ok", badge: "A pharmacist can help, or your family doctor",
                  body: list(["Ontario pharmacists can assess a simple bladder infection and prescribe treatment if it’s right for you. The assessment is free with an Ontario health card; you pay for the antibiotic unless the Ontario Drug Benefit or a private plan covers it. Call ahead to check a pharmacist is available, in person or by phone or video.",
                              "Your family doctor or nurse practitioner is also a good choice.",
                              "For mild symptoms, you can ask about waiting a day or two with pain relief (see <a href=\"#treatment\">Part 4</a>).",
                              "Get help again if you aren’t clearly better 2 to 3 days after starting treatment."]),
                  why: ["You have typical bladder infection symptoms and none of the things that mean a doctor should see you first. The pharmacist will still check, and will refer you if needed."] };
        }
      }

      if (!res) { out.hidden = true; actions.hidden = !flags.length; return; }
      out.className = "da-result uti-result " + res.cls;
      out.innerHTML = '<p><span class="da-badge ' + res.tone + '">' + esc(res.badge) + "</span></p>" + res.body +
        (res.why.length ? '<div class="uti-why"><strong>Why:</strong>' + list(res.why) + "</div>" : "") + GET_WORSE;
      out.hidden = false;
      actions.hidden = false;
    }

    tri.addEventListener("change", function (e) { exclusive(e); render(); });
    document.getElementById("uti-triage-reset").addEventListener("click", function () {
      tri.reset();
      render();
      document.getElementById("uti-q-flags").scrollIntoView({ block: "start" });
    });
    render();
  }

  // ------------------------------------------------------------------ Prevention plan builder
  var plan = document.getElementById("uti-plan");
  if (!plan) return;
  var KEY = "uti-plan-v1";
  var sum = document.getElementById("uti-summary");
  var rowsEl = document.getElementById("uti-log-rows");
  var status = document.getElementById("uti-plan-status");
  plan.hidden = false;
  sum.hidden = false;
  document.getElementById("uti-plan-actions").hidden = false;

  var LABELS = {
    meno: { q: "Around or after menopause", yes: "Yes", no: "No", na: "Doesn’t apply" },
    sex: { q: "UTIs often start within a day or two of sex", yes: "Yes", no: "No", unsure: "Not sure" },
    fluid: { q: "Usual daily fluids", low: "Less than 1.5 L", ok: "1.5 L or more", unsure: "Not sure" },
    sperm: { q: "Spermicide use", yes: "Yes", no: "No", unsure: "Not sure" }
  };
  var SELF = {
    culture: "Give a urine sample for culture each time I have symptoms, before starting an antibiotic, and keep the results",
    water: "Drink about 1.5 litres more water a day (if I drink less than about 1.5 litres now)",
    cranberry: "Take a cranberry product every day",
    spermicide: "Stop using spermicide and choose other birth control",
    bowels: "Treat constipation if I have it"
  };
  var ASK = {
    estrogen: "Vaginal estrogen",
    methenamine: "Methenamine hippurate (non-antibiotic tablet)",
    postcoital: "One antibiotic dose after sex",
    daily: "A low-dose antibiotic every day",
    selfstart: "A self-start antibiotic plan, with a standing lab requisition for urine cultures",
    "other-cause": "Whether something else could be causing my symptoms",
    urology: "Referral to a urologist"
  };
  var CULTURE = { "": "", pos: "Positive (bacteria grew)", neg: "Negative (no growth)", mixed: "Mixed or contaminated", none: "Not done", unsure: "Not sure" };

  function rowHtml(r, i) {
    r = r || {};
    function opt(map, v) {
      return Object.keys(map).map(function (k) { return '<option value="' + k + '"' + (k === (v || "") ? " selected" : "") + ">" + esc(map[k] || "Choose") + "</option>"; }).join("");
    }
    var id = "uti-log-" + i + "-";
    return '<div class="uti-log" data-row="' + i + '">' +
      '<div><label class="da-label" for="' + id + 'date">Date symptoms started</label><input class="da-input" type="date" id="' + id + 'date" data-f="date" value="' + esc(r.date) + '"></div>' +
      '<div><label class="da-label" for="' + id + 'sym">Symptoms</label><input class="da-input" type="text" id="' + id + 'sym" data-f="sym" maxlength="120" value="' + esc(r.sym) + '" placeholder="e.g. burning, urgency"></div>' +
      '<div><label class="da-label" for="' + id + 'fever">Fever or back pain?</label><select class="da-input" id="' + id + 'fever" data-f="fever">' + opt({ "": "", no: "No", yes: "Yes" }, r.fever) + "</select></div>" +
      '<div><label class="da-label" for="' + id + 'cult">Urine culture</label><select class="da-input" id="' + id + 'cult" data-f="cult">' + opt(CULTURE, r.cult) + "</select></div>" +
      '<div><label class="da-label" for="' + id + 'germ">Germ found</label><input class="da-input" type="text" id="' + id + 'germ" data-f="germ" maxlength="80" value="' + esc(r.germ) + '" placeholder="e.g. E. coli"></div>' +
      '<div><label class="da-label" for="' + id + 'abx">Antibiotic and days</label><input class="da-input" type="text" id="' + id + 'abx" data-f="abx" maxlength="80" value="' + esc(r.abx) + '" placeholder="e.g. nitrofurantoin, 5 days"></div>' +
      '<button type="button" class="uti-log-del" data-del="' + i + '">Remove this infection</button></div>';
  }
  function readRows() {
    return Array.prototype.map.call(rowsEl.querySelectorAll(".uti-log"), function (row) {
      var r = {};
      Array.prototype.forEach.call(row.querySelectorAll("[data-f]"), function (el) { r[el.getAttribute("data-f")] = el.value.trim(); });
      return r;
    });
  }
  function drawRows(rows) { rowsEl.innerHTML = rows.map(rowHtml).join(""); }

  function collect() {
    return { meno: radio(plan, "meno"), sex: radio(plan, "sex"), fluid: radio(plan, "fluid"), sperm: radio(plan, "sperm"),
             self: checked(plan, "self"), ask: checked(plan, "ask"),
             questions: document.getElementById("uti-questions").value, log: readRows(), made: new Date().toISOString().slice(0, 10) };
  }
  function store(data) {
    try {
      if (data === null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  }
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; }
  }
  function restore(d) {
    if (!d) return;
    ["meno", "sex", "fluid", "sperm"].forEach(function (n) {
      var el = plan.querySelector('input[name="' + n + '"][value="' + d[n] + '"]');
      if (el) el.checked = true;
    });
    ["self", "ask"].forEach(function (n) {
      (d[n] || []).forEach(function (v) {
        var el = plan.querySelector('input[name="' + n + '"][value="' + v + '"]');
        if (el) el.checked = true;
      });
    });
    document.getElementById("uti-questions").value = d.questions || "";
    drawRows(Array.isArray(d.log) ? d.log : []);
  }

  function tags(d) {
    var show = {
      always: true,
      water: d.fluid === "low" || d.fluid === "unsure",
      sperm: d.sperm === "yes" || d.sperm === "unsure",
      meno: d.meno === "yes",
      sex: d.sex === "yes"
    };
    Array.prototype.forEach.call(plan.querySelectorAll(".uti-tag"), function (t) { t.hidden = !show[t.getAttribute("data-for")]; });
  }

  function fmtDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
    if (!m) return "";
    var M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return M[+m[2] - 1] + " " + (+m[3]) + ", " + m[1];
  }

  function summary(d) {
    var about = ["meno", "sex", "fluid", "sperm"].filter(function (k) { return d[k]; })
      .map(function (k) { return "<dt>" + esc(LABELS[k].q) + "</dt><dd>" + esc(LABELS[k][d[k]]) + "</dd>"; }).join("");
    var log = d.log.filter(function (r) { return r.date || r.sym || r.cult || r.germ || r.abx || r.fever; })
      .sort(function (a, b) { return (a.date || "").localeCompare(b.date || ""); });
    var empty = !about && !d.self.length && !d.ask.length && !d.questions.trim() && !log.length;
    var h = '<div class="da-sum-head"><h3>My UTI prevention plan</h3><p>' + esc(fmtDate(d.made)) + "</p></div>";
    if (empty) return h + '<p class="da-empty">Your plan will appear here as you answer the questions above.</p>';
    if (about) h += '<h4>About me</h4><dl class="da-sum">' + about + "</dl>";
    if (d.self.length) h += "<h4>Things I’ll do myself</h4>" + list(d.self.map(function (v) { return esc(SELF[v]); }));
    if (d.ask.length) h += "<h4>Things I’d like to ask about</h4>" + list(d.ask.map(function (v) { return esc(ASK[v]); }));
    if (d.questions.trim()) h += "<h4>My questions and notes</h4><p>" + esc(d.questions.trim()).replace(/\n/g, "<br>") + "</p>";
    if (log.length) {
      var pos = log.filter(function (r) { return r.cult === "pos"; }).length;
      h += "<h4>My UTI log</h4><p class=\"da-small\">" + log.length + (log.length === 1 ? " infection" : " infections") + " recorded, " + pos + " with a positive culture.</p>" +
        '<table class="uti-sum-table"><thead><tr><th>Date</th><th>Symptoms</th><th>Fever or back pain</th><th>Culture</th><th>Germ</th><th>Antibiotic</th></tr></thead><tbody>' +
        log.map(function (r) {
          return '<tr><td data-h="Date">' + esc(fmtDate(r.date) || "–") + '</td><td data-h="Symptoms">' + esc(r.sym || "–") +
            '</td><td data-h="Fever or back pain">' + esc(r.fever === "yes" ? "Yes" : r.fever === "no" ? "No" : "–") +
            '</td><td data-h="Culture">' + esc(CULTURE[r.cult] || "–") + '</td><td data-h="Germ">' + esc(r.germ || "–") +
            '</td><td data-h="Antibiotic">' + esc(r.abx || "–") + "</td></tr>";
        }).join("") + "</tbody></table>";
    }
    h += '<div class="uti-print-only"><h4>Notes from my appointment</h4><div class="uti-sum-lines"></div><div class="uti-sum-lines"></div><div class="uti-sum-lines"></div>' +
      '<p class="da-small"><strong>Go to emergency</strong> for fever or shaking chills, pain in the side or back, nausea or vomiting, sudden confusion, feeling very unwell, being unable to pass urine or a catheter that stops draining. ' +
      "Health811: dial 811, any time. From nicholaspowerurology.com/education/uti. For education only; it does not replace advice from your own care team.</p></div>";
    return h;
  }

  var saveTimer = null;
  function update(save) {
    var d = collect();
    tags(d);
    sum.innerHTML = summary(d);
    if (save) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        status.textContent = store(d) ? "Saved on this device." : "Couldn’t save on this device (private browsing?). You can still print your plan.";
      }, 300);
    }
  }

  restore(load());
  update(false);

  plan.addEventListener("change", function () { update(true); });
  plan.addEventListener("input", function () { update(true); });
  plan.addEventListener("submit", function (e) { e.preventDefault(); });
  document.getElementById("uti-log-add").addEventListener("click", function () {
    var rows = readRows();
    rows.push({});
    drawRows(rows);
    var inputs = rowsEl.querySelectorAll('input[data-f="date"]');
    if (inputs.length) inputs[inputs.length - 1].focus();
    update(true);
  });
  rowsEl.addEventListener("click", function (e) {
    var i = e.target.getAttribute && e.target.getAttribute("data-del");
    if (i === null || i === undefined) return;
    var rows = readRows();
    rows.splice(+i, 1);
    drawRows(rows);
    update(true);
    document.getElementById("uti-log-add").focus();
  });
  document.getElementById("uti-plan-print").addEventListener("click", function () {
    document.documentElement.classList.add("uti-print-mode");
    window.print();
  });
  window.addEventListener("afterprint", function () { document.documentElement.classList.remove("uti-print-mode"); });
  document.getElementById("uti-plan-clear").addEventListener("click", function () {
    if (!window.confirm("Clear your plan and UTI log from this device?")) return;
    store(null);
    plan.reset();
    drawRows([]);
    update(false);
    status.textContent = "Cleared from this device.";
  });
})();
