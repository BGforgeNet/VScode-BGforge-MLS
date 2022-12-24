#!/usr/bin/env python3

# common functions to dump IElib/IESDP data to completion and highlight
import sys, os, re
import argparse
from collections import OrderedDict
from collections import Counter as collections_counter
from urllib.parse import urljoin
from bs4 import BeautifulSoup
from markdown import markdown
import functools
import frontmatter

from ie_actions import *
from ie_offsets import *
from ie_opcodes import *

import ruamel.yaml

yaml = ruamel.yaml.YAML(typ="rt")
yaml.width = 4096
yaml.indent(mapping=2, sequence=4, offset=2)
# https://stackoverflow.com/questions/57382525/can-i-control-the-formatting-of-multiline-strings
from ruamel.yaml.scalarstring import LiteralScalarString
import textwrap


def LS(s):
    return LiteralScalarString(textwrap.dedent(s))


COMPLETION_TYPE_constant = 21
COMPLETION_TYPE_function = 3


def find_file(path, name):
    for root, dirs, files in os.walk(path, followlinks=True):
        if name in files:
            return os.path.join(root, name)


def find_files(path, ext, skip_dirs=[], skip_files=["iesdp.tpp"]):
    flist = []
    for root, dirs, files in os.walk(path, followlinks=True):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        for f in files:
            if f.lower().endswith(ext.lower()) and not f in skip_files:
                flist.append(os.path.join(root, f))
    return flist


# https://stackoverflow.com/questions/42899405/sort-a-list-with-longest-items-first
def sort_longer_first(s, t):
    for p, q in zip(s, t):
        if p < q:
            return -1
        if q < p:
            return 1
    if len(s) > len(t):
        return -1
    elif len(t) > len(s):
        return 1
    return 0


def dump_completion(fpath, iedata):
    # dump to completion
    with open(fpath) as yf:
        data = yaml.load(yf)
    for k in iedata:
        ied = iedata[k]
        stanza = ied["stanza"]
        try:
            ctype = ied["completion_type"]
        except:
            ctype = COMPLETION_TYPE_constant
        if not stanza in data:
            data.insert(1, stanza, {"type": ctype})
        data[stanza]["type"] = ctype

        items = sorted(ied["items"], key=lambda k: k["name"])
        data[stanza]["items"] = items
    check_completion(data)
    with open(fpath, "w") as yf:
        yaml.dump(data, yf)


def check_completion(data):
    items = []
    for d in data:
        items += [i["name"] for i in data[d]["items"]]
    allow_dupes = ["EVALUATE_BUFFER"]  # this is used in both vars and compilation
    dupes = set([x for x in items if items.count(x) > 1 and not x in allow_dupes])
    if len(dupes) > 0:
        print("Error: duplicated completion items found: {}".format(dupes))
        sys.exit(1)


def dump_highlight(fpath, iedata):
    # dump to syntax highlight
    with open(fpath) as yf:
        data = yaml.load(yf)
    for k in iedata:
        ied = iedata[k]
        stanza = ied["stanza"]
        repository = data["repository"]

        if not stanza in repository:
            repository.insert(1, stanza, {"name": ied["scope"]})
        repository[stanza]["name"] = ied["scope"]

        # string items get additional %' around
        string_items = [x for x in ied["items"] if "string" in ied]

        items = [x["name"] for x in ied["items"]]
        items = sorted(items, key=functools.cmp_to_key(sort_longer_first))
        items = [{"match": "\\b({})\\b".format(x)} for x in items]

        string_items = [x["name"] for x in string_items]
        string_items = sorted(string_items, key=functools.cmp_to_key(sort_longer_first))
        string_items = [{"match": "(%{}%)".format(x)} for x in string_items]

        items = string_items + items
        repository[stanza]["patterns"] = items
    with open(fpath, "w") as yf:
        yaml.dump(data, yf)


# dump dict of items to iesdp.tpp in the corresponding dir
def dump_definition(prefix, items, structures_dir):
    output_dir = os.path.join(structures_dir, prefix.lower().replace("_", ""))
    output_file = os.path.join(output_dir, "iesdp.tpp")
    os.makedirs(output_dir, exist_ok=True)
    text = ""
    for i in items:
        text += "{} = {}\n".format(i, items[i])
    with open(output_file, "w") as fh:
        print(text, file=fh)


# mutates lists in place
def offsets_to_completion(
    data, prefix, chars, lbytes, words, dwords, resrefs, strrefs, other
):
    for i in data:
        if "unused" in i or "unknown" in i:
            continue
        iid = get_offset_id(i, prefix)

        if "mult" in i:  # multiword, multibyte - etc
            detail = "multi {} {}".format(i["type"], iid)
        else:
            detail = "{} {}".format(i["type"], iid)

        item = {"name": iid, "detail": detail, "doc": strip_liquid(i["desc"])}

        if "mult" in i:
            other.append(item)
            continue

        if i["type"] == "char":
            chars.append(item)
        elif i["type"] == "byte":
            lbytes.append(item)
        elif i["type"] == "word":
            words.append(item)
        elif i["type"] == "dword":
            dwords.append(item)
        elif i["type"] == "resref":
            resrefs.append(item)
        elif i["type"] == "strref":
            strrefs.append(item)
        else:
            other.append(item)


# remove {% capture note %} {% endcapture %} {% include note.html %}
def strip_liquid(text):
    text = text.replace("{% capture note %}", "")
    text = text.replace("{% endcapture %} {% include note.html %}", "")
    text = text.replace("{% endcapture %} {% include info.html %}", "")
    return text
