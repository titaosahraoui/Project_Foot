// Metro config for use inside the pnpm monorepo.
// Lets Metro resolve the workspace packages (@footconnect/*) from the repo root.
// See: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// NOTE: pnpm uses isolated, symlinked node_modules, so Metro must keep
// hierarchical lookup enabled to resolve a package's nested dependencies
// (e.g. expo -> expo-modules-core). Do NOT set disableHierarchicalLookup here.

module.exports = config;
