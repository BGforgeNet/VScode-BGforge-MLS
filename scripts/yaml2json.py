#!/usr/bin/env python3

import json
import sys

import ruamel.yaml

yaml = ruamel.yaml.YAML(typ="rt")
yaml.width = 4096
yaml.indent(mapping=2, sequence=4, offset=2)

with open(sys.argv[1], encoding="utf8") as yf:
    data = yaml.load(yf)

for rep_item in data["repository"]:  # allow to use shorthand syntax in yaml
    rep_data = data["repository"][rep_item]
    if ("name" in rep_data) and ("patterns" in rep_data):
        for item in rep_data["patterns"]:
            if "name" not in item:
                item["name"] = rep_data["name"]

with open(sys.argv[2], "w", encoding="utf8") as jf:
    json.dump(data, jf, indent=2)
