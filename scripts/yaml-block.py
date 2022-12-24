#!/usr/bin/env python3

import sys
import ruamel.yaml
from ruamel.yaml.scalarstring import LiteralScalarString
import textwrap

yaml = ruamel.yaml.YAML(typ="rt")
yaml.width = 4096
yaml.indent(mapping=2, sequence=4, offset=2)


def LS(s):
    return LiteralScalarString(textwrap.dedent(s))


file = sys.argv[1]

with open(file) as yf:
    data = yaml.load(yf)
for d in data:
    items = data[d]["items"]
    for i in items:
        if "doc" in i:
            new_doc = LS(i["doc"])
            i["doc"] = new_doc
    sorted_items = sorted(items, key=lambda k: k["name"])
    data[d]["items"] = sorted_items

with open(file, "w") as yf:
    yaml.dump(data, yf)
