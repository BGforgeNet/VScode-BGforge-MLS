#!/usr/bin/env python3

import argparse
import json
from collections import OrderedDict

import ruamel.yaml

yaml = ruamel.yaml.YAML(typ="rt")
yaml.width = 4096
yaml.indent(mapping=2, sequence=4, offset=2)
# https://stackoverflow.com/questions/57382525/can-i-control-the-formatting-of-multiline-strings
from ruamel.yaml.scalarstring import LiteralScalarString
import textwrap


def LS(s):
    return LiteralScalarString(textwrap.dedent(s))


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
parser.add_argument(
    "--hover", dest="hover_file", help="output hover json", required=True
)
parser.add_argument(
    "--completion", dest="completion_file", help="output completion json", required=True
)

parser.add_argument(
    "--lang", dest="lang_id", help="language id", required=True
)

args = parser.parse_args()
input_yaml_list = args.input_yaml[0]
hover_file = args.hover_file
completion_file = args.completion_file
lang_id = args.lang_id

def load_data(yaml_list):
    data = {}
    for ypath in yaml_list:
        print(ypath)
        with open(ypath) as yf:
            ydata = yaml.load(yf)
        # merge, keep order
        data = {**data, **ydata}
    return data

def generate_completion(data):
    completion_data = []
    for items_list in data:
        kind = data[items_list]["type"]
        items = data[items_list]["items"]
        for item in items:
            label = item["name"]
            try:
                detail = item["detail"]
            except:
                detail = label
            try:
                doc = item["doc"]
            except:
                doc = ""
            markdown = {"kind": "markdown", "value": doc}
            completion_item = {
                "label": label,
                "kind": kind,
                "documentation": markdown,
                "detail": detail,
                "source": "builtin",
            }
            completion_data.append(completion_item)
    return completion_data

def generate_hover(data, lang_id):
    hover_data = {}
    for items_list in data:
        items = data[items_list]["items"]
        for item in items:
            label = item["name"]

            # no point in showing a hover is there's no data besides the name
            if ("detail" not in item) and ("doc" not in item):
                continue

            try:
                detail = item["detail"]
            except:
                detail = label
            value = "```${}```\n{}".format(lang_id, detail)
            if "doc" in item:
                value = "{}\n{}".format(value, item["doc"])

            markdown = { "kind": "markdown", "value": value}
            hover = { "contents": markdown };
            hover_data[label] = hover
    return hover_data


data = load_data(input_yaml_list)
completion_data = generate_completion(data)
hover_data = generate_hover(data, lang_id)

with open(hover_file, "w") as jf:
    json.dump(hover_data, jf, indent=4)

with open(completion_file, "w") as jf:
    json.dump(completion_data, jf, indent=4)
