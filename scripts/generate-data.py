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
    data = {}
    for ypath in yaml_list:
        print(ypath)
        with open(ypath) as yf:
            ydata = yaml.load(yf)
        # merge, keep order
        data = {**data, **ydata}
    return data


def get_detail(item, include_types=True):
    """
    Returns full function invocation string: "int get_sfall_arg_at(int a, ObjectPtr b)"
    Types can be optionally omitted.
    """
    if "args" in item:
        # this is for hover and completion
        if include_types:
            args_with_type = ["{} {}".format(a["type"], a["name"]) for a in item["args"]]
            args_string = ", ".join(args_with_type)
            detail = "{} {}({})".format(item["type"], item["name"], args_string)
        else:  # and this is for signature
            args_no_type = [a["name"] for a in item["args"]]
            args_string = ", ".join(args_no_type)
            detail = "{}({})".format(item["name"], args_string)
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
        for a in item["args"]:
            # doc = doc + "- `{} {}` {}\n".format(a["type"], a["name"], a["doc"])
            # type is already shown in detail
            doc = doc + "- `{}` {}\n".format(a["name"], a["doc"])
    if "args" in item and "doc" in item:
        doc += "\n"
    if "doc" in item:
        doc = doc + item["doc"]
    return doc


def generate_completion(data):
    completion_data = []
    COMPLETION_TAG_deprecated = 1
    for items_list in data:
        kind = data[items_list]["type"]
        items = data[items_list]["items"]
        for item in items:
            label = item["name"]
            detail = get_detail(item)
            doc = get_doc(item)

            if "deprecated" in item:
                deprecated = item["deprecated"]
            else:
                deprecated = False

            markdown = {"kind": "markdown", "value": doc}
            completion_item = {
                "label": label,
                "kind": kind,
                "documentation": markdown,
                "detail": detail,
                "source": "builtin",
            }
            if deprecated:
                completion_item["tags"] = [COMPLETION_TAG_deprecated]
            completion_data.append(completion_item)
    return completion_data


def generate_hover(data, tooltip_lang_id):
    hover_data = {}
    for items_list in data:
        items = data[items_list]["items"]
        for item in items:
            label = item["name"]

            # no point in showing a hover is there's no data besides the name
            if ("detail" not in item) and ("doc" not in item) and ("args" not in item):
                continue

            detail = get_detail(item)
            value = "```{}\n{}\n```".format(tooltip_lang_id, detail)
            doc = get_doc(item)
            if doc != "":
                value = "{}\n{}".format(value, doc)

            markdown = {"kind": "markdown", "value": value}
            hover = {"contents": markdown}
            hover_data[label] = hover
    return hover_data


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
            for a in item["args"]:
                doc = "```{}\n{} {}\n```\n{}".format(lang_id, a["type"], a["name"], a["doc"])
                parameters.append({"label": a["name"], "documentation": markdown(doc)})

            function_doc = markdown("---\n{}".format(item["doc"]))
            sig_data[name] = {"label": label, "documentation": function_doc, "parameters": parameters}
    return sig_data


data = load_data(input_yaml_list)
completion_data = generate_completion(data)
hover_data = generate_hover(data, tooltip_lang_id)

if signature_file:
    signature_data = generate_signatures(data, tooltip_lang_id)

with open(hover_file, "w") as jf:
    json.dump(hover_data, jf, indent=4)

with open(completion_file, "w") as jf:
    json.dump(completion_data, jf, indent=4)

if signature_file:
    with open(signature_file, "w") as jf:
        json.dump(signature_data, jf, indent=4)
