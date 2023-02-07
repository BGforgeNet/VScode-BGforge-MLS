#!/usr/bin/env python3

import argparse
import os
import sys
from collections import Counter as collections_counter
from collections import OrderedDict
from dataclasses import dataclass

import frontmatter
import ruamel.yaml
from ie import (
    action_desc,
    action_detail,
    append_unique,
    dump_completion,
    dump_definition,
    dump_highlight,
    find_files,
    get_offset_id,
    get_offset_prefix,
    get_offset_size,
    litscal,
    offset_is_unused,
    offsets_to_definition,
    opcode_name_to_id,
    strip_liquid,
    validate_offset,
    get_itemtypes,
    save_itemtypes_ielib,
    get_itemtypes_isense,
)

yaml = ruamel.yaml.YAML(typ="rt")
yaml.width = 4096
yaml.indent(mapping=2, sequence=4, offset=2)


# parse args
parser = argparse.ArgumentParser(
    description="Get updates from IESDP",
    formatter_class=argparse.ArgumentDefaultsHelpFormatter,
)
parser.add_argument("-s", dest="iesdp_dir", help="iesdp directory", required=True)
parser.add_argument("--data-baf", dest="data_baf", help="BAF data YAML", required=True)
parser.add_argument("--highlight-baf", dest="highlight_baf", help="BAF highlight YAML", required=True)
parser.add_argument(
    "--iesdp-file",
    dest="iesdp_file",
    help="IESDP YAML data file for WeiDU",
    required=True,
)
parser.add_argument(
    "--highlight-weidu",
    dest="highlight_weidu",
    help="WeiDU highlight YAML",
    required=True,
)
parser.add_argument("--ielib-dir", dest="ielib_dir", help="IElib directory", required=True)
args = parser.parse_args()

# init vars
IESDP_DIR = args.iesdp_dir
IESDP_FILE_FORMATS_DIR = os.path.join(IESDP_DIR, "_data", "file_formats")
IELIB_DIR = args.ielib_dir
IELIB_STRUCTURES_DIR = os.path.join(IELIB_DIR, "structures")

# opcodes
opcode_file = os.path.join(IELIB_DIR, "misc", "opcode.tpp")
opcode_dir = os.path.join(IESDP_DIR, "_opcodes")
opcodes = []
opcodes_ee = []
EE_MIN_OPCODE = 318  # everything lower tha this this doesn't make it to opcode_ee.tpp
tpp_text = ""  # pylint: disable=invalid-name # not sure why pylint thinks it's a constant
skip_opcode_names = ["empty", "crash", "unknown"]

# actions
actions_dir = os.path.join(IESDP_DIR, "_data", "actions")
highlight_baf = args.highlight_baf
data_baf = args.data_baf
actions = []
ACTIONS_STANZA = "actions"

# iesdp
iesdp_file = args.iesdp_file
highlight_weidu = args.highlight_weidu


IESDP_BASE_URL = "https://gibberlings3.github.io/iesdp/"
IESDP_ACTIONS_URL = f"{IESDP_BASE_URL}/scripting/actions"
iesdp_games_file = os.path.join(IESDP_DIR, "_data", "games.yml")
with open(iesdp_games_file, encoding="utf8") as yf:
    iesdp_games = yaml.load(yf)


