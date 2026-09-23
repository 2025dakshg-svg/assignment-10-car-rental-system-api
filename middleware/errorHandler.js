// Centralized error handler - every thrown/next(err) lands here
const errorHandler = (err, req, res, next) => {
  console.error(`${req.method} ${req.originalUrl} -> ${err.message}`);

  const status = err.status || 500;
  const message = status === 500 ? "Internal Server Error" : err.message;

  if (status === 500) {
    console.error(err.stack);
  }

  return res.status(status).json({
    success: false,
    message,
  });
};

// 404 handler for unknown routes
const notFound = (req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

module.exports = { errorHandler, notFound };