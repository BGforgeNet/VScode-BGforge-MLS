#!/usr/bin/env python3
# coding: utf-8

import sys, yaml, json

with open(sys.argv[1]) as yf:
  data = yaml.load(yf)
with open(sys.argv[2], 'w') as jf:
  json.dump(data, jf, indent=2)
