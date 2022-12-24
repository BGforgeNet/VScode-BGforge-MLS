#!/usr/bin/env python3

import json
import sys
import yaml

with open(sys.argv[1]) as jf:
    data = json.load(jf)
with open(sys.argv[2], "w") as yf:
    yaml.dump(data, yf, default_flow_style=False)
