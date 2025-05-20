import { conlog } from "../common";
import Module from "./sslc.mjs";
import WasmBinary from "./sslc.wasm";

// Types are missing here
declare const WebAssembly: any;

export async function ssl_compile() {
    conlog(`Loading sslc... ${typeof WasmBinary} ${WasmBinary.byteLength}`);
    try {
        const instance = await Module({
            print: (text: string) => {
                conlog(`==WASM== ${text}`);
            },
            wasmBinary: WasmBinary,
            locateFile: (path: string) => {
                return path;
            },
        });
    } catch (e: any) {
        conlog(`Error loading wasm module: ${e.name}`);
        conlog(`${e.message}`);
        conlog(`${e.stack}`);
        return;
    }
    conlog(`Wasm module done`);
    return "kek";
}
