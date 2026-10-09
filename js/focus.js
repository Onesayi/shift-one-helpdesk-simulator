// Keyboard focus for both desks. Every render replaces the DOM, which would drop focus back to
// the page; Focus.keep() remembers the focused control by id, or by its data-act and data-*
// attributes, and puts focus back on the same control in the new DOM. A dialog that opens takes
// focus, and focus returns to whatever opened it when it closes.

const Focus = (() => {
  let opener = null; // the control that opened the current dialog

  const DATA = el => [...el.attributes].filter(a => a.name.startsWith('data-')).map(a => [a.name, a.value]);

  function describe(el) {
    if (!el || el === document.body || !el.matches) return null;
    if (el.id) return { id: el.id };
    if (!el.dataset.act) return null;
    return { act: el.dataset.act, data: DATA(el) };
  }

  function find(d) {
    if (!d) return null;
    if (d.id) return document.getElementById(d.id);
    return [...document.querySelectorAll('[data-act]')]
      .find(n => n.dataset.act === d.act && n.attributes.length >= d.data.length && d.data.every(([k, v]) => n.getAttribute(k) === v)) || null;
  }

  const lost = () => !document.activeElement || document.activeElement === document.body;
  const dialog = () => document.querySelector('#modal-root .modal');

  // Call before replacing the DOM; call the returned function after.
  function keep() {
    const before = describe(document.activeElement), hadDialog = !!dialog();
    return () => {
      const m = dialog();
      if (m && !hadDialog) {
        opener = before;
        if (!m.contains(document.activeElement)) m.querySelector('input:not([type="hidden"]), select, textarea, button')?.focus();
        return;
      }
      if (!m && hadDialog && lost()) { find(opener)?.focus({ preventScroll: true }); opener = null; return; }
      if (lost()) find(before)?.focus({ preventScroll: true });
    };
  }

  // Rows and cards that act like buttons (tabindex + data-act): Enter or Space runs their action.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target;
    if (!el.matches?.('[data-act][tabindex]') || el.matches('button, a, input, select, textarea, summary')) return;
    e.preventDefault();
    el.click();
  });

  return { keep };
})();
