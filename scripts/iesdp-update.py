#!/usr/bin/env python3
# coding: utf-8

from ie_import import *

# parse args
parser = argparse.ArgumentParser(
    description="Get updates from IESDP",
    formatter_class=argparse.ArgumentDefaultsHelpFormatter,
)
parser.add_argument("-s", dest="iesdp_dir", help="iesdp directory", required=True)
parser.add_argument(
    "--completion-baf", dest="competion_baf", help="BAF completion YAML", required=True
)
parser.add_argument(
    "--highlight-baf", dest="highlight_baf", help="BAF highlight YAML", required=True
)
parser.add_argument(
    "--completion-weidu",
    dest="completion_weidu",
    help="WeiDU completion YAML",
    required=True,
)
parser.add_argument(
    "--highlight-weidu",
    dest="highlight_weidu",
    help="WeiDU highlight YAML",
    required=True,
)
parser.add_argument(
    "--ielib-dir", dest="ielib_dir", help="IElib directory", required=True
)
args = parser.parse_args()

# init vars
iesdp_dir = args.iesdp_dir

# ielib
ielib_dir = args.ielib_dir
file_formats_dir = os.path.join(iesdp_dir, "_data", "file_formats")
# opcodes
opcode_file = os.path.join(ielib_dir, "misc", "opcode.tpp")
opcode_dir = os.path.join(iesdp_dir, "_opcodes")
opcodes = []
opcodes_ee = []
ee_min_opcode = 318  # everything lower tha this this doesn't make it to opcode_ee.tpp
tpp_text = ""
skip_opcode_names = ["empty", "crash", "unknown"]

# actions
actions_dir = os.path.join(iesdp_dir, "_data", "actions")
highlight_baf = args.highlight_baf
completion_baf = args.competion_baf
actions = []
actions_stanza = "actions"

# iesdp
completion_weidu = args.completion_weidu
highlight_weidu = args.highlight_weidu
file_formats_dir = os.path.join(iesdp_dir, "_data", "file_formats")


iesdp_base_url = "https://gibberlings3.github.io/iesdp/"
iesdp_actions_url = "{}/scripting/actions".format(iesdp_base_url)
iesdp_games_file = os.path.join(iesdp_dir, "_data", "games.yml")
with open(iesdp_games_file) as yf:
    iesdp_games = yaml.load(yf)

### OPCODES
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
    name_count = len(
        [i for i in opcodes_unique if i == name]
    )  # some name collude, need to make unique
    if name_count > 0:
        name = name + "_{}".format(name_count + 1)
    opcodes_unique[name] = o["n"]

for o in opcodes_unique:
    tpp_text += "OPCODE_{} = {}\n".format(o, opcodes_unique[o])

with open(opcode_file, "w") as f:
    print(tpp_text, file=f)
### END OPCODES


### ACTIONS
files = find_files(actions_dir, "yml")
for f in files:
    with open(f) as yf:
        action = yaml.load(yf)
    if ("bg2" in action and action["bg2"] == 1) or (
        "bgee" in action and action["bgee"] == 1
    ):  # just bg2/ee actions for now
        actions.append(action)

actions = sorted(actions, key=lambda k: k["n"])

# highlight
actions_highlight = [x["name"] for x in actions]
actions_highlight = set(actions_highlight)
actions_highlight_patterns = [
    {"match": "\\b({})\\b".format(x)} for x in actions_highlight
]
actions_highlight_patterns = sorted(
    actions_highlight_patterns, key=lambda k: k["match"]
)
# dump to file
with open(highlight_baf) as yf:
    data = yaml.load(yf)
    data["repository"][actions_stanza]["patterns"] = actions_highlight_patterns
with open(highlight_baf, "w") as yf:
    yaml.dump(data, yf)

