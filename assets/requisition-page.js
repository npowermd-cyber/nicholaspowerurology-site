// Lab requisition page: collects the patient's details, fills the scanned form
// in the browser, and hands back a PDF to print. Nothing leaves the device.
(function () {
  var form = document.getElementById('req-form');
  if (!form) return;
  var status = document.getElementById('req-status');
  var result = document.getElementById('req-result');
  var openLink = document.getElementById('req-open');
  var saveLink = document.getElementById('req-save');
  var button = form.querySelector('button[type="submit"]');
  var pdfUrl = null;
  var blankPdf = null;

  function val(id) { return (document.getElementById(id).value || '').trim(); }

  function setError(msg, fieldId) {
    status.className = 'form-status err';
    status.textContent = msg;
    if (fieldId) document.getElementById(fieldId).focus();
  }

  // Health card number: show it as 1234-567-890 while typing.
  var hn = document.getElementById('r-health');
  hn.addEventListener('input', function () {
    var d = hn.value.replace(/\D/g, '').slice(0, 10);
    hn.value = d.replace(/^(\d{4})(\d{0,3})(\d{0,3}).*/, function (m, a, b, c) {
      return [a, b, c].filter(Boolean).join('-');
    }) || d;
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    result.hidden = true;
    var tests = Array.prototype.slice.call(form.querySelectorAll('input[name="test"]:checked')).map(function (c) { return c.value; });
    var health = val('r-health').replace(/\D/g, '');
    if (health.length !== 10) return setError('Enter the 10 digits of your health card number.', 'r-health');
    if (!val('r-last')) return setError('Enter your last name as it appears on your health card.', 'r-last');
    if (!val('r-first')) return setError('Enter your first name as it appears on your health card.', 'r-first');
    if (!val('r-dob')) return setError('Enter your date of birth.', 'r-dob');
    if (!form.querySelector('input[name="sex"]:checked')) return setError('Choose the sex shown on your health card.', 'r-sex-m');
    if (!tests.length) return setError('Tick at least one test that Dr. Power ordered for you.', 'r-t-first');

    var data = {
      healthNumber: health,
      version: val('r-version'),
      lastName: val('r-last'),
      firstNames: val('r-first'),
      sex: form.querySelector('input[name="sex"]:checked').value,
      dob: val('r-dob'),
      phone: val('r-phone'),
      street: val('r-street'),
      city: val('r-city'),
      province: val('r-prov'),
      postal: val('r-postal').toUpperCase(),
      tests: tests
    };

    button.disabled = true;
    status.className = 'form-status';
    status.textContent = 'Making your requisition…';

    var load = blankPdf ? Promise.resolve(blankPdf) :
      fetch(form.getAttribute('data-blank')).then(function (r) {
        if (!r.ok) throw new Error('blank');
        return r.arrayBuffer();
      }).then(function (b) { blankPdf = b; return b; });

    load.then(function (bytes) { return window.fillRequisition(bytes, data, window.PDFLib); })
      .then(function (out) {
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        pdfUrl = URL.createObjectURL(new Blob([out], { type: 'application/pdf' }));
        openLink.href = pdfUrl;
        saveLink.href = pdfUrl;
        saveLink.download = 'lab-requisition-' + data.lastName.replace(/[^A-Za-z]/g, '').toLowerCase() + '.pdf';
        status.className = 'form-status ok';
        status.textContent = 'Your requisition is ready.';
        result.hidden = false;
        result.scrollIntoView({ behavior: 'smooth', block: 'center' });
      })
      .catch(function () {
        setError('The requisition could not be made. Check your connection and try again, or call 1-888-909-2786.');
      })
      .finally(function () { button.disabled = false; });
  });

  document.getElementById('req-clear').addEventListener('click', function () {
    form.reset();
    result.hidden = true;
    status.textContent = '';
    if (pdfUrl) { URL.revokeObjectURL(pdfUrl); pdfUrl = null; }
  });
})();
