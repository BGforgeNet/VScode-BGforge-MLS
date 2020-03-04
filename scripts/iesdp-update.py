#!/usr/bin/env python3
# coding: utf-8

import sys, os
import frontmatter
import argparse
import re
from collections import OrderedDict
import ruamel.yaml
yaml = ruamel.yaml.YAML(typ="rt")
yaml.width = 4096
yaml.indent(mapping=2, sequence=4, offset=2)

#parse args
parser = argparse.ArgumentParser(description='Get updates from IESDP', formatter_class=argparse.ArgumentDefaultsHelpFormatter)
parser.add_argument('-s', dest='iesdp_dir', help='iesdp directory', required=True)
parser.add_argument('--completion-baf', dest='competion_baf', help='BAF completion YAML', required=True)
parser.add_argument('--highlight-baf', dest='highlight_baf', help='BAF highlight YAML', required=True)
args=parser.parse_args()

#init vars
iesdp_dir = args.iesdp_dir
actions_dir = os.path.join(iesdp_dir, "_data", 'actions')
highlight_baf = args.highlight_baf
competion_baf = args.competion_baf
actions = []
action_stanza = "actions"

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

files = find_files(actions_dir, 'yml')
for f in files:
  with open(f) as yf:
    action = yaml.load(yf)
  if ('bg2' in action and action['bg2'] == 1) or ('bgee' in action and action['bgee'] == 1): # just bg2/ee actions for now
    actions.append(action)

actions = sorted(actions, key=lambda k: k["n"])
actions_highlight = [x["name"] for x in actions]
actions_highlight = set(actions_highlight)
actions_highlight_patterns = [{"match": "\\b({})\\b".format(x)} for x in actions_highlight]
actions_highlight_patterns = sorted(actions_highlight_patterns, key=lambda k: k["match"])

# dump to completion
with open(highlight_baf) as yf:
  data = yaml.load(yf)
  data["repository"][action_stanza]["patterns"] = actions_highlight_patterns
with open(highlight_baf, 'w') as yf:
  yaml.dump(data, yf)
