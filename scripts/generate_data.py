#!/usr/bin/env python3

import argparse
import json
import ruamel.yaml

yaml = ruamel.yaml.YAML(typ="rt")
yaml.width = 4096
yaml.indent(mapping=2, sequence=4, offset=2)

parser = argparse.ArgumentParser(
    description="Generate completion and hover files from data",
    formatter_class=argparse.ArgumentDefaultsHelpFormatter,
)

parser.add_argument(
    "-i",
    dest="input_yaml",
    help="input yaml files",
    action="append",
    nargs="+",
    required=True,
)
parser.add_argument("--hover", dest="hover_file", help="output hover json", required=True)
parser.add_argument("--completion", dest="completion_file", help="output completion json", required=True)
parser.add_argument("--signature", dest="signature_file", help="output signatures json", required=False, default=None)
parser.add_argument(
    "--tooltip-lang", dest="tooltip_lang_id", help="language id used in intellisense tooltips", required=True
)

args = parser.parse_args()
input_yaml_list = args.input_yaml[0]
hover_file = args.hover_file
completion_file = args.completion_file
signature_file = args.signature_file
tooltip_lang_id = args.tooltip_lang_id


def load_data(yaml_list):
    result = {}
    for ypath in yaml_list:
        print(ypath)
        with open(ypath, encoding="utf8") as yaf:
            ydata = yaml.load(yaf)
        # merge, keep order
        result = {**result, **ydata}
    return result


def get_detail(item, include_types=True):
    """
    Returns full function invocation string: "int get_sfall_arg_at(int a, ObjectPtr b)"
    Types can be optionally omitted.
    """
    if "args" in item:
        # this is for hover and completion
        if include_types:
            args_with_type = [f"{a['type']} {a['name']}" for a in item["args"]]
            args_string = ", ".join(args_with_type)
            detail = f"{item['type']} {item['name']}({args_string})"
        else:  # and this is for signature
            args_no_type = [a["name"] for a in item["args"]]
            args_string = ", ".join(args_no_type)
            detail = f"{item['name']}({args_string})"
    else:
        if "detail" in item:
            detail = item["detail"]
        else:
            detail = item["name"]
    return detail


def get_doc(item):
    """
    Generates markdown doc from item args and doc field.
    """
    doc = ""
    if "args" in item:
        for arg in item["args"]:
            # doc = doc + "- `{} {}` {}\n".format(a["type"], a["name"], a["doc"])
            # type is already shown in detail
            doc = doc + f"- `{arg['name']}` {arg['doc']}\n"
    if "args" in item and "doc" in item:
        doc += "\n"
    if "doc" in item:
        doc = doc + item["doc"]
    return doc


def generate_completion(data):
    result = []
    COMPLETION_TAG_deprecated = 1  # pylint: disable=invalid-name
    for items_list in data:
        kind = data[items_list]["type"]
        items = data[items_list]["items"]
        for item in items:
            label = item["name"]

            completion_item = {"label": label, "kind": kind, "source": "builtin"}

            # CompletionItem "detail" field is a string in VScode and can't have highlighing
            # Instead, we add detail on top of documentation, which is MarkupContent
            detail = get_detail(item)
            doc = get_doc(item)
            if (detail != label) or (doc != ""):
                md_value = f"```{tooltip_lang_id}\n{detail}\n```"
                if doc != "":
                    md_value = f"{md_value}\n{doc}"
                markdown_contents = {"kind": "markdown", "value": md_value}
                completion_item["documentation"] = markdown_contents

            if "deprecated" in item:
                deprecated = item["deprecated"]
            else:
                deprecated = False
            if deprecated:
                completion_item["tags"] = [COMPLETION_TAG_deprecated]

            result.append(completion_item)
    return result


def generate_hover(data, lang_id):
    result = {}
    for items_list in data:
        items = data[items_list]["items"]
        for item in items:
            label = item["name"]

            # no point in showing a hover is there's no data besides the name
            if ("detail" not in item) and ("doc" not in item) and ("args" not in item):
                continue

            detail = get_detail(item)
            value = f"```{lang_id}\n{detail}\n```"
            doc = get_doc(item)
            if doc != "":
                value = f"{value}\n{doc}"

            markdown_contents = {"kind": "markdown", "value": value}
            hover = {"contents": markdown_contents}
            result[label] = hover
    return result


def markdown(string):
    """Returns VScode MarkupContent item"""
    return {"kind": "markdown", "value": string}


def generate_signatures(data, lang_id):
    sig_data = {}
    for items_list in data:
        items = data[items_list]["items"]
        for item in items:
            # signatures need args
            if "args" not in item:
                continue
            name = item["name"]

            label = get_detail(item, include_types=False)
            parameters = []
            for arg in item["args"]:
                doc = f"```{lang_id}\n{arg['type']} {arg['name']}\n```\n{arg['doc']}"
                parameters.append({"label": arg["name"], "documentation": markdown(doc)})

            function_doc = markdown(f"---\n{item['doc']}")
            sig_data[name] = {"label": label, "documentation": function_doc, "parameters": parameters}
    return sig_data


input_data = load_data(input_yaml_list)
completion_data = generate_completion(input_data)
hover_data = generate_hover(input_data, tooltip_lang_id)

if signature_file:
    signature_data = generate_signatures(input_data, tooltip_lang_id)

with open(hover_file, "w", encoding="utf8") as jf:
    json.dump(hover_data, jf, indent=4)

with open(completion_file, "w", encoding="utf8") as jf:
    json.dump(completion_data, jf, indent=4)

if signature_file:
    with open(signature_file, "w", encoding="utf8") as jf:
        json.dump(signature_data, jf, indent=4)
