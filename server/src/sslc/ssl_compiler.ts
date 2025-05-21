import path = require("node:path");
import { conlog } from "../common";
import { connection } from "../server";
import Module from "./sslc.mjs";
import WasmBinary from "./sslc.wasm";

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
                stdout = stdout + text + "\n";
            },
            printErr: (text: string) => {
                stderr = stderr + text + "\n";
            },
            wasmBinary: WasmBinary,
            locateFile: (path: string) => {
                return path;
            },
            noInitialRun: true,
        });

        instance.FS.mkdir("/host");

        const cwd = path.parse(opts.cwd);

        // conlog(`Mounting ${cwd.root} into /host`);
        instance.FS.mount(
            // Using NODEFS instead of NODERAWFS because
            // NODERAWFS caused errors when the same module
            // runs the second time
            instance.NODEFS,
            {
                root: cwd.root,
            },
            "/host",
        );
        // conlog(`Chdir into ${path.join(cwd.root, "host", cwd.dir, cwd.name)}`);
        instance.FS.chdir(path.join(cwd.root, "host", cwd.dir, cwd.name));

        // Sanity check that file exists because by default
        // sslc will emit a warning instead of error
        // conlog("Doing stat on " + opts.inputFileName);
        instance.FS.stat(opts.inputFileName);

        let cmdArgs = opts.options
            .split(" ")
            .map((s) => s.trim())
            .filter((s) => s);

        if (opts.headersDir) {
            if (cmdArgs.find((s) => s.startsWith("-I"))) {
                if (opts.interactive) {
                    connection.window.showWarningMessage(
                        "Warning: -I switch is used but it will be ignored",
                    );
                }
                cmdArgs = cmdArgs.filter((s) => !s.startsWith("-I"));
            }

            const headersDir = path.parse(opts.headersDir);

            cmdArgs.push(
                "-I" + path.join(headersDir.root, "/host", headersDir.dir, headersDir.name),
            );
        }

        cmdArgs.push(opts.inputFileName, "-o", opts.outputFileName);

        conlog(
            "ssl_compile:\n" +
                JSON.stringify(
                    {
                        opts,
                        cmdArgs,
                    },
                    null,
                    2,
                ),
        );

        const returnCode = instance.callMain(cmdArgs);

        if (stderr) {
            conlog("===== stderr =====\n" + stderr);
        }
        if (stdout) {
            conlog("===== stdout =====\n" + stdout);
        }
        conlog(`===== returnCode: ${returnCode} =====`);
        conlog("===== instance memory is " + instance.memory.buffer.byteLength + " bytes =====");

        instance.FS.chdir("/");
        instance.FS.unmount("/host");

        return {
            returnCode,
            stdout,
            stderr,
        };
    } catch (e: any) {
        conlog(`${e.name} ${e.message}`);
        conlog(`${e.stack}`);
        return {
            returnCode: 1,
            stdout: "",
            stderr: `Failed to run sslc: ${e}`,
        };
    }
}
