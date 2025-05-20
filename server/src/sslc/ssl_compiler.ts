import { stdin } from "node:process";
import { conlog } from "../common";
import { connection } from "../server";
import Module from "./sslc.mjs";
import WasmBinary from "./sslc.wasm";

// Types are missing here
declare const WebAssembly: any;

export async function ssl_compile(opts: {
    cwd: string;
    inputFileName: string;
    outputFileName: string;
    options: string;
    headersDir: string;
    interactive: boolean;
}) {
    let stdout = "";
    let stderr = "";
    try {
        const instance = await Module({
            print: (text: string) => {
                stdout += text;
            },
            printErr: (text: string) => {
                stderr += text;
            },
            wasmBinary: WasmBinary,
            locateFile: (path: string) => {
                return path;
            },
            noInitialRun: true,
        });

        instance.FS.mkdir("/src");
        instance.FS.mkdir("/headers");

        instance.FS.mount(
            Module.NODEFS,
            {
                root: opts.cwd,
            },
            "/src",
        );
        instance.FS.chdir("/src");

        conlog(`DEV FILES: ${instance.FS.readdir(".").join(",")}`);

        const switches = opts.options
            .split(" ")
            .map((s) => s.trim())
            .filter((s) => s);

        if (opts.headersDir) {
            if (switches.find((s) => s.startsWith("-I"))) {
                if (opts.interactive) {
                    connection.window.showWarningMessage(
                        "Warning: -I switch is used, but headersDir is set. Ignoring headersDir",
                    );
                }
            } else {
                switches.push(`-I${opts.headersDir}`);
            }
        }

        const returnCode = instance.callMain([
            ...switches,
            opts.inputFileName,
            "-o",
            opts.outputFileName,
        ]);

        if (stderr) {
            conlog("stderr: " + stderr);
        }

        return {
            returnCode,
            stdin,
            stderr,
        };
    } catch (e: any) {
        if (opts.interactive) {
            connection.window.showErrorMessage(`Failed to run sslc: ${e}`);
        }
        conlog(`${e.name} ${e.message}`);
        conlog(`${e.stack}`);
        return null;
    }
}
