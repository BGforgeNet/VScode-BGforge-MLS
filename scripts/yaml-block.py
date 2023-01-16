#!/usr/bin/env python3

import sys
import textwrap
import ruamel.yaml
from ruamel.yaml.scalarstring import LiteralScalarString

yaml = ruamel.yaml.YAML(typ="rt")
yaml.width = 4096
yaml.indent(mapping=2, sequence=4, offset=2)


def litscal(string):
    return LiteralScalarString(textwrap.dedent(string))


FILENAME = sys.argv[1]

with open(FILENAME, encoding="utf8") as yf:
    data = yaml.load(yf)
for d in data:
    items = data[d]["items"]
    for i in items:
        if "doc" in i:
            new_doc = litscal(i["doc"])
            i["doc"] = new_doc
    sorted_items = sorted(items, key=lambda k: k["name"])
    data[d]["items"] = sorted_items

with open(FILENAME, "w", encoding="utf8") as yf:
    yaml.dump(data, yf)
