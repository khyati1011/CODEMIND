export function errorHandler(err, _req, res, _next) {
  const status = err.statusCode || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  const message =
    err.code === 'LIMIT_FILE_SIZE'
      ? 'Uploaded file exceeds the maximum allowed size limit.'
      : err.message || 'Internal Server Error';

  if (status >= 500) {
    console.error('[API Error]', err);
  }

  res.status(status).json({ error: message });
}
