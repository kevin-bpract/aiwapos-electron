
import fs from 'fs';
import path from 'path';

const rootPackagePath = path.join(__dirname, '../../package.json');
const appPackagePath = path.join(__dirname, '../../release/app/package.json');

if (!fs.existsSync(rootPackagePath)) {
    console.error(`Root package.json not found at ${rootPackagePath}`);
    process.exit(1);
}

if (!fs.existsSync(appPackagePath)) {
    console.error(`App package.json not found at ${appPackagePath}`);
    process.exit(1);
}

const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, 'utf-8'));
const appPackage = JSON.parse(fs.readFileSync(appPackagePath, 'utf-8'));

const oldVersion = appPackage.version;
const newVersion = rootPackage.version;

if (oldVersion !== newVersion) {
    appPackage.version = newVersion;
    fs.writeFileSync(appPackagePath, JSON.stringify(appPackage, null, 2));
    console.log(`Synced version from root (${newVersion}) to release/app/package.json (was ${oldVersion})`);
} else {
    console.log(`Versions already match (${newVersion})`);
}