@dataclass
class ProcessedIESDPData:
    """
    List of all IESDP items, ready for consumption
    Mainly offsets
    """

    chars: []
    lbytes: []
    words: []
    dwords: []
    resrefs: []
    strrefs: []
    other: []

    def append_generic(self, items):
        """
        Append a prepared list of items into "other" field
        """
        self.other = self.other + items

    def append_offsets(self, offset_data, offset_prefix):
        cur_off = 0
        if "offset" in offset_data[0]:
            cur_off = offset_data[0]["offset"]

        for i in offset_data:
            validate_offset(cur_off, i)

            size = get_offset_size(i)

            if offset_is_unused(i):
                cur_off += size
                continue

            iid = get_offset_id(i, offset_prefix)
            item_off = hex(cur_off)

            detail = f"{i['type']} offset {iid} = {item_off}"
            if "mult" in i:  # multiword, multibyte - etc
                detail = f"multi {detail}"

            item = {"name": iid, "detail": detail, "doc": strip_liquid(i["desc"])}

            if "mult" in i:
                self.other.append(item)
                cur_off += size
                continue

            if i["type"] == "char":
                self.chars.append(item)
            elif i["type"] == "byte":
                self.lbytes.append(item)
            elif i["type"] == "word":
                self.words.append(item)
            elif i["type"] == "dword":
                self.dwords.append(item)
            elif i["type"] == "resref":
                self.resrefs.append(item)
            elif i["type"] == "strref":
                self.strrefs.append(item)
            else:
                self.other.append(item)
            cur_off += size

    def sanitise_list(self, items):
        # reduce diff noise
        items = sorted(items, key=lambda k: k["name"])
        # check for dupes
        names = [x["name"] for x in items]
        items_counted = collections_counter(names)
        non_unique = [x for x in items_counted if items_counted[x] > 1]
        if len(non_unique) > 0:
            print("Error: duplicate keys found")
            print(non_unique)
            for nu_item in non_unique:
                for item_list in [
                    self.chars,
                    self.lbytes,
                    self.words,
                    self.dwords,
                    self.resrefs,
                    self.strrefs,
                    self.other,
                ]:
                    print([x for x in item_list if x["name"] == nu_item])
            sys.exit(1)

    def sanitise(self):
        self.sanitise_list(self.chars)
        self.sanitise_list(self.lbytes)
        self.sanitise_list(self.words)
        self.sanitise_list(self.dwords)
        self.sanitise_list(self.resrefs)
        self.sanitise_list(self.strrefs)
        self.sanitise_list(self.other)


# OPCODES
files = find_files(opcode_dir, "html")
for f in files:
    opcode = frontmatter.load(f)
    if opcode["bg2"] == 1:  # just bg2 opcodes for now
        opcodes.append(opcode)

opcodes = sorted(opcodes, key=lambda k: k["n"])
opcodes_unique = {}
for o in opcodes:
    name = opcode_name_to_id(o["opname"])
    if name in skip_opcode_names:
        continue
    name_count = len([i for i in opcodes_unique if i == name])  # some name collude, need to make unique
    if name_count > 0:
        name = name + f"_{name_count + 1}"
    opcodes_unique[name] = o["n"]

for name, value in opcodes_unique.items():
    tpp_text += f"OPCODE_{name} = {value}\n"

with open(opcode_file, "w", encoding="utf8") as f:
    print(tpp_text, file=f)
# END OPCODES


item_types = get_itemtypes(IESDP_FILE_FORMATS_DIR)
save_itemtypes_ielib(IELIB_STRUCTURES_DIR, item_types)

# ACTIONS
files = find_files(actions_dir, "yml")
for f in files:
    with open(f, encoding="utf8") as yf:
        action = yaml.load(yf)
    if ("bg2" in action and action["bg2"] == 1) or (
        "bgee" in action and action["bgee"] == 1
    ):  # just bg2/ee actions for now
        actions.append(action)

actions = sorted(actions, key=lambda k: k["n"])

# highlight
actions_highlight = [x["name"] for x in actions]
actions_highlight = set(actions_highlight)
actions_highlight_patterns = [{"match": f"\\b({x})\\b"} for x in actions_highlight]
actions_highlight_patterns = sorted(actions_highlight_patterns, key=lambda k: k["match"])
# dump to file
with open(highlight_baf, encoding="utf8") as yf:
    data = yaml.load(yf)
    data["repository"][ACTIONS_STANZA]["patterns"] = actions_highlight_patterns
with open(highlight_baf, "w", encoding="utf8") as yf:
    yaml.dump(data, yf)

actions_unique = []
parents_bg2 = [x for x in actions if "bg2" in x and "alias" not in x]
aliases_bg2 = [x for x in actions if "bg2" in x and "alias" in x]
parents_bgee = [x for x in actions if "bgee" in x and "bg2" not in x and "alias" not in x]
aliases_bgee = [x for x in actions if "bgee" in x and "bg2" not in x and "alias" in x]

