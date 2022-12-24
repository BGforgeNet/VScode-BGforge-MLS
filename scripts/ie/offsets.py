import sys, re
from bs4 import BeautifulSoup
from markdown import markdown
from collections import OrderedDict


def get_offset_prefix(file_version, data_file_name):  # eff_v2 / body.yml
    base = re.sub("_v.*", "", file_version)
    version = re.sub(".*_v", "", file_version)
    version = version.replace(".", "")
    if version == "1":
        version = ""

    # custom prefix for some data structures
    fbase = data_file_name.replace(".yml", "")
    fbase_map = {"header": "", "body": "", "extended_header": "head"}
    try:
        suffix = fbase_map[fbase]
    except:
        suffix = fbase

    prefix = "{}{}_".format(base, version)
    if suffix != "":
        prefix = prefix + "{}_".format(suffix)
    prefix = prefix.upper()
    return prefix


def get_offset_id(item, prefix):
    # custom IElib id
    if "id" in item:
        return prefix + item["id"]

    # no custom id, constructing from description
    desc = item["desc"]
    # iid = desc.split('\n', 1)[0].lower()
    iid = desc.lower()

    # strip links
    html = markdown(iid)
    iid = "".join(BeautifulSoup(html, features="lxml").findAll(text=True))

    # custom replacements
    iid = iid.replace("probability ", "probability")
    iid = iid.replace("usability ", "usability")
    iid = iid.replace("parameter ", "parameter")
    iid = iid.replace("resource ", "resource")
    iid = iid.replace("alternative", "alt")
    iid = iid.replace(".", "")

    iid = iid.replace(" ", "_")
    iid = prefix + iid

    # id must be alnum + '_' only
    if re.match(r"^[a-zA-Z0-9_]+$", iid):
        return iid
    else:
        print('Bad id: "{}". Aborting.'.format(iid))
        sys.exit(1)


def get_offset_size(item):
    if "length" in item:
        return item["length"]
    size_map = {"byte": 1, "char": 1, "word": 2, "dword": 4, "resref": 8, "strref": 4}
    size = size_map[item["type"]]
    if "mult" in item:
        size = size * item["mult"]
    return size


def offsets_to_definition(data, prefix):
    cur_off = 0
    if "offset" in data[0]:
        cur_off = data[0]["offset"]

    items = OrderedDict()
    for i in data:
        if "offset" in i and i["offset"] != cur_off:
            print(
                "Error: offset mismatch. Expected {}, got {} for {}".format(
                    cur_off, i["offset"], i
                )
            )

        size = get_offset_size(i)

        if "unused" in i or "unknown" in i:
            cur_off += size
            continue

        iid = get_offset_id(i, prefix)
        items[iid] = hex(cur_off)
        cur_off += size
    return items
