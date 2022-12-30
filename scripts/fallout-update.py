#!/usr/bin/env python3

import os
import argparse
import re
from collections import OrderedDict
import ruamel.yaml
from ruamel.yaml.scalarstring import LiteralScalarString
import textwrap

# https://stackoverflow.com/questions/57382525/can-i-control-the-formatting-of-multiline-strings
yaml = ruamel.yaml.YAML(typ="rt")
yaml.width = 4096
yaml.indent(mapping=2, sequence=4, offset=2)


def LS(s):
    return LiteralScalarString(textwrap.dedent(s))


# parse args
parser = argparse.ArgumentParser(
    description="Update Fallout syntax data from external sources",
    formatter_class=argparse.ArgumentDefaultsHelpFormatter,
)
parser.add_argument("-s", dest="src_dir", help="header directory", required=True)
parser.add_argument("--sfall-file", dest="sfall_yaml", help="sfall data YAML", required=True)
parser.add_argument(
    "--highlight-file",
    dest="highlight_yaml",
    help="syntax highlight YAML",
    required=True,
)
args = parser.parse_args()

# init vars
functions_yaml_name = "functions.yml"
hooks_yaml_name = "hooks.yml"
sfall_functions_stanza = "sfall-functions"
sfall_hooks_stanza = "hooks"
sfall_yaml = args.sfall_yaml
highlight_yaml = args.highlight_yaml
src_dir = args.src_dir
sfall_functions = []
sfall_hooks = []
highlight_functions = []
highlight_hooks = []
header_defines = {}


def find_file(path, name):
    for root, dirs, files in os.walk(path, followlinks=True):
        if name in files:
            return os.path.join(root, name)


def find_files(path, ext):
    flist = []
    for root, dirs, files in os.walk(path, followlinks=True):
        for f in files:
            if f.lower().endswith(".h"):
                flist.append(os.path.join(root, f))
    return flist


regex_constant = r"^#define\s+(\w+)\s+\(?([0-9]+)\)?"
regex_define_with_vars = r"^#define\s+(\w+)\([\w\s,]+\)"  # not perfect, but works
regex_procedure = r"^procedure\s+(\w+)(\((variable\s+[\w+])+(\s*,\s*variable\s+[\w+])?\))?\s+begin"
regex_variable = r"^#define\s+((GVAR|MVAR|LVAR)_\w+)\s+\(?([0-9]+)\)?"
regex_alias = (
    r"^#define\s+(\w+)\s+\(?(\w+)\)?\s*$"  # aliases like: #define FLOAT_COLOR_NORMAL          FLOAT_MSG_YELLOW.
)


def defines_from_file(path):
    defines = {}
    with open(path, "r") as fh:
        for line in fh:  # some monkey code
            variable = re.match(regex_variable, line)
            if variable:
                name = variable.group(1)
                defines[name] = "variable"  # it's actually a constant, but it helps to see XVAR highlighted as vars
                continue
            constant = re.match(regex_constant, line)
            if constant:
                name = constant.group(1)
                defines[name] = "constant"
                continue
            define_with_vars = re.match(regex_define_with_vars, line)
            if define_with_vars:
                name = define_with_vars.group(1)
                defines[name] = "define_with_vars"
                continue
            alias = re.match(regex_alias, line)
            if alias:
                name = alias.group(1)
                defines[name] = "alias"
                continue
            procedure = re.match(regex_procedure, line)
            if procedure:
                name = procedure.group(1)
                defines[name] = "procedure"
                continue
    return defines


# get various defines from header files
define_files = find_files(src_dir, "h")
for df in define_files:
    new_defines = defines_from_file(df)
    header_defines = {**header_defines, **new_defines}

# reduce diff noise
header_defines = OrderedDict(sorted(header_defines.items()))

# prepare tmlanguage data structures
header_variables = []
header_constants = []
header_procedures = []
header_defines_with_vars = []
header_aliases = []
for h in header_defines:
    if header_defines[h] == "variable":
        header_variables.append({"match": "\\b({})\\b".format(h)})
        continue
    if header_defines[h] == "constant":
        header_constants.append({"match": "\\b({})\\b".format(h)})
        continue
    if header_defines[h] == "define_with_vars":
        header_defines_with_vars.append({"match": "\\b({})\\b".format(h)})
        continue
    if header_defines[h] == "alias":
        header_aliases.append({"match": "\\b({})\\b".format(h)})
        continue
    if header_defines[h] == "procedure":
        header_procedures.append({"match": "\\b({})\\b".format(h)})
        continue
    print("Warning: couldn't determine type for {}".format(h))

functions_yaml = find_file(src_dir, functions_yaml_name)
hooks_yaml = find_file(src_dir, hooks_yaml_name)

# load functions
with open(functions_yaml) as yf:
    categories = yaml.load(yf)
categories = sorted(categories, key=lambda k: k["name"])  # less diff noise
for category in categories:
    cdoc = ""
    # common catefory documentation
    if "doc" in category:
        cdoc = category["doc"]

    # individual functions
    if "items" in category:
        functions = category["items"]
        functions = sorted(functions, key=lambda k: k["name"])  # less diff noise

        for f in functions:
            name = f["name"]
            # highlighting first
            if name != "^":  # sorry, exponentiation
                highlight_functions.append({"match": "\\b(?i)({})\\b".format(name)})

            # and now completion
            completion_item = {"name": name}

            if "detail" in f:  # this should be eventually deprecated and replaced with args below
                completion_item["detail"] = f["detail"]

            doc = ""
            if "doc" in f:
                doc = f["doc"]
            # if category doc is not empty
            if cdoc != "":
                if doc == "":  # if function doc is empty
                    doc = cdoc  # replace
                else:
                    doc += "\n" + cdoc  # append
            if doc != "":
                doc = LS(doc)
                completion_item["doc"] = doc

            if "args" in f:
                completion_item["args"] = f["args"]
                completion_item["type"] = f["type"]

            sfall_functions.append(completion_item)

# load hooks
with open(hooks_yaml) as yf:
    hooks = yaml.load(yf)
hooks = sorted(hooks, key=lambda k: k["name"])  # alphabetical sort

for h in hooks:
    name = h["name"]
    doc = h["doc"]
    doc = LS(doc)
    codename = "HOOK_" + name.upper()
    sfall_hooks.append({"name": codename, "doc": doc})
    highlight_hooks.append({"match": "\\b({})\\b".format(codename)})

# dump to completion
with open(sfall_yaml) as yf:
    data = yaml.load(yf)
data[sfall_functions_stanza] = {
    "type": 3,
    "items": sfall_functions,
}  # type = function
data[sfall_hooks_stanza] = {"type": 21, "items": sfall_hooks}  # type = constant
with open(sfall_yaml, "w") as yf:
    yaml.dump(data, yf)

# dump function and hooks to syntax highlight
with open(highlight_yaml) as yf:
    data = yaml.load(yf)
data["repository"]["sfall-functions"]["patterns"] = highlight_functions
data["repository"]["hooks"]["patterns"] = highlight_hooks
data["repository"]["header-constants"]["patterns"] = header_constants
data["repository"]["header-variables"]["patterns"] = header_variables
data["repository"]["header-procedures"]["patterns"] = header_procedures
data["repository"]["header-defines-with-vars"]["patterns"] = header_defines_with_vars
data["repository"]["header-aliases"]["patterns"] = header_aliases
with open(highlight_yaml, "w") as yf:
    yaml.dump(data, yf)
