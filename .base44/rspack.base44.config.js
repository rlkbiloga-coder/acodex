// .base44/rspack.base44.config.js — wrapper do rspack para o preview Base44.
// Reaproveita o rspack.config.js do projeto sem alterá-lo e adiciona polling
// no watch (bind mounts do sandbox no disparam inotify de forma confivel).
// O poll s vale quando BASE44_PREVIEW_MODE === "1"; fora do sandbox o
// comportamento o original.

const base = require("../rspack.config.js");

module.exports = (env, options) => {
  const configs = base(env, options);
  if (process.env.BASE44_PREVIEW_MODE === "1") {
    for (const config of configs) {
      config.watchOptions = {
        ...(config.watchOptions || {}),
        aggregateTimeout: 300,
        poll: 500,
      };
    }
  }
  return configs;
};
