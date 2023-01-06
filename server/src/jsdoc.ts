interface arg {
    name: string;
    type: string;
    default?: string;
}

interface ret {
    type: string;
}

export interface JSdoc {
    desc?: string;
    args: arg[];
    ret?: ret;
    deprecated?: boolean;
}

export function parse(text: string) {
    const args = [];
    const lines = text.split("\n");
    const lines2 = [];
    let ret: ret | null = null;
    lines.shift();
    lines.pop();
    let deprecated = false;
    for (const l of lines) {
        const l2 = l.replace(" * ", "");
        if (!l2.startsWith("@")) {
            lines2.push(l2);
        }
        const argMatch = l2.match(/@(arg|param) {(.*)} (\w+)/);
        if (argMatch) {
            args.push({ name: argMatch[3], type: argMatch[2] });
        }
        const retMatch = l2.match(/@(ret|return|returns) {(.*)}/);
        if (retMatch) {
            ret = {type: retMatch[2] };
        }
        const depMatch = l2.match(/@(deprecated)/);
        if (depMatch) {
            deprecated = true;
        }
    }
    const desc = lines2.join("\n").trim();
    const jsdoc: JSdoc = {args: []};
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
