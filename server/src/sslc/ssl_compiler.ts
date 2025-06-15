import path = require("node:path");
import { conlog } from "../common";
import { connection } from "../server";
import { fork } from "child_process";

export async function ssl_compile(opts: {
    cwd: string;
    inputFileName: string;
    outputFileName: string;
    options: string;
    headersDir: string;
    interactive: boolean;
}) {
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

        cmdArgs.push("-I" + path.join(headersDir.root, headersDir.dir, headersDir.name));
    }

    cmdArgs.push(opts.inputFileName, "-o", opts.outputFileName);

    const p = fork(
        path.join(__dirname, "../node_modules/sslc-emscripten-noderawfs/compiler.mjs"),
        cmdArgs,
        {
            execArgv: [], // Disable Node.js flags like --inspect
            env: {},
            cwd: opts.cwd,
            silent: true,
        },
    );

    const stdout: string[] = [];
    const stderr: string[] = [];
    p.stdout?.on("data", (data) => {
        const text = data.toString();
        stdout.push(text);
    });

    p.stderr?.on("data", (data) => {
        const text = data.toString();
        stderr.push(text);
    });

    return new Promise<{
        returnCode: number;
        stdout: string;
        stderr: string;
    }>((resolve, reject) => {
        p.on("close", (code) => {
            conlog(
                `ssl_compile:\n` +
                    JSON.stringify(
                        {
                            opts,
                            cmdArgs,
                            returnCode: code,
                            stdout: stdout.join(""),
                            stderr: stderr.join(""),
                        },
                        null,
                        2,
                    ),
            );
            resolve({
                returnCode: code !== null ? code : 1, // If code is null, assume error
                stdout: stdout.join(""),
                stderr: stderr.join(""),
            });
        });
    });
}
