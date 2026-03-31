export function formatKey(k, KEY_DISPLAY) {
  return KEY_DISPLAY[k] ?? KEY_DISPLAY[k.toLowerCase()] ?? k;
}
