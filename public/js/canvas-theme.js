/* ============================================================================
   canvas-theme.js — light mode for the canvas-first project02 pages.

   WHY THIS EXISTS
   Six of the eleven project02 pages (原型/0-4 and 架构/1) paint their entire
   surface into a 2D context with literal colours — e.g.
       原型/4: ctx.fillStyle='#0a0a1a'; ctx.fillRect(0,0,DW,DH)
   A stylesheet cannot reach a single one of those pixels. Rewriting ~378 call
   sites across six files by hand would be unmaintainable and would rot the
   moment a page is regenerated from its source folder.

   THE TECHNIQUE
   Intercept at the Canvas2D API boundary instead. Every colour those pages use
   arrives through exactly four doors:
       ctx.fillStyle = …
       ctx.strokeStyle = …
       ctx.shadowColor = …
       gradient.addColorStop(t, …)
   Wrapping those four lets ONE shim recolour all six pages, with the pages'
   own code untouched. The pages redraw every frame, so a theme change needs no
   repaint call — the next frame simply comes out in the new palette.

   Loaded as a CLASSIC script in <head>, before the page's own script, so the
   wrappers are in place before the first draw.

   Kept intentionally narrow: it only rewrites colour STRINGS it recognises, and
   passes anything else (patterns, canvas gradients, 'transparent', CSS var
   strings) straight through untouched.
   ============================================================================ */
