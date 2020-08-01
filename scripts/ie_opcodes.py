
#!/usr/bin/env python3
# coding: utf-8

def opcode_name_to_id(name):
  # these are replace anywhere in the string
  replacements = {
    ' ': '_',
    ')': '_',
    '(': '_',
    ':': '',
    '-': '_',
    ',': '',
    '&': '',
    '.': '',
    "'": '',
    '/': '_',
    'modifier': 'mod',
    'resistance': 'resist',
    'removal_remove': 'remove',
    'high_level_ability': 'HLA',
    '____': '_',
    '___': '_',
    '__': '_',
    '__': '_' # intentional
  }
  # these are stripped from left part
  lstrip = [
    'item_',
    'graphics_',
    'spell_effect_', # should be before _spell
    'spell_',
    'stat_',
    'state_',
    'summon_',
  ]
  name = name.lower()
  for r in replacements:
    name = name.replace(r, replacements[r])
  name = name.rstrip('_').lstrip('_')
  for l in lstrip:
    if name.startswith(l):
      name = name[len(l):]
  return name
