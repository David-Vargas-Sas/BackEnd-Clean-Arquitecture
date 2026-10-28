export function requireJson(req, res, next) {
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && !req.is('application/json')) {
    return res.status(415).json({
      error: {
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Envía el cuerpo con Content-Type: application/json.',
        requestId: req.requestId,
      },
    });
  }
  next();
}
