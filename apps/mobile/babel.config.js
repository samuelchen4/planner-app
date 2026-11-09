module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    // PowerSync's watched queries use async iterators (with @azure/core-asynciterator-polyfill).
    plugins: ['@babel/plugin-transform-async-generator-functions'],
  };
};
