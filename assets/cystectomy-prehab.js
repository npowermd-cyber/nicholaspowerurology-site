/* Getting ready for cystectomy: 4-week checklist.
   Ticks and self-check results are kept only in this browser's storage, never sent anywhere. */
(function () {
  "use strict";
  var tracker = document.getElementById("pre-tracker");
  if (!tracker) return;
  var KEY = "cystectomy-prehab-v1";
  var storageOk = true;

  function load() {
    var raw;
    try { raw = localStorage.getItem(KEY); }
    catch (e) { storageOk = false; return {}; }
    if (!raw) return {};
    try {
      var data = JSON.parse(raw);
      return data && typeof data === "object" ? data : {};
    } catch (e) {
      // A damaged saved value: start fresh rather than blaming the browser.
      try { localStorage.removeItem(KEY); } catch (e2) { /* ignore */ }
      return {};
    }
  }
  function save(data) {
    try {
      if (data === null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) { storageOk = false; }
  }

  var boxes = tracker.querySelectorAll("input[type=checkbox]");
  var fields = tracker.querySelectorAll("input[type=text], input[type=date]");

  function collect() {
    var data = { ticks: {}, fields: {} };
    Array.prototype.forEach.call(boxes, function (b) { if (b.checked) data.ticks[b.name] = 1; });
    Array.prototype.forEach.call(fields, function (f) { if (f.value) data.fields[f.name] = f.value; });
    return data;
  }
  function restore(data) {
    var t = data.ticks || {}, v = data.fields || {};
    Array.prototype.forEach.call(boxes, function (b) { b.checked = !!t[b.name]; });
    Array.prototype.forEach.call(fields, function (f) { f.value = v[f.name] || ""; });
  }

  var DAY = 86400000;
  function parseDate(id) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(document.getElementById(id).value || "");
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function daysBetween(a, b) { return Math.round((b - a) / DAY); }
  function fmt(d, long) {
    return d.toLocaleDateString("en-CA", long ? { weekday: "long", month: "long", day: "numeric" } : { weekday: "short", month: "short", day: "numeric" });
  }

  // Works out the dates from Day 1 and/or the surgery date, marks today, the last 7 days
  // before surgery ("Get ready") and surgery day, and explains what to do if the plan is
  // shorter or longer than 4 weeks. Returns today's day number, or null.
  function renderDates() {
    var start = parseDate("pre-start"), surgery = parseDate("pre-surgery");
    var note = document.getElementById("pre-plan-note");
    var msg = "";
    var eff = start || (surgery ? addDays(surgery, -28) : null);
    var surgeryDay = eff && surgery ? daysBetween(eff, surgery) + 1 : null;

    if (surgery && !start) {
      msg = "Counting back from your surgery date, <strong>Day 1 is " + fmt(eff, true) + "</strong>, so Week 4 is your last week before surgery. " +
        "Starting later than that? Begin with Week 1 anyway, and enter your real Day 1 above.";
    } else if (surgeryDay !== null && surgeryDay <= 1) {
      msg = "Your surgery date is on or before Day 1. Please check the dates.";
    } else if (surgeryDay !== null && surgeryDay < 29) {
      msg = "Your surgery is on <strong>Day " + surgeryDay + "</strong>, so you have " + (surgeryDay - 1) + " days. " +
        "Work through the weeks as far as you get. For the last 7 days before surgery, marked <strong>Get ready</strong>, follow the Week 4 goals instead: gentle walks, a lighter last strength session, and keep up the breathing.";
    } else if (surgeryDay !== null && surgeryDay > 29) {
      msg = "Your surgery is " + (surgeryDay - 28) + " days after Day 28. " +
        "Repeat Week 2 or 3 until the last week, then do Week 4. Tip: to line Week 4 up with your last week, set Day 1 to " + fmt(addDays(surgery, -28), true) + ".";
    } else if (surgeryDay === 29) {
      msg = "Your surgery is the day after Day 28. Week 4 is your last week before surgery.";
    }
    note.innerHTML = msg;
    note.hidden = !msg;

    var todayDay = null;
    if (eff) {
      var now = new Date();
      todayDay = daysBetween(eff, new Date(now.getFullYear(), now.getMonth(), now.getDate())) + 1;
    }
    Array.prototype.forEach.call(tracker.querySelectorAll("tr[data-day]"), function (tr) {
      var day = +tr.getAttribute("data-day");
      var dateEl = tr.querySelector("[data-date]");
      var tag = tr.querySelector(".pre-tag");
      if (!tag) {
        tag = document.createElement("span");
        tag.className = "pre-tag";
        tr.querySelector("th").appendChild(tag);
      }
      dateEl.textContent = eff ? fmt(addDays(eff, day - 1)) : "";
      var after = surgeryDay !== null && surgeryDay > 1 && day >= surgeryDay;
      var taper = surgeryDay !== null && surgeryDay > 1 && surgeryDay < 29 && day < surgeryDay && day >= surgeryDay - 7 && day < 22;
      tr.classList.toggle("pre-today", day === todayDay);
      tr.classList.toggle("pre-after", after);
      tr.classList.toggle("pre-taper", taper);
      tag.textContent = day === surgeryDay ? "Surgery day" : after ? "After surgery" : taper ? "Get ready" : "";
    });
    return todayDay;
  }

  function renderCounts() {
    Array.prototype.forEach.call(tracker.querySelectorAll(".pre-week"), function (week) {
      var n = week.querySelectorAll("input[type=checkbox]:checked").length;
      var walks = week.querySelectorAll("input[name$='-walk']:checked").length;
      var out = week.querySelector(".pre-week-count");
      out.textContent = n ? "Walked " + walks + " of 7 days · " + n + (n === 1 ? " tick" : " ticks") : "";
    });
  }

  function update() {
    renderDates();
    renderCounts();
    save(collect());
    if (!storageOk) {
      document.getElementById("pre-save-note").textContent =
        "This browser isn’t letting the page save your ticks, so they will be lost when you leave. You can print the large-print log instead.";
    }
  }

  // Open the week that contains today, if a start date is set.
  function openCurrentWeek() {
    var day = renderDates();
    if (!day || day < 1 || day > 28) return;
    var w = Math.ceil(day / 7);
    Array.prototype.forEach.call(tracker.querySelectorAll(".pre-week"), function (week) {
      week.open = +week.getAttribute("data-week") === w;
    });
  }

  // 100-dot pictures (same look as the prostate cancer decision aid).
  Array.prototype.forEach.call(document.querySelectorAll(".pre-part .da-icons"), function (el) {
    if (el.childNodes.length) return;
    var n = parseInt(el.getAttribute("data-n"), 10);
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", n + " out of 100 people");
    var html = "";
    for (var i = 0; i < 100; i++) html += "<i" + (i < n ? ' class="on"' : "") + "></i>";
    el.innerHTML = html;
  });

  restore(load());
  openCurrentWeek();
  renderCounts();
  if (!storageOk) update();

  tracker.addEventListener("change", function (e) {
    update();
    if (e.target.id === "pre-start" || e.target.id === "pre-surgery") openCurrentWeek();
  });
  tracker.addEventListener("input", function (e) { if (e.target.type === "text") update(); });

  var printBtn = document.getElementById("pre-print");
  var clearBtn = document.getElementById("pre-clear");
  var status = document.getElementById("pre-status");
  printBtn.hidden = false;
  clearBtn.hidden = false;

  var wasOpen = [];
  function openAll() {
    wasOpen = [];
    Array.prototype.forEach.call(document.querySelectorAll("#main details"), function (d) {
      wasOpen.push([d, d.open]);
      d.open = true;
    });
  }
  function restoreOpen() {
    wasOpen.forEach(function (p) { p[0].open = p[1]; });
    wasOpen = [];
    document.documentElement.classList.remove("pre-print-mode");
  }
  window.addEventListener("beforeprint", function () { if (!wasOpen.length) openAll(); });
  window.addEventListener("afterprint", restoreOpen);

  printBtn.addEventListener("click", function () {
    document.documentElement.classList.add("pre-print-mode");
    openAll();
    window.print();
  });

  clearBtn.addEventListener("click", function () {
    if (!window.confirm("Clear all your ticks and self-check results on this device?")) return;
    restore({});
    save(null);
    renderDates();
    renderCounts();
    Array.prototype.forEach.call(tracker.querySelectorAll(".pre-week"), function (week) {
      week.open = week.getAttribute("data-week") === "1";
    });
    status.textContent = "Your ticks have been cleared from this device.";
    setTimeout(function () { status.textContent = ""; }, 6000);
  });
})();
