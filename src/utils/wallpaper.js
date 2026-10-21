/* ============================================================================
   wallpaper.js — pick the right file for the device.

   Every wallpaper in this repo ships as a full-size PNG (up to 4096x3070,
   ~690 KB) next to WebP derivatives generated from it. The PNG is the master
   and stays in git; the WebP is what actually gets painted.

   Two derivatives exist per DESKTOP wallpaper, and the difference is not just
   size — it is the crop:

     image.webp    landscape, <=1920 wide. For `background-size: cover` on a
                   wide viewport, which scales by width.
     image-m.webp  the centre portrait strip pre-cropped out of the same
                   master. A portrait phone under `cover` scales by HEIGHT and
                   throws away the sides anyway; shipping it the landscape file
                   means it downloads ~690 KB to show a ~35% slice, upscaled.

   Phone-native wallpapers (`static-mobile/…`) are already portrait and only
   need downscaling, so they have a single `image.webp`.

   Anything that is not one of our own `/img/wallpaper/.../image.png` paths is
   returned untouched — the wallpaper box also accepts arbitrary URLs and
   wallpaper APIs, and those must never be rewritten.
   ============================================================================ */

/** How long the loading overlay may wait for the wallpaper before giving up. */
export const WALLPAPER_WAIT_MS = 600

const OWN = /^\/img\/wallpaper\/(static|static-mobile)\/[^/]+\/image-?\.png$/

/**
 * @param {string} url   the URL exactly as stored in config / the wallpaper cookie
 * @param {'pc'|'mobile'} device
 * @returns {string} what to actually request
 */
export function wallpaperUrl(url, device) {
  if (typeof url !== 'string' || !OWN.test(url)) return url
  const base = url.replace(/image-?\.png$/, '')
  return device === 'mobile' && url.startsWith('/img/wallpaper/static/')
    ? `${base}image-m.webp`
    : `${base}image.webp`
}
