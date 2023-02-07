import os
import ruamel.yaml
from .offsets import string_to_id

yaml = ruamel.yaml.YAML(typ="rt")


def get_itemtypes(iesdp_file_formats_dir):
    """
    Returns IESDP item types list {id, desc, value}
    """
    source_file = os.path.join(iesdp_file_formats_dir, "item_types.yml")
    with open(source_file, encoding="utf8") as fhandle:
        items = yaml.load(fhandle)
    itypes = []
    for i in items:
        iid = get_itemtype_id(i)
        if iid == "ITEMTYPE_unknown":
            continue
        itypes.append({"id": iid, "desc": i["type"], "value": i["code"]})
    return itypes


def get_itemtype_id(item):
    """
    Tries to get an id for an item type
    """
    iprefix = "ITEMTYPE_"
    # custom id
    if "id" in item:
        return iprefix + item["id"]
    # no custom id, constructing from description
    iid = string_to_id(item["type"], iprefix)
    return iid


def save_itemtypes_ielib(ielib_structures_dir, itypes):
    """
    Saves item types to IElib structures/item_types.tpp
    """
    dest_file = os.path.join(ielib_structures_dir, "item_types.tpp")
    text = ""
    for itype in itypes:
        text += f"{itype['id']} = {itype['value']}\n"
    with open(dest_file, "w", encoding="utf8") as fhandle:
        print(text, file=fhandle)


def get_itemtypes_isense(itypes):
    """
    Prepares item types list for intellisense
    """
    isense = []
    for itype in itypes:
        iid = itype["id"]
        detail = f"int {iid} = {itype['value']}"
        doc = itype["desc"]
        item = {"name": iid, "detail": detail, "doc": doc}
        isense.append(item)
    return isense
