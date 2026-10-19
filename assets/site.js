// Menu toggle for phones
(function () {
  var btn = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (!btn || !nav) return;
  btn.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.textContent = open ? 'Close' : 'Menu';
  });
})();

// Contact forms. Messages are delivered by Web3Forms; the destination
// address is held in the Web3Forms account, so it never appears on this site.
(function () {
  var KEY = 'WEB3FORMS_ACCESS_KEY'; // replaced with the real key at setup
  document.querySelectorAll('form[data-web3forms]').forEach(function (form) {
    var status = form.querySelector('.form-status');
    var button = form.querySelector('button[type="submit"]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      if (KEY.indexOf('ACCESS_KEY') !== -1) {
        status.className = 'form-status err';
        status.textContent = 'This form is not connected yet. Please call 1-888-909-2786.';
        return;
      }
      var data = {};
      new FormData(form).forEach(function (v, k) {
        data[k] = data[k] ? data[k] + ', ' + v : v;
      });
      if (data.botcheck) return; // spam trap
      data.access_key = KEY;
      button.disabled = true;
      status.className = 'form-status';
      status.textContent = 'Sending…';
      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (res) {
          if (res && res.success) {
            form.reset();
            status.className = 'form-status ok';
            status.textContent = form.getAttribute('data-success') || 'Sent. Thank you.';
          } else { throw new Error(); }
        })
        .catch(function () {
          status.className = 'form-status err';
          status.textContent = 'Your message did not send. Check your connection and try again, or call 1-888-909-2786.';
        })
        .finally(function () { button.disabled = false; });
    });
  });
})();
