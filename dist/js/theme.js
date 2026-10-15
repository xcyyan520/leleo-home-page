/* ============================================================================
   theme.js — the light/dark switch, shared by every page.

   Loaded as a CLASSIC (non-module) script in <head>, because modules are
   deferred: by the time a module ran, the browser would already have painted
   the dark page and the switch to light would show as a flash. A classic head
   script runs before first paint, so the page's very first frame is already
   the right colour.

   The whole mechanism is one attribute on <html>: data-theme="light|dark".
   Every light-mode rule in theme-light.css is prefixed with
   html[data-theme="light"], so the attribute alone flips the entire site.

   Dark is the DEFAULT — the Star Desk at night is what this site *is*, and a
   visitor whose laptop happens to be in light mode should still meet the
   design as intended. Light is an opt-in the button turns on, and once chosen
   it is remembered for that browser.
   ============================================================================ */
(function () {
  'use strict'

  var KEY = 'xcyyan-theme'
  var root = document.documentElement
  var subs = []

  function read() {
    try {
      var v = localStorage.getItem(KEY)
      return v === 'light' || v === 'dark' ? v : null
    } catch (e) {
      /* private mode / storage disabled: fall through to the default */
      return null
    }
  }

  var mode = read() || 'dark'

  /** Paint the attribute plus everything that has to follow it by hand. */
  function paint(next) {
    root.setAttribute('data-theme', next)
    // Native widgets — scrollbars, form controls, date pickers — follow
    // color-scheme, not our CSS. Without this the light theme still shows a
    // dark scrollbar in Chrome.
    root.style.colorScheme = next
    var meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', next === 'light' ? '#f2ede3' : '#07060f')
  }

  paint(mode)

  window.XTheme = {
    get mode() {
      return mode
    },
    set: function (next, remember) {
      if (next !== 'light' && next !== 'dark') return mode
      if (next === mode) return mode
      var from = mode
      mode = next
      if (remember !== false) {
        try {
          localStorage.setItem(KEY, mode)
        } catch (e) { /* nothing we can do; the choice just will not persist */ }
      }
      paint(mode)
      // Let Vue components re-render their icon without polling. Every listener
      // is guarded: one broken subscriber must not stop the others.
      for (var i = 0; i < subs.length; i++) {
        try {
          subs[i](mode, from)
        } catch (e) {
          console.error('[theme] listener failed', e)
        }
      }
      return mode
    },
    toggle: function () {
      return this.set(mode === 'light' ? 'dark' : 'light')
    },
    /** Returns an unsubscribe function, so components can clean up. */
    subscribe: function (fn) {
      subs.push(fn)
      return function () {
        var i = subs.indexOf(fn)
        if (i >= 0) subs.splice(i, 1)
      }
    },
  }

  // Another tab (or the same tab, before a reload) changed the choice.
  window.addEventListener('storage', function (e) {
    if (e.key !== KEY) return
    var v = e.newValue
    if ((v === 'light' || v === 'dark') && v !== mode) {
      mode = v
      paint(mode)
      for (var i = 0; i < subs.length; i++) {
        try { subs[i](mode) } catch (err) {}
      }
    }
  })
})()
