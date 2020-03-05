#!/usr/bin/env python3
# coding: utf-8

import sys, os, re
import argparse
import re
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

from urllib.parse import urljoin

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
completion_baf = args.competion_baf
actions = []
actions_stanza = "actions"

iesdp_base_url = "https://gibberlings3.github.io/iesdp/"
iesdp_actions_url = "{}/scripting/actions".format(iesdp_base_url)
iesdp_games_file = os.path.join(iesdp_dir, "_data", 'games.yml')
with open(iesdp_games_file) as yf:
  iesdp_games = yaml.load(yf)


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

# highlight
actions_highlight = [x["name"] for x in actions]
actions_highlight = set(actions_highlight)
actions_highlight_patterns = [{"match": "\\b({})\\b".format(x)} for x in actions_highlight]
actions_highlight_patterns = sorted(actions_highlight_patterns, key=lambda k: k["match"])
# dump to file
with open(highlight_baf) as yf:
  data = yaml.load(yf)
  data["repository"][actions_stanza]["patterns"] = actions_highlight_patterns
with open(highlight_baf, 'w') as yf:
  yaml.dump(data, yf)


# completion
# alias has no desc of its own
def action_alias_desc(actions, action):
  if action["alias"] == True:
    num = action["n"]
  else:
    num = action["alias"]
  parent = [x for x in actions if x['n'] == num and not "alias" in x][0]
  if "unknown" in parent:
    return False
  return parent["desc"]

# entry point for getting generic desc
def action_desc(actions, action):
  if "alias" in action:
    desc = action_alias_desc(actions, action)
    if not desc:
      return False
  else:
    desc = a["desc"]

  # replace variables in links
  if "bg2" in a:
    game_name = "bg2"
  else:
    game_name = "bgee"
  desc = action_desc_absolute_urls(desc, iesdp_games, game_name)

  return desc

# fixes relative/variable links
def action_desc_absolute_urls(desc, games, game_name):
  game = [x for x in games if x["name"] == game_name][0]
  ids = game["ids"].lstrip("/")
  twoda = game["2da"].lstrip("/")
  actions_url = game["actions"]
  desc = desc.replace("{{ ids }}", ids).replace("{{ 2da }}", twoda)

  current_url = urljoin(iesdp_base_url, actions_url.lstrip("/"))
  urls = re.findall(r"\[(.*?)\]\((.*?)\)", desc)
  for url in urls:
    dst = url[1].strip()
    dst_abs = urljoin(current_url, dst)
    desc = re.sub(dst, dst_abs, desc)

  return desc

def append_unique(actions, new_actions):
  for na in new_actions:
    existing = [x for x in actions if x["name"] == na["name"]]
    if len(existing) == 0: actions.append(na)
  return actions

def action_detail(action):
  if not "params" in action:
    return "{}()".format(action["name"])
  param_string = ""
  first_param = True
  for p in action["params"]:
    if not first_param:
      param_string = param_string + ", "
    first_param = False
    param_string = param_string + "{}:{}".format(p["type"].upper(), p["name"])
    if "ids" in p:
      param_string = param_string + "*{}".format(p["ids"].title())
  return "{}({})".format(action["name"], param_string)

actions_unique = []
parents_bg2 = [x for x in actions if "bg2" in x and not "alias" in x]
aliases_bg2 = [x for x in actions if "bg2" in x and "alias" in x]
parents_bgee = [x for x in actions if "bgee" in x and not "bg2" in x and not "alias" in x]
aliases_bgee = [x for x in actions if "bgee" in x and not "bg2" in x and "alias" in x]

# Priority: classic actions > classic aliases > EE in the same order
actions_unique = append_unique(actions_unique, parents_bg2)
actions_unique = append_unique(actions_unique, aliases_bg2)
actions_unique = append_unique(actions_unique, parents_bgee)
actions_unique = append_unique(actions_unique, aliases_bgee)

actions_completion = []
for a in actions_unique:
  if "no_result" in a and a["no_result"]: continue
  if "unknown" in a and a["unknown"]: continue
  if "Dialogue" in a["name"]: continue # dupes of Dialog
  desc = action_desc(actions_unique, a)
  if not desc:
    continue
  desc = LS(desc); # format multiline properly
  action = {"name": a["name"], "detail": action_detail(a), "doc": desc}
  actions_completion.append(action)

actions_completion = sorted(actions_completion, key=lambda k: k["name"])

# dump to file
with open(completion_baf) as yf:
  data = yaml.load(yf)
  data[actions_stanza]["items"] = actions_completion
with open(completion_baf, 'w') as yf:
  yaml.dump(data, yf)
