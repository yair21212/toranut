// Base path of the site. Vercel serves from the root (default "");
// GitHub Pages builds set EXPO_BASE_URL=/toranut.
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...(config.experiments || {}), baseUrl: process.env.EXPO_BASE_URL || '' },
});
