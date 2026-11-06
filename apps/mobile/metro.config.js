const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

// SDK 52+ handles monorepo resolution automatically; NativeWind is the only addition.
const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './src/global.css' });
