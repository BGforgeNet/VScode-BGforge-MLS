import { conlog } from "./common";
/**
 * Add two numbers.
 * or more
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
// function add(a, b) {
//     return a + b;
// }

interface arg {
    name: string;
    type: string;
    default?: string;
}

export interface JSdoc {
    desc?: string;
    args?: arg[];
    ret?: arg;
    deprecated?: boolean;
}

export function parse(text: string) {
    const args = [];
    const lines = text.split("\n");
    const lines2 = [];
    let ret: arg | null = null;
    lines.shift();
    lines.pop();
    let deprecated = false;
    for (const l of lines) {
        const l2 = l.replace(" * ", "");
        if (!l2.startsWith("@")) {
            lines2.push(l2);
        }
        const arg_match = l2.match(/@(arg|param) {(.*)} (\w)/);
        if (arg_match) {
            args.push({ name: arg_match[3], type: arg_match[2] });
        }
        const ret_match = l2.match(/@(ret|return|returns) {(.*)} (\w)/);
        if (ret_match) {
            ret = { name: ret_match[3], type: ret_match[2] };
        }
        const dep_match = l2.match(/@(deprecated)/);
        if (dep_match) {
            deprecated = true;
        }
    }
    const desc = lines2.join("\n").trim();
    // conlog(text);
    // let desc = text.match(/^[^@].*/gm)[0];
    // desc = desc.trim();
    const jsdoc: JSdoc = {};
    if (deprecated) {
        jsdoc.deprecated = true;
    }
    if (desc != "") {
        jsdoc.desc = desc;
    }
    if (args.length > 0) {
        jsdoc.args = args;
    }
    if (ret) {
        jsdoc.ret = ret;
    }
    return jsdoc;
}
