// CommonJS on purpose: package.json has no "type": "module", and Next's
// postcss-loader requires a `plugins` key from a CJS-compatible file.
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
