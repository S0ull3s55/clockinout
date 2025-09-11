const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Ensure proper resolver configuration for Expo Router
config.resolver.platforms = ['native', 'web', 'ios', 'android'];

// Add resolver aliases to prevent React hook conflicts
config.resolver.alias = {
  'react': path.resolve(__dirname, 'node_modules/react'),
  'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
  'react-native': path.resolve(__dirname, 'node_modules/react-native'),
  'react-native-web': path.resolve(__dirname, 'node_modules/react-native-web'),
};

// Add support for additional file extensions
config.resolver.sourceExts.push('sql', 'db');

// Ensure proper handling of symlinks and node_modules
config.resolver.unstable_enableSymlinks = true;

module.exports = config;