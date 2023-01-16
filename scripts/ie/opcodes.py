def opcode_name_to_id(name):
    # these are replaced anywhere in the string
    replacements = {
        " ": "_",
        ")": "_",
        "(": "_",
        ":": "",
        "-": "_",
        ",": "",
        "&": "",
        ".": "",
        "'": "",
        "/": "_",
        "modifier": "mod",
        "resistance": "resist",
        "removal_remove": "remove",
        "high_level_ability": "HLA",
        "____": "_",
        "___": "_",
        "__": "_",
    }
    # these are stripped from left part
    left_strip = [
        "item_",
        "graphics_",
        "spell_effect_",  # should be before _spell
        "spell_",
        "stat_",
        "state_",
        "summon_",
    ]
    name = name.lower()
    for orig, repl in replacements.items():
        name = name.replace(orig, repl)
    name = name.replace("__", "_")  # intentional
    name = name.rstrip("_").lstrip("_")
    for left in left_strip:
        if name.startswith(left):
            name = name[len(left):]
    return name