(function () {
  'use strict'

  /* ── the palette ──────────────────────────────────────────────────────────
     Dark project02 token -> its light counterpart. Ordered longest-first at
     build time so a 3-digit hex can never shadow a 6-digit one.

     Three groups, and the reasoning matters more than the values:

     1. GROUNDS. The near-blacks that paint the page. They become the same warm
        paper the rest of the site uses (#f2ede3 family), so a visitor moving
        between the homepage and the deck sees one surface, not two designs.
     2. TEXT. The deck's text is warm light-grey on near-black (#d8d2c8). Simply
        keeping it would be invisible on paper, so it inverts to warm ink. The
        alphas are lifted because the deck's dim tones (0.35-0.55) are already
        marginal on black and would be unreadable on paper.
     3. ACCENTS. 柔紫 #8b7aaa, 淡金 #c4a970, sage #7fa07a, periwinkle #7f8fb5,
        rose #b56a6a. These carry the deck's meaning (which layer is which), so
        each keeps its HUE and only darkens until it holds contrast on paper.
        Measured against #fffdf9: #8b7aaa 3.78 -> #6b5788 6.18 · #c4a970 2.23 ->
        #9a7c34 3.90 · #7fa07a 2.87 -> #527c4c 4.76 · #7f8fb5 3.18 -> #526694
        5.61 · #b56a6a 3.95 -> #8f4141 6.89. */
  var MAP = {
    /* ── 1. grounds ── */
    '#07060f': '#f2ede3',
    '#0a0a1a': '#f2ede3',
    '#0a0a1e': '#f5f1e8',
    '#08081a': '#f2ede3',
    '#0d0d2b': '#f8f5ee',
    '#0d0d24': '#f8f5ee',
    '#0d0d26': '#f8f5ee',
    '#111a24': '#f8f5ee',
    '#0b1017': '#f8f5ee',
    '#0d141c': '#f5f1e8',
    /* raised surfaces: cards, panels, wells */
    '#12102a': '#ffffff',
    '#171430': '#ffffff',
    '#141230': '#fbf9f4',
    '#1a1734': '#fbf9f4',
    '#191630': '#f8f5ee',
    '#1c1936': '#f6f2ea',
    '#17152e': '#fbf9f4',
    '#1f1c3a': '#f6f2ea',
    '#241f3f': '#f1ece2',
    /* lines and dividers */
    '#2a2740': '#ded7c9',
    '#262338': '#e2dbcd',
    '#302c48': '#d5cdbd',
    '#38334f': '#cfc6b5',
    '#3a3550': '#cfc6b5',
    /* ── 2. text ── */
    '#d8d2c8': '#3a3548',
    '#d4cee2': '#3a3548',
    '#ded8cf': '#2c2839',
    '#e8e2d8': '#241f2e',
    '#ece7f3': '#1a1726',
    '#8d8779': '#5b5468',
    '#8b8578': '#5b5468',
    '#a9a396': '#5b5468',
    '#a09a90': '#615a6c',
    '#9a948a': '#6b6478',
    '#8b9aa9': '#5b5468',
    '#6b6660': '#6b6478',
    '#5e5952': '#7a7386',
    '#7a7468': '#7a7386',
    '#4e4a63': '#7a7386',
    '#6b7c8f': '#5f6875',
    '#4a5a6b': '#5f6875',
    /* ── 3. accents ── */
    '#8b7aaa': '#6b5788',
    '#7a6b99': '#5f4a7d',
    '#a371f7': '#6b5788',
    '#a06bff': '#6b5788',
    '#c4a970': '#8f7229',
    '#ffb020': '#8f7229',
    '#e3b341': '#8f7229',
    '#b9a98f': '#7d6c4e',
    '#7fa07a': '#527c4c',
    '#37d67a': '#527c4c',
    '#3fb950': '#527c4c',
    '#7f8fb5': '#526694',
    '#4a90e2': '#526694',
    '#b56a6a': '#8f4141',
    '#ff4d5e': '#8f4141',
    '#f85149': '#8f4141',
    /* ── the starfield specks: dark-skin glitter, meaningless on paper ──
       Mapped to fully transparent. The deck's own star tiles are drawn with
       rgba(255,252,244,α); leaving them would dust the light pages with white
       dots that read as noise, exactly as on the homepage (see theme-light.css,
       where `.starfield-bg` is hidden for the same reason). */
    'rgba(255,252,244,0': 'rgba(255,252,244,0',
  }

  /* Alphas for the star specks are handled by the prefix rule above: every
     rgba(255,252,244,x) collapses to transparent. Everything else is matched
     exactly after normalisation. */
  var norm = function (s) {
    return String(s).toLowerCase().replace(/\s+/g, '').replace(/,\s*/g, ',')
  }

  var TABLE = {}
  for (var k in MAP) TABLE[norm(k)] = MAP[k]

  function isStarSpeck(t) {
    return t.indexOf('rgba(255,252,244') === 0
  }

  /* Fallback for the long tail (~168 JS-only tokens). Same logic as the CSS
     generator: a neutral that was light becomes ink, a neutral that was dark
     becomes a surface, and an accent darkens within its own hue. */
  var NEUTRAL_SPREAD = 26
  var INK = [44, 38, 32]

  function parse(tok) {
    tok = tok.trim()
    if (tok.charAt(0) === '#') {
      var h = tok.slice(1)
      if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2)
      if (h.length === 8) h = h.slice(0, 6)
      if (h.length !== 6) return null
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1]
    }
    var n = tok.match(/[\d.]+/g)
    if (!n || n.length < 3) return null
    return [+n[0], +n[1], +n[2], n.length > 3 ? +n[3] : 1]
  }

  function hex(r, g, b) {
    return '#' + [r, g, b].map(function (v) {
      return Math.round(v).toString(16).padStart(2, '0')
    }).join('')
  }

  var ACCENTS = [
    { lo: 248, hi: 305, to: [107, 87, 136] },
    { lo: 305, hi: 345, to: [143, 65, 100] },
    { lo: 345, hi: 361, to: [143, 65, 65] },
    { lo: 0, hi: 20, to: [143, 65, 65] },
    { lo: 20, hi: 65, to: [143, 106, 41] },
    { lo: 65, hi: 170, to: [82, 124, 76] },
    { lo: 170, hi: 250, to: [82, 102, 148] },
  ]

  function hueOf(r, g, b) {
    r /= 255; g /= 255; b /= 255
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
    if (!d) return 0
    var h
    if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (mx === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
    return h * 360
  }

  /** Map one colour string. Returns the input unchanged when it is not a
   *  colour we understand, so patterns / gradients / 'transparent' survive. */
  function map(tok) {
    if (typeof tok !== 'string' || !tok) return tok
    var t = tok.trim()
    var key = norm(t)
    if (TABLE[key] !== undefined) return TABLE[key]
    if (isStarSpeck(key)) return 'rgba(255,252,244,0)'
    var p = parse(t)
    if (!p) return tok
    var r = p[0], g = p[1], b = p[2], a = p[3]
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b)
    var lum = (r * 299 + g * 587 + b * 114) / 1000
    if (mx - mn <= NEUTRAL_SPREAD) {
      // a light neutral is text; a dark neutral is a surface
      if (lum > 150) return a >= 1 ? hex(INK[0], INK[1], INK[2]) : 'rgba(44,38,32,' + Math.min(0.97, 0.34 + 0.7 * a).toFixed(2) + ')'
      if (lum < 60) return a >= 1 ? '#f2ede3' : 'rgba(44,38,32,' + Math.min(0.14, Math.max(0.03, a * 2.1)).toFixed(3) + ')'
      return tok
    }
    var hue = hueOf(r, g, b)
    for (var i = 0; i < ACCENTS.length; i++) {
      var band = ACCENTS[i]
      if (hue >= band.lo && hue < band.hi) {
        return a >= 1 ? hex(band.to[0], band.to[1], band.to[2])
          : 'rgba(' + band.to.join(',') + ',' + a + ')'
      }
    }
    return tok
  }

  /* ── the four doors ───────────────────────────────────────────────────── */

  var on = function () {
    return document.documentElement.getAttribute('data-theme') === 'light'
  }

  try {
    var proto = CanvasRenderingContext2D.prototype

    var prop = function (name) {
      var desc = Object.getOwnPropertyDescriptor(proto, name)
      if (!desc || !desc.set) return
      Object.defineProperty(proto, name, {
        configurable: true,
        enumerable: desc.enumerable,
        get: desc.get,
        set: function (v) {
          desc.set.call(this, on() ? map(v) : v)
        },
      })
    }
    prop('fillStyle')
    prop('strokeStyle')
    prop('shadowColor')

    var addStop = CanvasGradient.prototype.addColorStop
    CanvasGradient.prototype.addColorStop = function (offset, color) {
      return addStop.call(this, offset, on() ? map(color) : color)
    }
  } catch (e) {
    /* A browser without these prototypes simply keeps the dark palette; the
       pages stay usable, which is the right failure mode for a cosmetic layer. */
    if (window.console) console.warn('[canvas-theme] not installed:', e)
  }

  /* Nothing needs repainting on a switch: every one of these pages redraws the
     whole canvas each frame, so the change lands on the next frame by itself. */
  window.CanvasTheme = { map: map, active: on }
})()
