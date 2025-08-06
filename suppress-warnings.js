// Suppress deprecation warnings from Google Maps services before any imports
const originalEmitWarning = process.emitWarning;

process.emitWarning = function(warning, ...args) {
  // Check if it's the url.parse() deprecation warning
  const isUrlParseWarning = 
    (typeof warning === 'string' && warning.includes('url.parse()')) ||
    (warning && typeof warning === 'object' && warning.message && warning.message.includes('url.parse()'));
  
  if (isUrlParseWarning) {
    return; // Suppress url.parse() warnings
  }
  
  // Call original function for other warnings
  return originalEmitWarning.call(this, warning, ...args);
};

// Export for use in other modules
module.exports = { suppressWarnings: true };
