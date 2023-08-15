/* eslint-disable @typescript-eslint/no-var-requires */
//https://github.com/Felx-B/vscode-web/tree/main
const process = require("process");
const os = require("os");
const fs = require("fs");
const fse = require("fs-extra");
const path = require("path");
const child_process = require("child_process");
const ghpages = require('gh-pages');

(async function() {
    const vscodeVersion = "1.81.0";
    const vscodeDir = "vscode-source";
    const vscodeDistDir = "vscode-web-dist";
    const tempDir = os.tmpdir();

    const rootDir = __dirname;
    const fullVSCodeDir = path.resolve(tempDir, vscodeDir);

    try {
        await fs.promises.stat(fullVSCodeDir);
        console.log(`Found directory ${fullVSCodeDir}`);
    } catch (e) {
        console.log(`Could not find directory ${fullVSCodeDir}. Cloning`);
        child_process.execSync(`git clone --depth 1 https://github.com/microsoft/vscode.git -b ${vscodeVersion} ${fullVSCodeDir}`, {
            stdio: "inherit",
        });
    }

    process.chdir(fullVSCodeDir);

    const yarnPath = path.resolve(rootDir, "..", "node_modules", "yarn", "bin", "yarn.js");
    process.env.npm_execpath = yarnPath;

    try {
        await fs.promises.stat("node_modules");
        console.log("Found node_modules");
    } catch (e) {
        console.log("Installing node_modules");
        child_process.execSync(`${yarnPath} --cwd ${fullVSCodeDir}`, { stdio: "inherit" });
    }

    fs.promises.copyFile(path.resolve(rootDir, "workbench.ts"), path.resolve(fullVSCodeDir, "src", "vs", "code", "browser", "workbench", "workbench.ts"));

    child_process.execSync(`${yarnPath} --cwd ${fullVSCodeDir} gulp vscode-web-min`, { stdio: "inherit" });
    const fullVSCodeDistDir = path.resolve(rootDir, vscodeDistDir);

    try {
        await fs.promises.stat(fullVSCodeDistDir);
        console.log(`Found directory ${fullVSCodeDistDir}; deleting`);
        await fs.promises.rm(fullVSCodeDistDir, { recursive: true });
    } catch (e) {
        console.log(`Could not find directory ${fullVSCodeDistDir}. Creating.`);
    }

    await fs.promises.mkdir(fullVSCodeDistDir);
    await fse.copy(path.resolve(tempDir, "vscode-web"), fullVSCodeDistDir);

    const extensionDir = path.resolve(rootDir, "..");
    const extensionDestDir = path.resolve(rootDir, "gamma");
    const extensionDestDistDir = path.resolve(extensionDestDir, "dist");
    process.chdir(extensionDir);
    child_process.execSync(`npm run compile`, { stdio: "inherit" });
    try {
        await fs.promises.stat(extensionDestDir);
        console.log(`Found directory ${extensionDestDir}; deleting`);
        await fs.promises.rm(extensionDestDir, { recursive: true });
    } catch (e) {
        console.log(`Could not find directory ${extensionDestDir}. Creating.`);
    }
    await fs.promises.mkdir(extensionDestDistDir, { recursive: true });
    await fse.copy(path.resolve(extensionDir, "dist"), extensionDestDistDir);
    await fse.copy(path.resolve(extensionDir, "package.json"), path.resolve(extensionDestDir, "package.json"));
    await fse.copy(path.resolve(extensionDir, "CNAME"), path.resolve(rootDir, "CNAME"));

    const samplesDir = path.resolve(rootDir, "..", "samples");
    const samplesCombinedFile = readDirectoryRecursively(samplesDir);
    const samplesDestDir = path.resolve(rootDir, "gamma-samples-extension");
    await fs.promises.writeFile(path.resolve(samplesDestDir, "samples.json"), JSON.stringify(samplesCombinedFile, null, 4));


    process.chdir(samplesDestDir);

    child_process.execSync(`npm install .`, { stdio: "inherit" });
    child_process.execSync(`npm run compile`, { stdio: "inherit" });

    process.chdir(rootDir);

    await new Promise((resolve, reject) => {
        ghpages.publish(rootDir, {
            src: ['**/*', '.nojekyll'],
            remove: ['.', 'gamma-samples-extension/ndoe_modules']
        }, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
})().then(() => {
    console.log("Done");
}, (err) => {
    console.error(err);
});

function readDirectoryRecursively(dir, extension=".dpage") {
    const result = {};

    for (const item of fs.readdirSync(dir)) {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
            result[item] = readDirectoryRecursively(itemPath, extension);
        } else if (path.extname(itemPath) === extension) {
            const fileContent = fs.readFileSync(itemPath, 'utf-8');
            try {
                const parsed = JSON.parse(fileContent); // Parse and dump to remove spaces
                result[path.basename(item)] = JSON.stringify(parsed);
            } catch(err) {
                console.error(`Failed to parse JSON in file: ${itemPath}`);
            }
        }
    }

    return result;
}
