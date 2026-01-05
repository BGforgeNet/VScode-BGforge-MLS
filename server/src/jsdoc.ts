/**
 * JSDoc comment parser.
 * Extracts @param, @return, @deprecated tags from documentation comments.
 */

interface Arg {
    name: string;
    type: string;
    default?: string;
    description?: string;
}

interface Ret {
    type: string;
}

export interface JSdoc {
    desc?: string;
    args: Arg[];
    ret?: Ret;
    deprecated?: string | true;
}

export function parse(text: string) {
    const args: Arg[] = [];
    const lines = text.split("\n");
    const lines2 = [];
    let ret: Ret | null = null;
    lines.shift();
    lines.pop();
    let deprecated: string | undefined | true;
    for (const l of lines) {
        const l2 = l.replace(" * ", "");
        if (!l2.startsWith("@")) {
            lines2.push(l2);
        }
        const argMatch = l2.match(
            /@(arg|param) {(\w+)} ((\w+)|(\[(\w+)=(.+)\]))((\s+-\s+|\s+)(\w.*))?/
        );
        if (argMatch && argMatch[2]) {
            const arg: Arg = { name: "", type: argMatch[2] };
            if (argMatch[6]) {
                arg.name = argMatch[6];
                arg.default = argMatch[7];
            } else if (argMatch[4]) {
                arg.name = argMatch[4];
            }
            if (argMatch[10]) {
                arg.description = argMatch[10];
            }
            args.push(arg);
        }
        const retMatch = l2.match(/@(ret|return|returns) {(\w+)}/);
        if (retMatch && retMatch[2]) {
            ret = { type: retMatch[2] };
        }
        const depMatch = l2.match(/@deprecated(.*)/);
        if (depMatch) {
            const depArg = depMatch[1];
            if (depArg !== undefined) {
                const depString = depArg.trim();
                if (depString == "") {
                    deprecated = true;
                } else {
                    deprecated = depString;
                }
            } else {
                deprecated = true;
            }
        }
    }
    const desc = lines2.join("\n").trim();
    const jsdoc: JSdoc = { args: [] };
    if (deprecated !== undefined) {
        jsdoc.deprecated = deprecated;
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
