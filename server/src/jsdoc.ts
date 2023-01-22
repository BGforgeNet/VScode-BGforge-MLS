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
    deprecated?: boolean;
}

export function parse(text: string) {
    const args: Arg[] = [];
    const lines = text.split("\n");
    const lines2 = [];
    let ret: Ret | null = null;
    lines.shift();
    lines.pop();
    let deprecated = false;
    for (const l of lines) {
        const l2 = l.replace(" * ", "");
        if (!l2.startsWith("@")) {
            lines2.push(l2);
        }
        const argMatch = l2.match(
            /@(arg|param) {(\w+)} ((\w+)|(\[(\w+)=(.+)\]))((\s+-\s+|\s+)(\w.*))?/
        );
        if (argMatch) {
            const arg: Arg = { name: "", type: argMatch[2] };
            if (argMatch[6]) {
                arg.name = argMatch[6];
                arg.default = argMatch[7];
            } else {
                arg.name = argMatch[4];
            }
            if (argMatch[10]) {
                arg.description = argMatch[10];
            }
            args.push(arg);
        }
        const retMatch = l2.match(/@(ret|return|returns) {(\w+)}/);
        if (retMatch) {
            ret = { type: retMatch[2] };
        }
        const depMatch = l2.match(/@deprecated/);
        if (depMatch) {
            deprecated = true;
        }
    }
    const desc = lines2.join("\n").trim();
    const jsdoc: JSdoc = { args: [] };
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
