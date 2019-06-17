#!/usr/bin/env python3
# coding: utf-8

import sys, os
import oyaml as yaml

functions_yaml = sys.argv[1]
sfall_functions_stanza = "sfall-functions"
sfall_hooks_stanza = "hooks"
hooks_yaml = sys.argv[2]
completion_yaml = sys.argv[3]

new_functions = []
# functions
with open(functions_yaml) as yf:
  categories = yaml.load(yf)
  for category in categories:
    cdoc = ""
    # common catefory documentation
    if 'doc' in category:
      cdoc = category['doc']

    # individual functions
    functions = category['items']
    functions = sorted(functions, key=lambda k: k['name']) 

    for f in functions:
      name = f['name']
      detail = f['detail']
      doc = ""
      if 'doc' in f:
        doc = f['doc']

      # if caterory doc is not empty
      if cdoc != "": 
        if doc == "": # if function doc is empty
          doc = cdoc  # replace
        else:
          doc += '\n' + cdoc # append

      if doc == "":
        new_functions.append({'name': name, 'detail': detail}) # if doc is still empty
      else:
        new_functions.append({'name': name, 'detail': detail, 'doc': doc}) # proper record, all fields

# hooks
new_hooks = []
with open(hooks_yaml) as yf:
  hooks = yaml.load(yf)
  hooks = sorted(hooks, key=lambda k: k['name']) # alphabetical sort

  for h in hooks:
    name = h['name']
    doc = h['doc']
    codename = "HOOK_" + name.upper()
    new_hooks.append({'name': codename, 'doc': doc})

# dump to completion
with open(completion_yaml) as yf:
  data = yaml.load(yf)
  data[sfall_functions_stanza] = {'type': 3, 'items': new_functions} # type: function
  data[sfall_hooks_stanza] = {'type': 21, 'items': new_hooks} # type: constant
with open(completion_yaml, 'w') as yf:
  yaml.dump(data, yf, default_flow_style=False, width=4096)
