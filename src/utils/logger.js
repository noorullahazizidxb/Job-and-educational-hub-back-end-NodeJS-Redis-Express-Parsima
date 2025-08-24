export function timestamp() {
  return new Date().toISOString();
}

export function info(...args) {
  console.log('[INFO]', timestamp(), ...args);
}

export function warn(...args) {
  console.warn('[WARN]', timestamp(), ...args);
}

export function error(...args) {
  console.error('[ERROR]', timestamp(), ...args);
}

export default { info, warn, error };
