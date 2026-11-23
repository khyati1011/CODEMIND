const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    const err = new Error(`${fieldName} is required and must be a non-empty string.`);
    err.statusCode = 400;
    throw err;
  }
  return value.trim();
}

export function validateProjectId(id) {
  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    const err = new Error('Invalid project ID format.');
    err.statusCode = 400;
    throw err;
  }
  return id;
}
