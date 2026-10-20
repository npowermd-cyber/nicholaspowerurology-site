// Places a patient's details and chosen tests onto Dr. Power's scanned
// Ontario Laboratory Requisition (files/lab-requisition.pdf).
// Runs entirely in the patient's browser: nothing is uploaded anywhere.
// Coordinates are in PDF points measured from the TOP-LEFT of the 606 x 792 page.
(function (root) {
  var PAGE_H = 792;
  var CELL = 14.7;               // width of one pre-printed character box
  var LAYOUT = {
    ohip:       { x: 20.7, y: 186.3 },              // "OHIP/Insured" tick box
    health:     { x: 234.6, y: 163.6, cells: 10 },  // health number boxes
    version:    { x: 381.5, y: 163.6, cells: 2 },
    sexM:       { x: 420.0, y: 157.7 },
    sexF:       { x: 450.0, y: 157.7 },
    dobYear:    { x: 468.7, y: 163.6, cells: 4 },
    dobMonth:   { x: 528.3, y: 163.6, cells: 2 },
    dobDay:     { x: 558.0, y: 163.6, cells: 2 },
    phoneArea:  { x: 457.0, y: 188.4 },             // inside the ( )
    phoneRest:  { x: 492.0, y: 188.4 },
    lastName:   { x: 234.8, y: 216.6, cells: 24 },
    firstNames: { x: 235.2, y: 244.0, cells: 24 },
    address1:   { x: 240.0, y: 270.0 },
    address2:   { x: 240.0, y: 283.0 },
    address3:   { x: 240.0, y: 296.0 }
  };
  // Test tick positions (centre of the X column / tick box for each line).
  var TESTS = {
    creatinine: [{ x: 21.0, y: 395.0 }],
    lytes:      [{ x: 21.0, y: 419.3 }, { x: 21.0, y: 431.7 }, { x: 21.0, y: 444.0 }], // Na, K, Cl
    cbc:        [{ x: 243.5, y: 356.0 }],
    urine:      [{ x: 243.5, y: 589.7 }],   // Microbiology ID & Sensitivities: Urine
    psa:        [{ x: 419.3, y: 454.0 }, { x: 419.3, y: 477.0 }] // Total PSA + Insured
  };

  // Keep only characters the standard PDF font can draw.
  function clean(s) {
    s = String(s || '').normalize('NFC').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
    return s.replace(/[^\x20-\x7E -ÿ]/g, '');
  }

  function fill(pdfBytes, d, PDFLib) {
    return PDFLib.PDFDocument.load(pdfBytes).then(function (doc) {
      return doc.embedFont(PDFLib.StandardFonts.HelveticaBold).then(function (font) {
        var page = doc.getPages()[0];
        var ink = PDFLib.rgb(0.05, 0.1, 0.45);

        function text(str, x, yTop, size) {
          str = clean(str);
          if (!str) return;
          page.drawText(str, { x: x, y: PAGE_H - yTop, size: size || 10, font: font, color: ink });
        }
        function boxes(str, spec, size) {
          size = size || 10;
          str = clean(str).toUpperCase().slice(0, spec.cells);
          for (var i = 0; i < str.length; i++) {
            var ch = str[i];
            var w = font.widthOfTextAtSize(ch, size);
            text(ch, spec.x + CELL * i + (CELL - w) / 2, spec.y - 1.5, size);
          }
        }
        function tick(p) {
          var size = 11, w = font.widthOfTextAtSize('X', size);
          text('X', p.x - w / 2, p.y + size * 0.36, size);
        }

        tick(LAYOUT.ohip);
        boxes(d.healthNumber.replace(/\D/g, ''), LAYOUT.health);
        boxes(d.version.replace(/[^A-Za-z]/g, ''), LAYOUT.version);
        if (d.sex === 'M') tick(LAYOUT.sexM);
        if (d.sex === 'F') tick(LAYOUT.sexF);
        if (d.dob) {
          var p = d.dob.split('-');           // yyyy-mm-dd from <input type=date>
          boxes(p[0], LAYOUT.dobYear); boxes(p[1], LAYOUT.dobMonth); boxes(p[2], LAYOUT.dobDay);
        }
        var ph = d.phone.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
        if (ph.length === 10) {
          text(ph.slice(0, 3), LAYOUT.phoneArea.x, LAYOUT.phoneArea.y);
          text(ph.slice(3, 6) + '-' + ph.slice(6), LAYOUT.phoneRest.x, LAYOUT.phoneRest.y);
        } else if (ph) {
          text(d.phone, LAYOUT.phoneArea.x - 10, LAYOUT.phoneArea.y);
        }
        boxes(d.lastName, LAYOUT.lastName);
        boxes(d.firstNames, LAYOUT.firstNames);
        text(d.street, LAYOUT.address1.x, LAYOUT.address1.y);
        text([d.city, d.province, d.postal].filter(Boolean).join('  '), LAYOUT.address2.x, LAYOUT.address2.y);

        (d.tests || []).forEach(function (t) { (TESTS[t] || []).forEach(tick); });
        return doc.save();
      });
    });
  }

  root.fillRequisition = fill;
  if (typeof module !== 'undefined') module.exports = { fill: fill, LAYOUT: LAYOUT, TESTS: TESTS };
})(typeof window !== 'undefined' ? window : globalThis);
