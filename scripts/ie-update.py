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
highlight_stanza = "ielib"
completion_stanza = "ielib"
completion_yaml = args.completion_yaml
highlight_yaml = args.highlight_yaml
src_dir = args.src_dir
completion_list = []
highlight_list = []

def find_file(path, name):
  for root, dirs, files in os.walk(path):
    if name in files:
      return os.path.join(root, name)

def find_files(path, ext):
  flist = []
  for root, dirs, files in os.walk(path):
    for f in files:
      if f.lower().endswith(ext.lower()):
        flist.append(os.path.join(root, f))
  return flist

def LS(s):
  return LiteralScalarString(textwrap.dedent(s))

regex_constant = r"^(\w+)\s*=\s*([0-9]+)"
def defines_from_file(path):
  defines = {}
  with open(path, "r") as fh:
    for line in fh: # some monkey code
      constant = re.match(regex_constant, line)
      if constant:
        defines[constant.group(1)] = constant.group(2)
  return defines

# get various defines from header files
define_files = find_files(src_dir, "tpp")
defines = {}
for df in define_files:
  new_defines = defines_from_file(df)
  defines = {**defines, **new_defines}

# reduce diff noise
defines = OrderedDict(sorted(defines.items()))

for d in defines:
  highlight_list.append({"match": "\\b({})\\b".format(d)})
  completion_list.append({"name": d, "detail": defines[d], "doc": "IElib define"})

# dump to completion
with open(completion_yaml) as yf:
  data = yaml.load(yf)
  data[completion_stanza]["items"] = completion_list
  data[completion_stanza]["type"] = 21 # constant
with open(completion_yaml, 'w') as yf:
  yaml.dump(data, yf)

# dump function and hooks to syntax highlight
with open(highlight_yaml) as yf:
  data = yaml.load(yf)
  data["repository"][highlight_stanza]["patterns"] = highlight_list
  data["repository"][highlight_stanza]["name"] = "constant.language.ielib.weidu"
with open(highlight_yaml, 'w') as yf:
  yaml.dump(data, yf)
