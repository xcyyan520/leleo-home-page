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

   ONLY THE project02 DECK OFFERS THE OPT-IN. That deck is a wall of tables and
   courseware that people read for a long time, so a paper mode genuinely helps
   there; the homepage and 思绪 are the starry night itself, and repainting them
   on paper loses the whole point of them. The stored choice is therefore
   IGNORED outside /project02/ rather than cleared, so someone who reads the
   deck in light mode still finds the homepage dark and their preference intact
   when they walk back into the deck.

   Scope is decided by the PATH, not by an attribute on each page, because the
   deck is generated from an external folder and re-synced wholesale — an
   attribute would be silently wiped by the next sync, and the deck would lose
   its light mode with no visible cause.
   ============================================================================ */
(function () {
  'use strict'

  var KEY = 'xcyyan-theme'
  var root = document.documentElement
  var subs = []

  /* /project02 and /project02/... — both spellings reach the deck. */
  var SWITCHABLE = /^\/project02(\/|$)/.test(window.location.pathname)

  function read() {
    try {
      var v = localStorage.getItem(KEY)
      return v === 'light' || v === 'dark' ? v : null
    } catch (e) {
      /* private mode / storage disabled: fall through to the default */
      return null
    }
  }

  /* Outside the deck the answer is always dark — see the header. The stored
     value is deliberately NOT cleared, so walking back into the deck restores
     whatever the visitor picked there. */
  var mode = (SWITCHABLE && read()) || 'dark'

  /** Paint the attribute plus everything that has to follow it by hand. */
  function paint(next) {
    root.setAttribute('data-theme', next)
    // Native widgets — scrollbars, form controls, date pickers — follow
    // color-scheme, not our CSS. Without this the light theme still shows a
    // dark scrollbar in Chrome.
    root.style.colorScheme = next
    paintMeta(next)
  }

  /* The deck puts this script BEFORE the theme-color meta (it must be the first
     thing in <head> so the first frame is already right), so on the first call
     the meta often does not exist yet and the phone's browser chrome would stay
     dark above a paper page. Wait for it once instead of dropping the update. */
  var metaPending = false
  function paintMeta(next) {
    var meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      meta.setAttribute('content', next === 'light' ? '#f2ede3' : '#07060f')
      return
    }
    if (metaPending) return
    metaPending = true
    document.addEventListener('DOMContentLoaded', function () {
      metaPending = false
      var m = document.querySelector('meta[name="theme-color"]')
      if (m) m.setAttribute('content', mode === 'light' ? '#f2ede3' : '#07060f')
    }, { once: true })
  }

  paint(mode)

  window.XTheme = {
    get mode() {
      return mode
    },
    /** False on the pages that are always night; the UI hides the button. */
    get switchable() {
      return SWITCHABLE
    },
    set: function (next, remember) {
      if (next !== 'light' && next !== 'dark') return mode
      // Pages that are always night refuse the change instead of accepting it
      // and being repainted on the next navigation.
      if (!SWITCHABLE) return mode
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

  // Another tab (or the same tab, before a reload) changed the choice. Ignored
  // here on the always-night pages, for the same reason set() refuses.
  window.addEventListener('storage', function (e) {
    if (e.key !== KEY || !SWITCHABLE) return
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
