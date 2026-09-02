module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { reanimated: true }]],
    plugins: [
      // Lets Drizzle migrations be imported as raw SQL strings:
      //   import m from './migrations/0000_init.sql';
      ['inline-import', { extensions: ['.sql'] }],
    ],
  };
};
