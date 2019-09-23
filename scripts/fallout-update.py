#!/usr/bin/env python3
# coding: utf-8

import sys, os
import oyaml as yaml

functions_yaml = sys.argv[1]
sfall_functions_stanza = "sfall-functions"
sfall_hooks_stanza = "hooks"
hooks_yaml = sys.argv[2]
completion_yaml = sys.argv[3]
highlight_yaml = sys.argv[4]

completion_functions = []
completion_hooks = []
highlight_functions = []
highlight_hooks = []

# functions
with open(functions_yaml) as yf:
  categories = yaml.load(yf)
  categories = sorted(categories, key=lambda k: k['name']) # less diff noise
  for category in categories:
    print(category['name'])
    cdoc = ""
    # common catefory documentation
    if 'doc' in category:
      cdoc = category['doc']

    # individual functions
    if 'items' in category:
      functions = category['items']
      functions = sorted(functions, key=lambda k: k['name']) # less diff noise

      for f in functions:
        name = f['name']
        # highlighting first
        if name != '^': # sorry, exponentiation
          highlight_functions.append({ 'match': "\\b(?i)({})\\b".format(name) })
        # and now completion
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
          completion_functions.append({'name': name, 'detail': detail}) # if doc is still empty
        else:
          completion_functions.append({'name': name, 'detail': detail, 'doc': doc}) # proper record, all fields

# hooks
with open(hooks_yaml) as yf:
  hooks = yaml.load(yf)
  hooks = sorted(hooks, key=lambda k: k['name']) # alphabetical sort

  for h in hooks:
    name = h['name']
    doc = h['doc']
    codename = "HOOK_" + name.upper()
    completion_hooks.append({'name': codename, 'doc': doc})
    highlight_hooks.append({ 'match': "\\b({})\\b".format(codename) })

# dump to completion
with open(completion_yaml) as yf:
  data = yaml.load(yf)
  data[sfall_functions_stanza] = {'type': 3, 'items': completion_functions} # type: function
  data[sfall_hooks_stanza] = {'type': 21, 'items': completion_hooks} # type: constant
with open(completion_yaml, 'w') as yf:
  yaml.dump(data, yf, default_flow_style=False, width=4096)


# dump to syntax highlight
with open(highlight_yaml) as yf:
  data = yaml.load(yf)
  data['repository']['sfall-functions']['patterns'] = highlight_functions
  data['repository']['hooks']['patterns'] = highlight_hooks
with open(highlight_yaml, 'w') as yf:
  yaml.dump(data, yf, default_flow_style=False, width=4096)
