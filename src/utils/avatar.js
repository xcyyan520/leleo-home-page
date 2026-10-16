// avatar.js — the one avatar the homepage shows.
//
// Shape of the problem: the avatar is chosen by the owner (crop + upload) but
// displayed to every visitor, so it cannot live in a cookie — a cookie would
// only change the owner's own browser. It is stored server-side in D1 and read
// by everyone.
//
// That read is a network round trip, and the homepage already renders before it
// answers, so the last known value is cached in localStorage and painted
// immediately. Without the cache every reload would flash the bundled default
// avatar for as long as the request took.

const CACHE_KEY = 'xcyyan-avatar'
// Matches the server's ceiling. A 320x320 JPEG lands near 30 KB, so this only
// trips on something that went wrong during the crop.
const MAX_CHARS = 400000

const listeners = new Set()
let current = null
// Whether this browser may replace the avatar. The server decides (it checks the
// owner cookie), so this only drives whether the edit affordance is shown at
// all — a visitor should not be offered a button that always 401s.
let canEdit = false
let loaded = false
let pending = null

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw && raw.length <= MAX_CHARS && /^data:image\//.test(raw)) return raw
  } catch { /* private mode, quota — the default avatar still works */ }
  return null
}

function writeCache(value) {
  try {
    if (value) localStorage.setItem(CACHE_KEY, value)
    else localStorage.removeItem(CACHE_KEY)
  } catch { /* quota or private mode: this session just won't be instant */ }
}

function emit() {
  for (const fn of listeners) {
    try { fn(current) } catch { /* a broken subscriber must not stop the rest */ }
  }
}

/**
 * Fetch the stored avatar once per page load.
 * Never rejects: a visitor who cannot reach the API should still see the site,
 * only with the bundled default face.
 */
export function loadAvatar() {
  if (pending) return pending
  pending = (async () => {
    try {
      const res = await fetch('/api/avatar', { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error('bad status')
      const data = await res.json()
      const next = data && typeof data.avatar === 'string' ? data.avatar : null
      current = next
      canEdit = !!(data && data.owner)
      writeCache(next)
    } catch {
      // Offline, or the function is not deployed: whatever was cached last time
      // is still a better guess than the bundled default.
      current = readCache()
    }
    loaded = true
    emit()
    return current
  })()
  return pending
}

/** The value to paint right now, before any request has finished. */
export function cachedAvatar() {
  if (current) return current
  return readCache()
}

export function hasLoaded() { return loaded }

/** Whether the edit affordance should be offered in this browser. */
export function canEditAvatar() { return canEdit }

/** Owner only. Rejects with a readable message on failure. */
export async function setAvatar(dataUri) {
  if (typeof dataUri !== 'string' || !/^data:image\//.test(dataUri)) {
    throw new Error('图片格式不对')
  }
  const res = await fetch('/api/avatar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatar: dataUri }),
  })
  if (res.status === 401) throw new Error('只有站长能换头像')
  if (!res.ok) throw new Error('保存失败')
  current = dataUri
  writeCache(dataUri)
  emit()
  return current
}

/** Owner only: drop the custom avatar and go back to the bundled one. */
export async function clearAvatar() {
  const res = await fetch('/api/avatar', { method: 'DELETE' })
  if (res.status === 401) throw new Error('只有站长能换头像')
  if (!res.ok) throw new Error('删除失败')
  current = null
  writeCache(null)
  emit()
  return null
}

/**
 * Subscribe to changes. Returns an unsubscribe function, so it can be used
 * directly as the return value of a Vue `mounted`/`beforeUnmount` pair.
 */
export function onAvatarChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
