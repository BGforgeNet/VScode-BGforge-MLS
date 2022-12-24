#!/usr/bin/env python3

from urllib.parse import urljoin
import re


# completion
# alias has no desc of its own
def action_alias_desc(actions, action):
    if action["alias"] is True:
        num = action["n"]
    else:
        num = action["alias"]
    parent = [x for x in actions if x["n"] == num and "alias" not in x][0]
    if "unknown" in parent:
        return False
    return parent["desc"]


# entry point for getting generic desc
def action_desc(actions, action, iesdp_games, iesdp_base_url):
    if "alias" in action:
        desc = action_alias_desc(actions, action)
        if not desc:
            return False
    else:
        desc = action["desc"]

    # replace variables in links
    if "bg2" in action:
        game_name = "bg2"
    else:
        game_name = "bgee"
    desc = action_desc_absolute_urls(desc, iesdp_games, game_name, iesdp_base_url)

    return desc


# fixes relative/variable links
def action_desc_absolute_urls(desc, games, game_name, iesdp_base_url):
    game = [x for x in games if x["name"] == game_name][0]
    ids = game["ids"].lstrip("/")
    twoda = game["2da"].lstrip("/")
    actions_url = game["actions"]
    desc = desc.replace("{{ ids }}", ids).replace("{{ 2da }}", twoda)

    current_url = urljoin(iesdp_base_url, actions_url.lstrip("/"))
    urls = re.findall(r"\[(.*?)\]\((.*?)\)", desc)
    for url in urls:
        dst = url[1].strip()
        dst_abs = urljoin(current_url, dst)
        desc = re.sub(dst, dst_abs, desc)

    return desc


def append_unique(actions, new_actions):
    for na in new_actions:
        existing = [x for x in actions if x["name"] == na["name"]]
        if len(existing) == 0:
            actions.append(na)
    return actions


def action_detail(action):
    if "params" not in action:
        return "{}()".format(action["name"])
    param_string = ""
    first_param = True
    for p in action["params"]:
        if not first_param:
            param_string = param_string + ", "
        first_param = False
        param_string = param_string + "{}:{}".format(p["type"].upper(), p["name"])
        if "ids" in p:
            param_string = param_string + "*{}".format(p["ids"].title())
    return "{}({})".format(action["name"], param_string)
