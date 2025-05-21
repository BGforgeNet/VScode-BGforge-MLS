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

        instance.FS.chdir(opts.cwd);

        // Sanity check that file exists because by default
        // sslc will emit a warning instead of error
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

            cmdArgs.push(`-I${opts.headersDir}`);
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

        conlog(
            "ssl_compile done\n" +
                JSON.stringify(
                    {
                        returnCode,
                        stdout,
                        stderr,
                    },
                    null,
                    2,
                ),
        );
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