# Priority: classic actions > classic aliases > EE in the same order
actions_unique = append_unique(actions_unique, parents_bg2)
actions_unique = append_unique(actions_unique, aliases_bg2)
actions_unique = append_unique(actions_unique, parents_bgee)
actions_unique = append_unique(actions_unique, aliases_bgee)

actions_completion = []
for a in actions_unique:
    if "no_result" in a and a["no_result"]:
        continue
    if "unknown" in a and a["unknown"]:
        continue
    if "Dialogue" in a["name"]:
        continue  # dupes of Dialog
    desc = action_desc(actions_unique, a, iesdp_games, IESDP_BASE_URL)
    if not desc:
        continue
    desc = litscal(desc)
    # format multiline properly
    desc = strip_liquid(desc)
    action = {"name": a["name"], "detail": action_detail(a), "doc": desc}
    actions_completion.append(action)

actions_completion = sorted(actions_completion, key=lambda k: k["name"])

# dump to file
with open(data_baf, encoding="utf8") as yf:
    data = yaml.load(yf)
    data[ACTIONS_STANZA]["items"] = actions_completion
with open(data_baf, "w", encoding="utf8") as yf:
    yaml.dump(data, yf)
# END ACTIONS


# DATA
# data lists:
# chars, lbytes, words, dwords, resrefs, strrefs, other
pod = ProcessedIESDPData([], [], [], [], [], [], [])
formats = os.listdir(IESDP_FILE_FORMATS_DIR)
formats = [x for x in formats if os.path.isdir(os.path.join(IESDP_FILE_FORMATS_DIR, x))]

for ff in formats:
    print(ff)
    ff_dir = os.path.join(IESDP_FILE_FORMATS_DIR, ff)

    definition_items = OrderedDict()

    for f in os.listdir(ff_dir):
        if f == "feature_block.yml":  # feature blocks handled separately
            continue
        print(f)
        prefix = get_offset_prefix(ff, f)
        fpath = os.path.join(ff_dir, f)
        with open(fpath, encoding="utf8") as yf:
            offsets = yaml.load(yf)

        new_definition_items = offsets_to_definition(offsets, prefix)
        definition_items = {**definition_items, **new_definition_items}

        pod.append_offsets(offsets, prefix)
    dump_definition(prefix, definition_items, IELIB_STRUCTURES_DIR)

# feature block
fpath = os.path.join(IESDP_FILE_FORMATS_DIR, "itm_v1", "feature_block.yml")
with open(fpath, encoding="utf8") as yf:
    offsets = yaml.load(yf)
PREFIX_FX = "FX_"
pod.append_offsets(offsets, PREFIX_FX)

definition_items = offsets_to_definition(offsets, PREFIX_FX)
dump_definition(PREFIX_FX, definition_items, IELIB_STRUCTURES_DIR)


# add item types
item_types_isense = get_itemtypes_isense(item_types)
pod.append_generic(item_types_isense)

pod.sanitise()

iesdp_data = {
    "chars": {
        "stanza": "iesdp-char",
        "items": pod.chars,
        "scope": "constant.language.iesdp.char",
    },
    "bytes": {
        "stanza": "iesdp-byte",
        "items": pod.lbytes,
        "scope": "constant.language.iesdp.byte",
    },
    "words": {
        "stanza": "iesdp-word",
        "items": pod.words,
        "scope": "constant.language.iesdp.word",
    },
    "dwords": {
        "stanza": "iesdp-dword",
        "items": pod.dwords,
        "scope": "constant.language.iesdp.dword",
    },
    "resrefs": {
        "stanza": "iesdp-resref",
        "items": pod.resrefs,
        "scope": "constant.language.iesdp.resref",
    },
    "strrefs": {
        "stanza": "iesdp-strref",
        "items": pod.strrefs,
        "scope": "constant.language.iesdp.strref",
    },
    "other": {
        "stanza": "iesdp-other",
        "items": pod.other,
        "scope": "constant.language.iesdp.other",
    },
}

dump_completion(iesdp_file, iesdp_data)
dump_highlight(highlight_weidu, iesdp_data)
