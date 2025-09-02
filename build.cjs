//https://github.com/cloudflare/workers-sdk/blob/main/packages/wrangler/src/deployment-bundle/bundle.ts
const path = require("path");
const { NodeGlobalsPolyfillPlugin } = require("@esbuild-plugins/node-globals-polyfill");
const { NodeModulesPolyfillPlugin } = require("@esbuild-plugins/node-modules-polyfill");
const esbuild = require("esbuild");

var nodejsCompatPlugin = /* @__PURE__ */ silenceWarnings => ({
  name: "nodejs_compat imports plugin",
  setup(pluginBuild) {
    const seen = /* @__PURE__ */ new Set();
    const warnedPackaged = /* @__PURE__ */ new Map();
    pluginBuild.onStart(() => {
      seen.clear();
      warnedPackaged.clear();
    });
    pluginBuild.onResolve({ filter: /node:.*/ }, async ({ path: path67, kind, resolveDir, ...opts }) => {
      const specifier = `${path67}:${kind}:${resolveDir}:${opts.importer}`;
      if (seen.has(specifier)) {
        return;
      }
      seen.add(specifier);
      const result = await pluginBuild.resolve(path67, {
        kind,
        resolveDir,
        importer: opts.importer,
      });
      if (result.errors.length > 0) {
        let pathWarnedPackaged = warnedPackaged.get(path67);
        if (pathWarnedPackaged === void 0) {
          warnedPackaged.set(path67, (pathWarnedPackaged = []));
        }
        pathWarnedPackaged.push(opts.importer);
        return { external: true };
      }
      return result;
    });
    pluginBuild.onEnd(() => {
      if (!silenceWarnings) {
        warnedPackaged.forEach((importers, path67) => {
          console.warn(
            `The package "${path67}" wasn't found on the file system but is built into node.
Your Worker may throw errors at runtime unless you enable the "nodejs_compat" compatibility flag. Refer to https://developers.cloudflare.com/workers/runtime-apis/nodejs/ for more details. Imported from:
${importers.map(i => ` - ${path.relative(pluginBuild.initialOptions.absWorkingDir ?? "/", i)}`).join("\n")}`
          );
        });
      }
    });
  },
});

var cloudflareInternalPlugin = {
  name: "Cloudflare internal imports plugin",
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^cloudflare:.*/ }, () => {
      return { external: true };
    });
  },
};

var args = process.argv.slice(2);
const opt = {
  entry: "src/_worker.js",
  workingDir: ".",
  outdir: "dist",
  nodeCompat: false,
};
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case "--entry":
      opt.entry = args[++i];
      break;
    case "--out-dir":
      opt.entry = args[++i];
      break;
    case "--working-dir":
      opt.workingDir = args[++i];
      break;
    case "--node-compat":
      opt.nodeCompat = true;
      break;
  }
}

const buildOptions = {
  bundle: true,
  entryPoints: [path.resolve(__dirname, opt.entry)],
  absWorkingDir: path.resolve(__dirname, opt.workingDir),
  outdir: opt.outdir,
  external: ["__STATIC_CONTENT_MANIFEST"],
  format: "esm",
  target: "es2022",
  // sourcemap: true,
  sourceRoot: opt.outdir,
  minify: undefined,
  metafile: true,
  conditions: ["workerd", "worker", "browser"],
  define: {
    "navigator.userAgent": '"Cloudflare-Workers"',
    "process.env.NODE_ENV": '"undefined"',
    global: "globalThis",
  },
  loader: { ".js": "jsx", ".mjs": "jsx", ".cjs": "jsx" },
  plugins: [...(opt.nodeCompat ? [NodeGlobalsPolyfillPlugin({ buffer: true }), NodeModulesPolyfillPlugin(), nodejsCompatPlugin(false)] : []), cloudflareInternalPlugin],
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
  logLevel: "silent",
  legalComments: "none",
};

esbuild.build(buildOptions).then(console.log);
