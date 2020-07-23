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
stanza_highlight_constants = "ielib-constants"
stanza_completion_constants = "ielib-constants"
stanza_highlight_functions = "ielib-functions"
stanza_completion_functions = "ielib-functions"
completion_yaml = args.completion_yaml
highlight_yaml = args.highlight_yaml
src_dir = args.src_dir
completion_list = []
highlight_list = []

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
  highlight_list.append({"match": "(%{}%)".format(d)})
  highlight_list.append({"match": "({})".format(d)}) # make sure unbalanced %'s are not highlighted
  completion_list.append({"name": d, "detail": defines[d], "doc": "IElib constant"})

# dump to completion
with open(completion_yaml) as yf:
  data = yaml.load(yf)
data[stanza_completion_constants]["items"] = completion_list
data[stanza_completion_constants]["type"] = 21 # constant
with open(completion_yaml, 'w') as yf:
  yaml.dump(data, yf)

# dump function and hooks to syntax highlight
with open(highlight_yaml) as yf:
  data = yaml.load(yf)
data["repository"][stanza_highlight_constants]["patterns"] = highlight_list
data["repository"][stanza_highlight_constants]["name"] = "constant.language.ielib.weidu"
with open(highlight_yaml, 'w') as yf:
  yaml.dump(data, yf)
