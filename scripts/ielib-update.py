#!/usr/bin/env python3
# coding: utf-8

import sys, os

import ruamel.yaml
yaml = ruamel.yaml.YAML(typ="rt")
yaml.width = 4096
yaml.indent(mapping=2, sequence=4, offset=2)
from ruamel.yaml.scalarstring import LiteralScalarString
import textwrap

import argparse
import re
from collections import OrderedDict

#parse args
parser = argparse.ArgumentParser(description='Update IE  syntax highlighting and completion from IElib', formatter_class=argparse.ArgumentDefaultsHelpFormatter)
parser.add_argument('-s', dest='src_dir', help='header directory', required=True)
parser.add_argument('--completion-file', dest='completion_yaml', help='completion YAML', required=True)
parser.add_argument('--highlight-file', dest='highlight_yaml', help='syntax highlight YAML', required=True)
args=parser.parse_args()

#init vars
ielib_url = "https://ielib.bgforge.net"
types_url = ielib_url + "/types"
stanza_highlight_constants = "ielib-constants"
stanza_completion_constants = "ielib-constants"
stanza_highlight_functions = "ielib-functions"
stanza_completion_functions = "ielib-functions"
completion_yaml = args.completion_yaml
highlight_yaml = args.highlight_yaml
src_dir = args.src_dir
completion_constants = []
highlight_constants = []
completion_functions = []
highlight_functions = []

def find_file(path, name):
  for root, dirs, files in os.walk(path, followlinks=True):
    if name in files:
      return os.path.join(root, name)

def find_files(path, ext, skip_dirs = []):
  flist = []
  for root, dirs, files in os.walk(path, followlinks=True):
    dirs[:] = [d for d in dirs if d not in skip_dirs]
    for f in files:
      if f.lower().endswith(ext.lower()):
        flist.append(os.path.join(root, f))
  return flist


# CONSTANTS
regex_numeric = r"^(\w+)\s*=\s*(\w+)" # can be hex or bin numbers
regex_text = r"^TEXT_SPRINT\s+(\w+)\s+~(\w+)~"

def defines_from_file(path, regex):
  defines = {}
  with open(path, "r") as fh:
    for line in fh: # some monkey code
      constant = re.match(regex, line)
      if constant:
        defines[constant.group(1)] = constant.group(2)
  return defines

# get various defines from header files
define_files = find_files(src_dir, "tpp", skip_dirs=["functions"])
defines = {}
for df in define_files:
  new_defines = defines_from_file(df, regex_numeric)
  defines = {**defines, **new_defines}
  new_defines = defines_from_file(df, regex_text)
  defines = {**defines, **new_defines}

# reduce diff noise
defines = OrderedDict(sorted(defines.items(), reverse=True)) # so that longer keys are found first

for d in defines:
  highlight_constants.append({"match": "(%{}%)".format(d)})
  highlight_constants.append({"match": "({})".format(d)}) # make sure unbalanced %'s are not highlighted
  completion_constants.append({"name": d, "detail": defines[d], "doc": "IElib define"})

# dump to completion
with open(completion_yaml) as yf:
  data = yaml.load(yf)
data[stanza_completion_constants]["items"] = completion_constants
data[stanza_completion_constants]["type"] = 21 # constant
with open(completion_yaml, 'w') as yf:
  yaml.dump(data, yf)

# dump function and hooks to syntax highlight
with open(highlight_yaml) as yf:
  data = yaml.load(yf)
data["repository"][stanza_highlight_constants]["patterns"] = highlight_constants
data["repository"][stanza_highlight_constants]["name"] = "constant.language.ielib.weidu"
with open(highlight_yaml, 'w') as yf:
  yaml.dump(data, yf)
# END CONSTANTS



# FUNCTIONS
def func_to_item(func):
  item = {}
  item["name"] = func["name"]
  item["detail"] = "{} function {}".format(func["type"], func["name"])
  text = "{}\n\n".format(func["desc"])
  if "int_params" in func:
    text += params_to_md(func, "int_params")
  if "string_params" in func:
    text += params_to_md(func, "string_params")
  if "return" in func:
    text += rets_to_md(func)
  item["doc"] = text
  return(item)

def params_to_md(func, ptype):
  type_map = {"string_params": "STR_VAR", "int_params": "INT_VAR"}
  text = "| **{}** | **Description** | **Type** | **Default** |\n|:-|:-|:-|:-|".format(type_map[ptype])
  params = sorted(func[ptype], key=lambda k: k['name'])
  for sp in params:
    default = get_default(sp, func)
    name = sp["name"]
    if "required" in sp and sp["required"] == 1:
      default = "_required_"
    ptype = get_ptype(sp["type"])
    text = text + "\n| {} | {} | {} | {} |".format(name, sp["desc"], ptype, default)
  text = text + "\n"
  return text

def rets_to_md(func):
  text = "\n| RET vars | Description | Type |\n|:--------|:-----|:--------|"
  rets = sorted(func["return"], key=lambda k: k['name'])
  for r in rets:
    rtype = get_ptype(r["type"])
    text = text + "\n| {} | {} | {} |".format(r["name"], r["desc"], rtype)
  text = text + "\n"
  return text

def get_ptype(tname):
  try:
    ptype = [x for x in types if x["name"] == tname][0]
    ptext = "[{}]({}/#{})".format(tname, types_url, tname)
    return ptext
  except:
    return tname

def get_default(param, func):
  if "default" in param:
    default = param["default"]
    return default
  ptype = param["type"]
  if "defaults" in func and ptype in func["defaults"]:
    default = func["defaults"][ptype]
    return default
  return ""


data_dir = os.path.join(src_dir, "docs", "data")
functions_dir = os.path.join(data_dir, "functions")
function_files = find_files(functions_dir, "yml")
types_file = os.path.join(data_dir, "types.yml")
with open(types_file) as yf:
  types = yaml.load(yf)
for f in function_files:
  with open(f) as yf:
    data = yaml.load(yf)
  data = sorted(data, key=lambda k: k['name'])
  for i in data:
    item = func_to_item(i)
    highlight_functions.append({"match": "({})".format(item["name"])})
    completion_functions.append({"name": item["name"], "detail": item["detail"], "doc": item["doc"]})

# dump to completion
with open(completion_yaml) as yf:
  data = yaml.load(yf)
completion_functions = sorted(completion_functions, key=lambda k: k['name']) # reduce diff noise
data[stanza_completion_functions]["items"] = completion_functions
data[stanza_completion_functions]["type"] = 3 # functions
with open(completion_yaml, 'w') as yf:
  yaml.dump(data, yf)

# dump function and hooks to syntax highlight
with open(highlight_yaml) as yf:
  data = yaml.load(yf)
highlight_functions = sorted(highlight_functions, key=lambda k: k['match']) # reduce diff noise
data["repository"][stanza_highlight_functions]["patterns"] = highlight_functions
data["repository"][stanza_highlight_functions]["name"] = "support.function.ielib.weidu"
with open(highlight_yaml, 'w') as yf:
  yaml.dump(data, yf)
# END FUNCTIONS
