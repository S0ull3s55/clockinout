const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure proper resolver configuration for Expo Router
config.resolver.platforms = ['native', 'web', 'ios', 'android'];

// Add support for additional file extensions
config.resolver.sourceExts.push('sql', 'db');

// Ensure proper handling of symlinks and node_modules
config.resolver.unstable_enableSymlinks = true;

// Configure transformer for better compatibility
config.transformer.minifierConfig = {
  keep_fnames: true,
  mangle: {
    keep_fnames: true,
  },
};

module.exports = config;