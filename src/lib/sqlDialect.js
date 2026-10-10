function provider() {
  return String(process.env.DB_PROVIDER || 'mysql').toLowerCase();
}

export function isPostgres() {
  const name = provider();
  return name === 'postgresql' || name === 'postgres';
}

export function quoteIdent(name) {
  return isPostgres() ? `"${name}"` : name;
}

export function sincePlaceholder() {
  return isPostgres() ? '$1' : '?';
}
