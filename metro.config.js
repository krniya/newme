// Learn more: https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Drizzle ships migrations as .sql files that are inlined at build time by
// babel-plugin-inline-import (see babel.config.js). Metro must treat them as
// source, not as an opaque asset.
config.resolver.sourceExts.push('sql');

module.exports = config;
