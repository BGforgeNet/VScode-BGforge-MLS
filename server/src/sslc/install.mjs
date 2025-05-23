import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import crypto from "crypto";
import { execSync } from "child_process";

const URL =
    "https://github.com/roginvs/sslc/releases/download/2025-05-21-18-34-28/wasm-emscripten-node-nodefs.tar.gz";
const HASH = "e8a58e4204bc45850530b9b93e60dc8829aff04ab66dd974a26b33769913eaed";

async function downloadFile(url, dest) {
    const data = await fetch(url).then((res) => res.arrayBuffer());
    fs.writeFileSync(dest, Buffer.from(data));
}

function computeSha256(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash("sha256");
        const stream = fs.createReadStream(filePath);
        stream.on("error", reject);
        stream.on("data", (chunk) => hash.update(chunk));
        stream.on("end", () => resolve(hash.digest("hex")));
    });
}

function extractFile(fileName, extractDir) {
    execSync(`tar -xzf ${fileName} -C ${extractDir}`, { stdio: "inherit" });
}

function patchSslc(dirName) {
    // Patch the sslc.mjs file to replace import.meta.url with __filename
    // This is a workaround for the issue with Node.js and ESM

    const sslcFileName = path.join(dirName, "sslc.mjs");
    const sslcContent = fs.readFileSync(sslcFileName, "utf8");
    const patchedSslc = sslcContent.split("import.meta.url").join("__filename");
    fs.writeFileSync(sslcFileName, patchedSslc);
}

async function main() {
    console.info("Installing sslc...");

    const scriptDirName = path.dirname(fileURLToPath(import.meta.url));

    console.info("Downloading sslc...");
    const tmpFileName = path.join(scriptDirName, ".tmp.tar.gz");
    await downloadFile(URL, tmpFileName);

    console.info("Verifying sslc...");
    const hash = await computeSha256(tmpFileName);
    if (hash !== HASH) {
        throw new Error(`Hash mismatch, expected ${HASH}, got ${hash}`);
    }

    console.info("Extracting sslc...");
    extractFile(tmpFileName, scriptDirName);
    fs.rmSync(tmpFileName);

    console.info("Patching sslc...");
    patchSslc(scriptDirName);

    console.info("sslc installed successfully.");
}

main().catch((e) => {
    console.error("Error:", e.name, e.message, e.stack);
    process.exit(1);
});