actions_unique = []
parents_bg2 = [x for x in actions if "bg2" in x and not "alias" in x]
aliases_bg2 = [x for x in actions if "bg2" in x and "alias" in x]
parents_bgee = [
    x for x in actions if "bgee" in x and not "bg2" in x and not "alias" in x
]
aliases_bgee = [x for x in actions if "bgee" in x and not "bg2" in x and "alias" in x]

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
    desc = action_desc(actions_unique, a, iesdp_games, iesdp_base_url)
    if not desc:
        continue
    desc = LS(desc)
    # format multiline properly
    desc = strip_liquid(desc)
    action = {"name": a["name"], "detail": action_detail(a), "doc": desc}
    actions_completion.append(action)

actions_completion = sorted(actions_completion, key=lambda k: k["name"])

# dump to file
with open(completion_baf) as yf:
    data = yaml.load(yf)
    data[actions_stanza]["items"] = actions_completion
with open(completion_baf, "w") as yf:
    yaml.dump(data, yf)
### END ACTIONS


### DATA
# data lists:
# chars, lbytes, words, dwords, resrefs, strrefs, other


chars = []
lbytes = []
words = []
dwords = []
resrefs = []
strrefs = []
other = []
formats = os.listdir(file_formats_dir)
structures_dir = os.path.join(ielib_dir, "structures")

for ff in formats:
    ff_dir = os.path.join(file_formats_dir, ff)

    definition_items = OrderedDict()

    for f in os.listdir(ff_dir):
        if f == "feature_block.yml":  # feature blocks handled separately
            continue
        prefix = get_offset_prefix(ff, f)
        fpath = os.path.join(ff_dir, f)
        with open(fpath) as yf:
            offsets = yaml.load(yf)

        new_definition_items = offsets_to_definition(offsets, prefix)
        definition_items = {**definition_items, **new_definition_items}

        offsets_to_completion(
            offsets, prefix, chars, lbytes, words, dwords, resrefs, strrefs, other
        )
    dump_definition(prefix, definition_items, structures_dir)

# feature block
fpath = os.path.join(file_formats_dir, "itm_v1", "feature_block.yml")
with open(fpath) as yf:
    offsets = yaml.load(yf)
prefix = "FX_"
offsets_to_completion(
    offsets, prefix, chars, lbytes, words, dwords, resrefs, strrefs, other
)

definition_items = offsets_to_definition(offsets, prefix)
dump_definition(prefix, definition_items, structures_dir)


# sanitising
for l in [chars, lbytes, words, dwords, resrefs, strrefs, other]:
    # reduce diff noise
    l = sorted(l, key=lambda k: k["name"])
    # check for dupes
    name_list = [x["name"] for x in l]
    l_counted = collections_counter(name_list)
    non_unique = [x for x in l_counted if l_counted[x] > 1]
    if len(non_unique) > 0:
        print("Error: duplicate keys found")
        print(non_unique)
        for nu in non_unique:
            for l in [chars, lbytes, words, dwords, resrefs, strrefs, other]:
                print([x for x in l if x["name"] == nu])
        sys.exit(1)

iesdp_data = {
    "chars": {
        "stanza": "iesdp-char",
        "items": chars,
        "scope": "constant.language.iesdp.char",
    },
    "bytes": {
        "stanza": "iesdp-byte",
        "items": lbytes,
        "scope": "constant.language.iesdp.byte",
    },
    "words": {
        "stanza": "iesdp-word",
        "items": words,
        "scope": "constant.language.iesdp.word",
    },
    "dwords": {
        "stanza": "iesdp-dword",
        "items": dwords,
        "scope": "constant.language.iesdp.dword",
    },
    "resrefs": {
        "stanza": "iesdp-resref",
        "items": resrefs,
        "scope": "constant.language.iesdp.resref",
    },
    "strrefs": {
        "stanza": "iesdp-strref",
        "items": strrefs,
        "scope": "constant.language.iesdp.strref",
    },
    "other": {
        "stanza": "iesdp-other",
        "items": other,
        "scope": "constant.language.iesdp.other",
    },
}

dump_completion(completion_weidu, iesdp_data)
dump_highlight(highlight_weidu, iesdp_data)
