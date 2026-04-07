module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '@': './App',
            '@screens': './App/screens',
            '@navigation': './App/navigation',
            '@components': './App/components',
            '@theme': './App/theme',
            '@services': './App/services',
          },
        },
      ],
    ],
  };
};
