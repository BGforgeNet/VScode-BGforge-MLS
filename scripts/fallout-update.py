#!/usr/bin/env python3
# coding: utf-8

import sys, os
import oyaml as yaml

functions_yaml = sys.argv[1]
sfall_functions_stanza = "sfall-functions"
hooks_yaml = sys.argv[2]
completion_yaml = sys.argv[3]

# functions pages
with open(functions_yaml) as yf:
  new_functions = []
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

# dump to completion
with open(completion_yaml) as yf:
  data = yaml.load(yf)
  data[sfall_functions_stanza] = {'type': 3, 'items': new_functions}
with open(completion_yaml, 'w') as yf:
  yaml.dump(data, yf, default_flow_style=False, width=4096)
