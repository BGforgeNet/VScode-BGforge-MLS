import re
import sys
from collections import OrderedDict

from bs4 import BeautifulSoup
from markdown import markdown


def get_offset_prefix(file_version, data_file_name):  # eff_v2 / body.yml
    base = re.sub("_v.*", "", file_version)
    version = re.sub(".*_v", "", file_version)
    version = version.replace(".", "")
    if version == "1":
        version = ""

    # custom prefix for some data structures
    fbase = data_file_name.replace(".yml", "")
    fbase_map = {"header": "", "body": "", "extended_header": "head"}
    suffix = fbase_map.get(fbase, fbase)

    prefix = f"{base}{version}_"
    if suffix != "":
        prefix = prefix + f"{suffix}_"
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
    # no good id found, aborting
    print('Bad id: "{iid}". Aborting.')
    sys.exit(1)


def get_offset_size(item):
    if "length" in item:
        return item["length"]
    size_map = {"byte": 1, "char": 1, "word": 2, "dword": 4, "resref": 8, "strref": 4}
    size = size_map[item["type"]]
    if "mult" in item:
        size = size * item["mult"]
    return size


def validate_offset(current_offset, item):
    if "offset" in item and item["offset"] != current_offset:
        print(f"Error: offset mismatch. Expected {current_offset}, got {item['offset']} for {item}")
        sys.exit(1)


def offsets_to_definition(data, prefix):
    cur_off = 0
    if "offset" in data[0]:
        cur_off = data[0]["offset"]

    items = OrderedDict()
    for i in data:
        validate_offset(cur_off, i)

        size = get_offset_size(i)

        if "unused" in i or "unknown" in i:
            cur_off += size
            continue

        iid = get_offset_id(i, prefix)
        items[iid] = hex(cur_off)
        cur_off += size
    return items
