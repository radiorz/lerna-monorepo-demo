const root = './packages/'
const from = {
  pattern: "**/*",
  opts: {
    ignore: [
      // 全局
      "**/packages/!(temp)/**/*",
      "**/node_modules/**",
      "**/deploy/**",
      "**/docs/**",
      "**/temp/**",
      "**/test/**",
    ],
  },
};

const bytenodeOpts = {
  pattern: "**/*.@(js)",
  opts: {
    ignore: [
      "**/config/**",
      "**/node_modules/**",
      ...from.opts.ignore,
    ],
  },
  to: "./deploy/bytenode",
};

const obfuscateOpts = {
  pattern: "**/*.@(js)",
  opts: { ignore: ["**/config/**", "**/node_modules/**", ...from.opts.ignore] },
  to: "./deploy/obfuscated",
};

module.exports = {
  project: "temp",
  name: "temp",
  from,
  bytenodeOpts,
  obfuscateOpts,
};
