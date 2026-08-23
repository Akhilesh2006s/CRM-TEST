const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Expo SDK 54 enables package exports by default; that can break CJS/ESM interop
// and surface as: TypeError: Class constructor invoked without new
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
