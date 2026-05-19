import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const isLinux = process.platform === 'linux';
if (!isLinux) {
  process.exit(0);
}

const nativeModulePath = path.resolve(
  process.cwd(),
  'release/app/node_modules/better-sqlite3/build/Release/better_sqlite3.node',
);

const ELF_MAGIC = Buffer.from([0x7f, 0x45, 0x4c, 0x46]);

const isElfBinary = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const fd = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(4);
    fs.readSync(fd, header, 0, 4, 0);
    return header.equals(ELF_MAGIC);
  } finally {
    fs.closeSync(fd);
  }
};

if (isElfBinary(nativeModulePath)) {
  console.log(
    '[native-guard] better-sqlite3 already matches Linux (ELF). Skipping rebuild.',
  );
  process.exit(0);
}

console.log(
  '[native-guard] Incompatible or missing better-sqlite3 binary detected. Rebuilding...',
);

const rebuildBin = path.resolve(process.cwd(), 'node_modules/.bin/electron-rebuild');
const rebuild = spawnSync(
  rebuildBin,
  ['-f', '-w', 'better-sqlite3', '--module-dir', 'release/app'],
  { stdio: 'inherit' },
);

if (rebuild.error) {
  throw rebuild.error;
}

if (typeof rebuild.status === 'number' && rebuild.status !== 0) {
  throw new Error(
    `[native-guard] electron-rebuild failed with exit code ${rebuild.status}`,
  );
}

if (!isElfBinary(nativeModulePath)) {
  throw new Error(
    '[native-guard] Rebuild completed but better-sqlite3 is still not a Linux ELF binary.',
  );
}

console.log('[native-guard] better-sqlite3 rebuild complete.');
