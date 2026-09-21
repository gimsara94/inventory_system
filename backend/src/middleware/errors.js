import { InputError } from '../utils/validation.js';

export function notFound(req, _res, next) {
  next(new InputError(`Route ${req.path} not found.`, 404));
}

export function handleError(error, _req, res, _next) {
  if (error instanceof InputError) {
    return res.status(error.status).json({ error: error.message });
  }
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ error: 'Send a valid JSON object.' });
  }
  if (error.code === '23505') {
    return res.status(409).json({ error: 'That email, item code, or request ID already exists.' });
  }
  if (error.code === '23503') {
    return res.status(409).json({ error: 'This record is still in use.' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request is too large.' });
  }
  console.error(error);
  return res.status(500).json({ error: 'Server error. Please retry or contact an administrator.' });
}
