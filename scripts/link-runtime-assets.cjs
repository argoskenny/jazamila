const fs = require("node:fs");
const path = require("node:path");

const RUNTIME_ASSET_DIRECTORIES = ["pics", "post", "tmp"];

function copyMissing(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyMissing(sourcePath, targetPath);
    } else if (!fs.existsSync(targetPath)) {
      fs.copyFileSync(sourcePath, targetPath, fs.constants.COPYFILE_EXCL);
    }
  }
}

function linkRuntimeAssets({ releaseRoot = process.cwd(), sharedAssetsRoot }) {
  if (!sharedAssetsRoot) throw new Error("shared assets path is required");
  const release = path.resolve(releaseRoot);
  const shared = path.resolve(sharedAssetsRoot);
  if (shared.startsWith(`${release}${path.sep}`)) {
    throw new Error("shared assets must be outside the release directory");
  }

  const assetsRoot = path.join(release, "public", "assets");
  const originalsRoot = path.join(release, ".runtime-asset-originals");
  fs.mkdirSync(originalsRoot, { recursive: true });

  const linked = [];
  for (const directory of RUNTIME_ASSET_DIRECTORIES) {
    const source = path.join(assetsRoot, directory);
    const target = path.join(shared, directory);
    fs.mkdirSync(target, { recursive: true });

    if (fs.existsSync(source) && fs.lstatSync(source).isSymbolicLink()) {
      if (fs.realpathSync(source) !== fs.realpathSync(target)) {
        throw new Error(`${source} points to the wrong shared directory`);
      }
      linked.push({ directory, target });
      continue;
    }

    if (fs.existsSync(source)) {
      if (!fs.lstatSync(source).isDirectory()) throw new Error(`${source} is not a directory`);
      copyMissing(source, target);
      const backup = path.join(originalsRoot, directory);
      if (fs.existsSync(backup)) throw new Error(`release asset backup already exists: ${backup}`);
      fs.renameSync(source, backup);
      try {
        fs.symlinkSync(target, source, "dir");
      } catch (error) {
        fs.renameSync(backup, source);
        throw error;
      }
    } else {
      fs.symlinkSync(target, source, "dir");
    }

    if (fs.realpathSync(source) !== fs.realpathSync(target)) {
      throw new Error(`${source} link verification failed`);
    }
    linked.push({ directory, target });
  }

  return linked;
}

if (require.main === module) {
  const sharedAssetsRoot = process.argv[2];
  const linked = linkRuntimeAssets({ sharedAssetsRoot });
  console.log(JSON.stringify(linked, null, 2));
}

module.exports = { RUNTIME_ASSET_DIRECTORIES, linkRuntimeAssets };
