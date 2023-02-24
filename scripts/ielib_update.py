#!/usr/bin/env python3

import argparse
import os
import re
import sys

import ruamel.yaml
from ie import COMPLETION_TYPE_FUNCTION, dump_completion, dump_highlight, find_files, litscal

yaml = ruamel.yaml.YAML(typ="rt")
yaml.width = 4096
yaml.indent(mapping=2, sequence=4, offset=2)

# parse args
parser = argparse.ArgumentParser(
    description="Update IE syntax highlighting and intellisense from IElib",
    formatter_class=argparse.ArgumentDefaultsHelpFormatter,
)
parser.add_argument("-s", dest="src_dir", help="header directory", required=True)
parser.add_argument(
    "--data-file",
    dest="data_file",
    help="IElib intellisense data YAML for WeiDU",
    required=True,
)
parser.add_argument(
    "--highlight-weidu",
    dest="highlight_weidu",
    help="WeiDU syntax highlight YAML",
    required=True,
)
args = parser.parse_args()

# init vars
IELIB_URL = "https://ielib.bgforge.net"
TYPES_URL = IELIB_URL + "/types"

ielib_data = {
    "ints": {
        "stanza": "ielib-int",
        "scope": "constant.language.ielib.int",
    },
    "resrefs": {
        "stanza": "ielib-resref",
        "scope": "constant.language.ielib.resref",
        "string": True,
    },
    "action_functions": {
        "stanza": "ielib-action-functions",
        "scope": "support.function.weidu-tp2.action-function-name",
        "completion_type": COMPLETION_TYPE_FUNCTION,
    },
    "patch_functions": {
        "stanza": "ielib-patch-functions",
        "scope": "entity.name.function.weidu-tp2.patch-function-name",
        "completion_type": COMPLETION_TYPE_FUNCTION,
    },
}

data_file = args.data_file
highlight_weidu = args.highlight_weidu
src_dir = args.src_dir

# CONSTANTS
REGEX_NUMERIC = r"^(\w+)\s*=\s*(\w+)"  # can be hex or bin numbers
REGEX_TEXT = r"^TEXT_SPRINT\s+~?(\w+)~?\s+~(\w+)~"


def defines_from_file(path, regex):
    defines = {}
    with open(path, "r", encoding="utf8") as fhandle:
        for line in fhandle:  # some monkey code
            constant = re.match(regex, line)
            if constant:
                defines[constant.group(1)] = constant.group(2)
    return defines


# get various defines from header files
define_files = find_files(
    src_dir,
    "tpp",
    skip_dirs=["functions"],
    skip_files=["iesdp.tpp", "spell_ids_bgee.tpp", "spell_ids_iwdee.tpp", "item_types.tpp"],
)  # for now only bg2/ee spells
int_defines = {}
resref_defines = {}
for df in define_files:
    new_int_defines = defines_from_file(df, REGEX_NUMERIC)
    int_defines = {**int_defines, **new_int_defines}
    new_resref_defines = defines_from_file(df, REGEX_TEXT)
    resref_defines = {**resref_defines, **new_resref_defines}

int_defines = [
    {
        "name": name,
        "detail": f"int {name} = {detail}",
        "doc": "IElib define",
    }
    for name, detail in int_defines.items()
]
resref_defines = [
    {
        "name": name,
        "detail": f'resref {name} = "{detail}"',
        "doc": "IElib define",
    }
    for name, detail in resref_defines.items()
]
ielib_data["ints"]["items"] = int_defines
ielib_data["resrefs"]["items"] = resref_defines

# END CONSTANTS


# FUNCTIONS
def func_to_item(func):
    result = {}
    result["name"] = func["name"]
    result["detail"] = f"{func['type']} function {func['name']}"
    text = f"{func['desc']}\n\n"
    if "int_params" in func:
        text += params_to_md(func, "int_params")
    if "string_params" in func:
        text += params_to_md(func, "string_params")
    if "return" in func:
        text += rets_to_md(func)
    result["doc"] = litscal(text)  # multiline format
    result["type"] = func["type"]
    return result


def params_to_md(func, ptype):
    type_map = {"string_params": "STR_VAR", "int_params": "INT_VAR"}
    text = f"| **{type_map[ptype]}** | **Description** | **Type** | **Default** |\n|:-|:-|:-|:-|"
    params = sorted(func[ptype], key=lambda k: k["name"])
    for param in params:
        default = get_default(param, func)
        name = param["name"]
        if "required" in param and param["required"] == 1:
            default = "_required_"
        ptype = get_ptype(param["type"])
        text = text + f"\n| {name} | {param['desc']} | {ptype} | {default} |"
    text = text + "\n"
    return text


def rets_to_md(func):
    text = "\n| RET vars | Description | Type |\n|:--------|:-----|:--------|"
    rets = sorted(func["return"], key=lambda k: k["name"])
    for ret in rets:
        rtype = get_ptype(ret["type"])
        text = text + f"\n| {ret['name']} | {ret['desc']} | {rtype} |"
    text = text + "\n"
    return text


def get_ptype(tname):
    ptype = [x for x in TYPES if x["name"] == tname]
    if len(ptype) == 0:
        print(f"Error: unknown parameter type {tname}")
        sys.exit(1)
    ptext = f"[{tname}]({TYPES_URL}/#{tname})"
    return ptext


def get_default(param, func):
    if "default" in param:
        default = param["default"]
        return default
    ptype = param["type"]
    if "defaults" in func and ptype in func["defaults"]:
        default = func["defaults"][ptype]
        return default
    return ""


DATA_DIR = os.path.join(src_dir, "docs", "data")
FUNCTION_DIR = os.path.join(DATA_DIR, "functions")
function_files = find_files(FUNCTION_DIR, "yml")
TYPES_FILES = os.path.join(DATA_DIR, "types.yml")
action_functions = []
patch_functions = []

with open(TYPES_FILES, encoding="utf8") as yf:
    TYPES = yaml.load(yf)

for f in function_files:
    with open(f, encoding="utf8") as yf:
        data = yaml.load(yf)
    data = sorted(data, key=lambda k: k["name"])
    for i in data:
        item = func_to_item(i)
        if item["type"] == "action":
            action_functions.append(item)
        if item["type"] == "patch":
            patch_functions.append(item)

ielib_data["action_functions"]["items"] = action_functions
ielib_data["patch_functions"]["items"] = patch_functions


dump_completion(data_file, ielib_data)
dump_highlight(highlight_weidu, ielib_data)
