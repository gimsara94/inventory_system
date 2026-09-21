import { InputError } from '../utils/validation.js';

export function protectOrigin(expectedOrigin) {
  return (req, _res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('sec-fetch-site') === 'cross-site') {
      return next(new InputError('Cross-site requests are not allowed.', 403));
    }
    const origin = req.get('origin');
    if (origin && origin !== expectedOrigin) return next(new InputError('Origin is not allowed.', 403));
    next();
  };
}
