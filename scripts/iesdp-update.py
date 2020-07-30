#!/usr/bin/env python3
# coding: utf-8

from ie_import import *

#parse args
parser = argparse.ArgumentParser(description='Get updates from IESDP', formatter_class=argparse.ArgumentDefaultsHelpFormatter)
parser.add_argument('-s', dest='iesdp_dir', help='iesdp directory', required=True)
parser.add_argument('--completion-baf', dest='competion_baf', help='BAF completion YAML', required=True)
parser.add_argument('--highlight-baf', dest='highlight_baf', help='BAF highlight YAML', required=True)
parser.add_argument('--completion-weidu', dest='completion_weidu', help='WeiDU completion YAML', required=True)
parser.add_argument('--highlight-weidu', dest='highlight_weidu', help='WeiDU highlight YAML', required=True)
args=parser.parse_args()

#init vars
iesdp_dir = args.iesdp_dir

# actions
actions_dir = os.path.join(iesdp_dir, "_data", 'actions')
highlight_baf = args.highlight_baf
completion_baf = args.competion_baf
actions = []
actions_stanza = "actions"

# iesdp
completion_weidu = args.completion_weidu
highlight_weidu = args.highlight_weidu
file_formats_dir = os.path.join(iesdp_dir, "_data", 'file_formats')

def get_stanza(dtype):
  try:
    dstanza = stanza[dtype]
  except:
    dstanza = 'iesdp-other'
  return dstanza

iesdp_base_url = "https://gibberlings3.github.io/iesdp/"
iesdp_actions_url = "{}/scripting/actions".format(iesdp_base_url)
iesdp_games_file = os.path.join(iesdp_dir, "_data", 'games.yml')
with open(iesdp_games_file) as yf:
  iesdp_games = yaml.load(yf)


def find_file(path, name):
  for root, dirs, files in os.walk(path, followlinks=True):
    if name in files:
      return os.path.join(root, name)

def find_files(path, ext):
  flist = []
  for root, dirs, files in os.walk(path, followlinks=True):
    for f in files:
      if f.lower().endswith(ext.lower()):
        flist.append(os.path.join(root, f))
  return flist

files = find_files(actions_dir, 'yml')
for f in files:
  with open(f) as yf:
    action = yaml.load(yf)
  if ('bg2' in action and action['bg2'] == 1) or ('bgee' in action and action['bgee'] == 1): # just bg2/ee actions for now
    actions.append(action)

actions = sorted(actions, key=lambda k: k["n"])

# highlight
actions_highlight = [x["name"] for x in actions]
actions_highlight = set(actions_highlight)
actions_highlight_patterns = [{"match": "\\b({})\\b".format(x)} for x in actions_highlight]
actions_highlight_patterns = sorted(actions_highlight_patterns, key=lambda k: k["match"])
# dump to file
with open(highlight_baf) as yf:
  data = yaml.load(yf)
  data["repository"][actions_stanza]["patterns"] = actions_highlight_patterns
with open(highlight_baf, 'w') as yf:
  yaml.dump(data, yf)


# completion
# alias has no desc of its own
def action_alias_desc(actions, action):
  if action["alias"] == True:
    num = action["n"]
  else:
    num = action["alias"]
  parent = [x for x in actions if x['n'] == num and not "alias" in x][0]
  if "unknown" in parent:
    return False
  return parent["desc"]

# entry point for getting generic desc
def action_desc(actions, action):
  if "alias" in action:
    desc = action_alias_desc(actions, action)
    if not desc:
      return False
  else:
    desc = a["desc"]

  # replace variables in links
  if "bg2" in a:
    game_name = "bg2"
  else:
    game_name = "bgee"
  desc = action_desc_absolute_urls(desc, iesdp_games, game_name)

  return desc

# fixes relative/variable links
def action_desc_absolute_urls(desc, games, game_name):
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
    if len(existing) == 0: actions.append(na)
  return actions

def action_detail(action):
  if not "params" in action:
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

actions_unique = []
parents_bg2 = [x for x in actions if "bg2" in x and not "alias" in x]
aliases_bg2 = [x for x in actions if "bg2" in x and "alias" in x]
parents_bgee = [x for x in actions if "bgee" in x and not "bg2" in x and not "alias" in x]
aliases_bgee = [x for x in actions if "bgee" in x and not "bg2" in x and "alias" in x]

# Priority: classic actions > classic aliases > EE in the same order
actions_unique = append_unique(actions_unique, parents_bg2)
actions_unique = append_unique(actions_unique, aliases_bg2)
actions_unique = append_unique(actions_unique, parents_bgee)
actions_unique = append_unique(actions_unique, aliases_bgee)

actions_completion = []
for a in actions_unique:
  if "no_result" in a and a["no_result"]: continue
  if "unknown" in a and a["unknown"]: continue
  if "Dialogue" in a["name"]: continue # dupes of Dialog
  desc = action_desc(actions_unique, a)
  if not desc:
    continue
  desc = LS(desc); # format multiline properly
  action = {"name": a["name"], "detail": action_detail(a), "doc": desc}
  actions_completion.append(action)

