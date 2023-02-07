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
    """
    Tries to get an id for an offset item
    """
    # custom IElib id
    if "id" in item:
        return prefix + item["id"]

    # no custom id, constructing from description
    iid = string_to_id(item["desc"], prefix)
    return iid


def string_to_id(line, prefix):
    """
    Tries to convert a string to an id suitable for a define
    """
    iid = line.lower()

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
    print(f'Bad id: "{iid}". Aborting.')
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
    """
    Check offset item against current offset, fail on mismatch.
    Mismatch probably means a bug in data.
    """
    if "offset" in item and item["offset"] != current_offset:
        print(f"Error: offset mismatch. Expected {current_offset}, got {item['offset']} for {item}")
        sys.exit(1)


def offset_is_unused(offset):
    """
    Checks if an IESDP offset item is unused

    @arg item - an offset loaded from IESDP _data/file_formats
    """
    if "unused" in offset or "unknown" in offset or ("desc" in offset and offset["desc"].lower() == "unknown"):
        return True
    return False


def offsets_to_definition(data, prefix):
    cur_off = 0
    if "offset" in data[0]:
        cur_off = data[0]["offset"]

    items = OrderedDict()
    for i in data:
        validate_offset(cur_off, i)

        size = get_offset_size(i)

        if offset_is_unused(i):
            cur_off += size
            continue

        iid = get_offset_id(i, prefix)
        items[iid] = hex(cur_off)
        cur_off += size
    return items
