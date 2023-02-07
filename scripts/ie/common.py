# common functions to dump IElib/IESDP data to completion and highlight
import functools
import os
import sys
import textwrap

import ruamel.yaml

# https://stackoverflow.com/questions/57382525/can-i-control-the-formatting-of-multiline-strings
from ruamel.yaml.scalarstring import LiteralScalarString

yaml = ruamel.yaml.YAML(typ="rt")
yaml.width = 4096
yaml.indent(mapping=2, sequence=4, offset=2)


def litscal(string):
    return LiteralScalarString(textwrap.dedent(string))


COMPLETION_TYPE_CONSTANT = 21
COMPLETION_TYPE_FUNCTION = 3


def find_file(path, name):
    for root, dirs, files in os.walk(path, followlinks=True):  # pylint: disable=unused-variable
        if name in files:
            return os.path.join(root, name)
    return None


def find_files(path, ext, skip_dirs=None, skip_files=None):
    if skip_dirs is None:
        skip_dirs = []
    if skip_files is None:
        skip_files = ["iesdp.tpp"]
    flist = []
    for root, dirs, files in os.walk(path, followlinks=True):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        for fname in files:
            if fname.lower().endswith(ext.lower()) and fname not in skip_files:
                flist.append(os.path.join(root, fname))
    return flist


# https://stackoverflow.com/questions/42899405/sort-a-list-with-longest-items-first
def sort_longer_first(key1, key2):
    for key12, key22 in zip(key1, key2):
        if key12 < key22:
            return -1
        if key22 < key12:
            return 1
    if len(key1) > len(key2):
        return -1
    if len(key2) > len(key1):
        return 1
    return 0


def dump_completion(fpath, iedata):
    # dump to completion
    with open(fpath, encoding="utf8") as yaf:
        data = yaml.load(yaf)
    for k in iedata:
        ied = iedata[k]
        stanza = ied["stanza"]
        try:
            ctype = ied["completion_type"]
        except:  # noqa: E722 # pylint: disable=bare-except
            ctype = COMPLETION_TYPE_CONSTANT
        if stanza not in data:
            data.insert(1, stanza, {"type": ctype})
        data[stanza]["type"] = ctype

        items = sorted(ied["items"], key=lambda k: k["name"])
        data[stanza]["items"] = items
    check_completion(data)
    with open(fpath, "w", encoding="utf8") as yaf:
        yaml.dump(data, yaf)


def check_completion(data):
    items = []
    for dataitem in data:
        items += [i["name"] for i in data[dataitem]["items"]]
    allow_dupes = ["EVALUATE_BUFFER"]  # this is used in both vars and compilation
    dupes = {x for x in items if items.count(x) > 1 and x not in allow_dupes}
    if len(dupes) > 0:
        print(f"Error: duplicated completion items found: {dupes}")
        sys.exit(1)


def dump_highlight(fpath, iedata):
    # dump to syntax highlight
    with open(fpath, encoding="utf8") as yaf:
        data = yaml.load(yaf)
    for k in iedata:
        ied = iedata[k]
        stanza = ied["stanza"]
        repository = data["repository"]

        if stanza not in repository:
            repository.insert(1, stanza, {"name": ied["scope"]})
        repository[stanza]["name"] = ied["scope"]

        # string items get additional %' around
        string_items = [x for x in ied["items"] if "string" in ied]

        items = [x["name"] for x in ied["items"]]
        items = sorted(items, key=functools.cmp_to_key(sort_longer_first))
        items = [{"match": f"\\b({x})\\b"} for x in items]

        string_items = [x["name"] for x in string_items]
        string_items = sorted(string_items, key=functools.cmp_to_key(sort_longer_first))
        string_items = [{"match": f"(%{x}%)"} for x in string_items]

        items = string_items + items
        repository[stanza]["patterns"] = items
    with open(fpath, "w", encoding="utf8") as yaf:
        yaml.dump(data, yaf)


def dump_definition(prefix, items, structures_dir):
    """
    Dump dict of items (IESDP constants, usually offsets) to iesdp.tpp in the corresponding IElib dir

    @arg prefix - file format from which items are source, e.g. "EFF_V2"
    @arg items - dict {name: value}
    @arg structures_dir - path to ielib/structures
    """
    output_dir = os.path.join(structures_dir, prefix.lower().replace("_", ""))
    output_file = os.path.join(output_dir, "iesdp.tpp")
    os.makedirs(output_dir, exist_ok=True)
    text = ""
    sorted_items = dict(sorted(items.items()))
    for i in sorted_items:
        text += f"{i} = {items[i]}\n"
    with open(output_file, "w", encoding="utf8") as fhandle:
        print(text, file=fhandle)


# remove {% capture note %} {% endcapture %} {% include note.html %}
def strip_liquid(text):
    text = text.replace("{% capture note %}", "")
    text = text.replace("{% endcapture %} {% include note.html %}", "")
    text = text.replace("{% endcapture %} {% include info.html %}", "")
    return text
