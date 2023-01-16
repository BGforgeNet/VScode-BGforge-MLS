#!/usr/bin/env python3

import os
import argparse
import re
from collections import OrderedDict
import textwrap
import ruamel.yaml
from ruamel.yaml.scalarstring import LiteralScalarString

# https://stackoverflow.com/questions/57382525/can-i-control-the-formatting-of-multiline-strings
yaml = ruamel.yaml.YAML(typ="rt")
yaml.width = 4096
yaml.indent(mapping=2, sequence=4, offset=2)


def litscal(string):
    return LiteralScalarString(textwrap.dedent(string))


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
FUNCTION_YAML = "functions.yml"
HOOKS_YAML = "hooks.yml"
SFALL_FUNCTIONS_STANZA = "sfall-functions"
SFALL_HOOKS_STANZA = "hooks"
sfall_yaml = args.sfall_yaml
highlight_yaml = args.highlight_yaml
src_dir = args.src_dir
sfall_functions = []
sfall_hooks = []
highlight_functions = []
highlight_hooks = []
header_defines = {}


def find_file(path, filename):
    for root, dirs, files in os.walk(path, followlinks=True):  # pylint: disable=unused-variable
        if filename in files:
            return os.path.join(root, filename)
    return None


def find_files(path, ext):
    flist = []
    for root, dirs, files in os.walk(path, followlinks=True):  # pylint: disable=unused-variable
        for file in files:
            if file.lower().endswith(ext):
                flist.append(os.path.join(root, file))
    return flist


REGEX_CONSTANT = r"^#define\s+(\w+)\s+\(?([0-9]+)\)?"
REGEX_DEFINE_WITH_ARGS = r"^#define\s+(\w+)\([\w\s,]+\)"  # not perfect, but works
REGEX_PROCEDURE = r"^procedure\s+(\w+)(\((variable\s+[\w+])+(\s*,\s*variable\s+[\w+])?\))?\s+begin"
REGEX_VARIABLE = r"^#define\s+((GVAR|MVAR|LVAR)_\w+)\s+\(?([0-9]+)\)?"
REGEX_ALIAS = (
    r"^#define\s+(\w+)\s+\(?(\w+)\)?\s*$"  # aliases like: #define FLOAT_COLOR_NORMAL          FLOAT_MSG_YELLOW.
)


def defines_from_file(path):
    defines = {}
    with open(path, "r", encoding="utf8") as fhandle:
        for line in fhandle:  # some monkey code
            variable = re.match(REGEX_VARIABLE, line)
            if variable:
                defname = variable.group(1)
                defines[defname] = "variable"  # it's actually a constant, but it helps to see XVAR highlighted as vars
                continue
            constant = re.match(REGEX_CONSTANT, line)
            if constant:
                defname = constant.group(1)
                defines[defname] = "constant"
                continue
            define_with_vars = re.match(REGEX_DEFINE_WITH_ARGS, line)
            if define_with_vars:
                defname = define_with_vars.group(1)
                defines[defname] = "define_with_vars"
                continue
            alias = re.match(REGEX_ALIAS, line)
            if alias:
                defname = alias.group(1)
                defines[defname] = "alias"
                continue
            procedure = re.match(REGEX_PROCEDURE, line)
            if procedure:
                defname = procedure.group(1)
                defines[defname] = "procedure"
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
        header_variables.append({"match": f"\\b({h})\\b"})
        continue
    if header_defines[h] == "constant":
        header_constants.append({"match": f"\\b({h})\\b"})
        continue
    if header_defines[h] == "define_with_vars":
        header_defines_with_vars.append({"match": f"\\b({h})\\b"})
        continue
    if header_defines[h] == "alias":
        header_aliases.append({"match": f"\\b({h})\\b"})
        continue
    if header_defines[h] == "procedure":
        header_procedures.append({"match": f"\\b({h})\\b"})
        continue
    print(f"Warning: couldn't determine type for {h}")

functions_yaml = find_file(src_dir, FUNCTION_YAML)
hooks_yaml = find_file(src_dir, HOOKS_YAML)

# load functions
with open(functions_yaml, encoding="utf8") as yf:
    categories = yaml.load(yf)
categories = sorted(categories, key=lambda k: k["name"])  # less diff noise
for category in categories:
    cdoc = ""  # pylint: disable=invalid-name # no idea why pylint thinks it's a constant
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
                highlight_functions.append({"match": f"\\b(?i)({name})\\b"})

            # and now completion
            completion_item = {"name": name}

            if "detail" in f:  # this should be eventually deprecated and replaced with args below
                completion_item["detail"] = f["detail"]

            doc = ""  # pylint: disable=invalid-name # no idea why pylint thinks it's a constant
            if "doc" in f:
                doc = f["doc"]
            # if category doc is not empty
            if cdoc != "":
                if doc == "":  # if function doc is empty
                    doc = cdoc  # replace
                else:
                    doc += "\n" + cdoc  # append
            if doc != "":
                doc = litscal(doc)
                completion_item["doc"] = doc

            if "args" in f:
                completion_item["args"] = f["args"]
                completion_item["type"] = f["type"]

            sfall_functions.append(completion_item)

# load hooks
with open(hooks_yaml, encoding="utf8") as yf:
    hooks = yaml.load(yf)
hooks = sorted(hooks, key=lambda k: k["name"])  # alphabetical sort

for h in hooks:
    name = h["name"]
    doc = h["doc"]
    doc = litscal(doc)
    codename = "HOOK_" + name.upper()
    sfall_hooks.append({"name": codename, "doc": doc})
    highlight_hooks.append({"match": f"\\b({codename})\\b"})

# dump to completion
with open(sfall_yaml, encoding="utf8") as yf:
    data = yaml.load(yf)
data[SFALL_FUNCTIONS_STANZA] = {
    "type": 3,
    "items": sfall_functions,
}  # type = function
data[SFALL_HOOKS_STANZA] = {"type": 21, "items": sfall_hooks}  # type = constant
with open(sfall_yaml, "w", encoding="utf8") as yf:
    yaml.dump(data, yf)

# dump function and hooks to syntax highlight
with open(highlight_yaml, encoding="utf8") as yf:
    data = yaml.load(yf)
data["repository"]["sfall-functions"]["patterns"] = highlight_functions
data["repository"]["hooks"]["patterns"] = highlight_hooks
data["repository"]["header-constants"]["patterns"] = header_constants
data["repository"]["header-variables"]["patterns"] = header_variables
data["repository"]["header-procedures"]["patterns"] = header_procedures
data["repository"]["header-defines-with-vars"]["patterns"] = header_defines_with_vars
data["repository"]["header-aliases"]["patterns"] = header_aliases
with open(highlight_yaml, "w", encoding="utf8") as yf:
    yaml.dump(data, yf)