actions_completion = sorted(actions_completion, key=lambda k: k["name"])

# dump to file
with open(completion_baf) as yf:
  data = yaml.load(yf)
  data[actions_stanza]["items"] = actions_completion
with open(completion_baf, 'w') as yf:
  yaml.dump(data, yf)

### END ACTIONS


### DATA
def get_prefix(ff_name):
  base = re.sub('_v.*', '', ff_name)
  version = re.sub('.*_v', '', ff_name)
  version = version.replace('.', '')
  if version == '1':
    version = ''
  prefix = "{}{}".format(base, version)
  prefix = prefix.upper() + '_'
  return prefix

def get_id(item, prefix):
  # custom IElib id
  if 'id' in item:
    return prefix + item['id']

  # no custom id, constructing from description
  desc = item['desc']
  # iid = desc.split('\n', 1)[0].lower()
  iid = desc.lower()

  # strip links
  html = markdown(iid)
  iid = ''.join(BeautifulSoup(html, features="lxml").findAll(text=True))

  # custom replacements
  iid = iid.replace('probability ', 'probability')
  iid = iid.replace('usability ', 'usability')
  iid = iid.replace('parameter ', 'parameter')
  iid = iid.replace('resource ', 'resource')
  iid = iid.replace('alternative', 'alt')
  iid = iid.replace('.', '')

  iid = iid.replace(' ', '_')
  iid = prefix + iid

  # id must be alnum + '_' only
  if re.match(r'^[a-zA-Z0-9_]+$', iid):
    return iid
  else:
    print('Bad id: "{}". Aborting.'.format(iid))
    sys.exit(1)

# mutates lists in place
def load_datafile(fpath, prefix, chars, lbytes, words, dwords, resrefs, strrefs, other):
  with open(fpath) as yf:
    data = yaml.load(yf)
  for i in data:
    if 'unused' in i or 'unknown' in i:
      continue
    iid = get_id(i, prefix)

    if 'mult' in i: # multiword, multibyte - etc
      detail = "multi {} {}".format(i['type'], iid)
    else:
      detail = "{} {}".format(i['type'], iid)

    item = {"name": iid, "detail": detail, "doc": i['desc']}

    if 'mult' in i:
      other.append(item)
      continue

    if i['type'] == 'char':
      chars.append(item)
    elif i['type'] == 'byte':
      lbytes.append(item)
    elif i['type'] == 'word':
      words.append(item)
    elif i['type'] == 'dword':
      dwords.append(item)
    elif i['type'] == 'resref':
      resrefs.append(item)
    elif i['type'] == 'strref':
      strrefs.append(item)
    else:
      other.append(item)

chars = []
lbytes = []
words = []
dwords = []
resrefs = []
strrefs = []
other = []
formats = os.listdir(file_formats_dir)
for ff in formats:
  ff_dir = os.path.join(file_formats_dir, ff)
  prefix = get_prefix(ff)
  for f in os.listdir(ff_dir):
    if f == 'feature_block.yml': # feature blocks handled separately
      continue
    fpath = os.path.join(ff_dir, f)
    load_datafile(fpath, prefix, chars, lbytes, words, dwords, resrefs, strrefs, other)

# feature block
fpath = os.path.join(file_formats_dir, 'itm_v1', 'feature_block.yml')
prefix = 'FX_'
load_datafile(fpath, prefix, chars, lbytes, words, dwords, resrefs, strrefs, other)

# sanitising
for l in [chars, lbytes, words, dwords, resrefs, strrefs, other]:
  # reduce diff noise
  l = sorted(l, key=lambda k: k["name"])
  # check for dupes
  name_list = [x['name'] for x in l]
  l_counted = collections_counter(name_list)
  non_unique = [x for x in l_counted if l_counted[x] > 1]
  if len(non_unique) > 0:
    print("Error: duplicate keys found")
    print(non_unique)
    sys.exit(1)

iesdp_data = {
  'chars': {'stanza': 'iesdp-char', 'items': chars, 'scope': 'constant.language.iesdp.char'},
  'bytes': {'stanza': 'iesdp-byte', 'items': lbytes, 'scope': 'constant.language.iesdp.byte'},
  'words': {'stanza': 'iesdp-word', 'items': words, 'scope': 'constant.language.iesdp.word'},
  'dwords': {'stanza': 'iesdp-dword', 'items': dwords, 'scope': 'constant.language.iesdp.dword'},
  'resrefs': {'stanza': 'iesdp-resref', 'items': resrefs, 'scope': 'constant.language.iesdp.resref'},
  'strrefs': {'stanza': 'iesdp-strref', 'items': strrefs, 'scope': 'constant.language.iesdp.strref'},
  'other': {'stanza': 'iesdp-other', 'items': other, 'scope': 'constant.language.iesdp.other'},
}

dump_completion(completion_weidu, iesdp_data)
dump_highlight(highlight_weidu, iesdp_data)
