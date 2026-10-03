const path = require('node:path');

module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
            '@shared': path.resolve(__dirname, '../shared'),
          },
        },
      ],
    ],
  };
};
