#!/usr/bin/env python3
# coding: utf-8

from ie_import import *

#parse args
parser = argparse.ArgumentParser(description='Update IE syntax highlighting and completion from IElib', formatter_class=argparse.ArgumentDefaultsHelpFormatter)
parser.add_argument('-s', dest='src_dir', help='header directory', required=True)
parser.add_argument('--completion-weidu', dest='completion_weidu', help='WeiDU completion YAML', required=True)
parser.add_argument('--highlight-weidu', dest='highlight_weidu', help='WeidDU syntax highlight YAML', required=True)
args=parser.parse_args()

#init vars
ielib_url = "https://ielib.bgforge.net"
types_url = ielib_url + "/types"

ielib_data = {
  'ints': {
    'stanza': 'ielib-ints',
    'scope':
    'constant.language.ielib.int',
  },
  'resrefs': {
    'stanza': 'ielib-resref',
    'scope': 'constant.language.ielib.resref',
    'string': True,
  },
  'action_functions': {
    'stanza': 'ielib-action-functions',
    'scope': 'support.function.weidu.action_function',
    'completion_type': COMPLETION_TYPE_function,
  },
  'patch_functions': {
    'stanza': 'ielib-patch-functions',
    'scope': 'entity.name.class.ielib.patch_function',
    'completion_type': COMPLETION_TYPE_function,
  }
}

completion_weidu = args.completion_weidu
highlight_weidu = args.highlight_weidu
src_dir = args.src_dir


def find_file(path, name):
  for root, dirs, files in os.walk(path, followlinks=True):
    if name in files:
      return os.path.join(root, name)

def find_files(path, ext, skip_dirs = [], skip_files = ['iesdp.tpp']):
  flist = []
  for root, dirs, files in os.walk(path, followlinks=True):
    dirs[:] = [d for d in dirs if d not in skip_dirs]
    for f in files:
      if f.lower().endswith(ext.lower()) and not f in skip_files:
        flist.append(os.path.join(root, f))
  return flist


# CONSTANTS
regex_numeric = r"^(\w+)\s*=\s*(\w+)" # can be hex or bin numbers
regex_text = r"^TEXT_SPRINT\s+(\w+)\s+~(\w+)~"

def defines_from_file(path, regex):
  defines = {}
  with open(path, "r") as fh:
    for line in fh: # some monkey code
      constant = re.match(regex, line)
      if constant:
        defines[constant.group(1)] = constant.group(2)
  return defines

# get various defines from header files
define_files = find_files(src_dir, "tpp", skip_dirs=["functions"])
int_defines = {}
resref_defines = {}
for df in define_files:
  new_int_defines = defines_from_file(df, regex_numeric)
  int_defines = {**int_defines, **new_int_defines}
  new_resref_defines = defines_from_file(df, regex_text)
  resref_defines = {**resref_defines, **new_resref_defines}

int_defines = [{"name": x, "detail": "int {} = {}".format(x, int_defines[x]), "doc": "IElib define"} for x in int_defines]
resref_defines = [{"name": x, "detail": 'resref {} = "{}"'.format(x, resref_defines[x]), "doc": "IElib define"} for x in resref_defines]
ielib_data['ints']['items'] = int_defines
ielib_data['resrefs']['items'] = resref_defines

# END CONSTANTS



# FUNCTIONS
def func_to_item(func):
  item = {}
  item["name"] = func["name"]
  item["detail"] = "{} function {}".format(func["type"], func["name"])
  text = "{}\n\n".format(func["desc"])
  if "int_params" in func:
    text += params_to_md(func, "int_params")
  if "string_params" in func:
    text += params_to_md(func, "string_params")
  if "return" in func:
    text += rets_to_md(func)
  item["doc"] = LS(text) # multiline format
  item['type'] = func['type']
  return(item)

def params_to_md(func, ptype):
  type_map = {"string_params": "STR_VAR", "int_params": "INT_VAR"}
  text = "| **{}** | **Description** | **Type** | **Default** |\n|:-|:-|:-|:-|".format(type_map[ptype])
  params = sorted(func[ptype], key=lambda k: k['name'])
  for sp in params:
    default = get_default(sp, func)
    name = sp["name"]
    if "required" in sp and sp["required"] == 1:
      default = "_required_"
    ptype = get_ptype(sp["type"])
    text = text + "\n| {} | {} | {} | {} |".format(name, sp["desc"], ptype, default)
  text = text + "\n"
  return text

def rets_to_md(func):
  text = "\n| RET vars | Description | Type |\n|:--------|:-----|:--------|"
  rets = sorted(func["return"], key=lambda k: k['name'])
  for r in rets:
    rtype = get_ptype(r["type"])
    text = text + "\n| {} | {} | {} |".format(r["name"], r["desc"], rtype)
  text = text + "\n"
  return text

def get_ptype(tname):
  try:
    ptype = [x for x in types if x["name"] == tname][0]
    ptext = "[{}]({}/#{})".format(tname, types_url, tname)
    return ptext
  except:
    return tname

def get_default(param, func):
  if "default" in param:
    default = param["default"]
    return default
  ptype = param["type"]
  if "defaults" in func and ptype in func["defaults"]:
    default = func["defaults"][ptype]
    return default
  return ""


data_dir = os.path.join(src_dir, "docs", "data")
functions_dir = os.path.join(data_dir, "functions")
function_files = find_files(functions_dir, "yml")
types_file = os.path.join(data_dir, "types.yml")
action_functions = []
patch_functions = []
with open(types_file) as yf:
  types = yaml.load(yf)
for f in function_files:
  with open(f) as yf:
    data = yaml.load(yf)
  data = sorted(data, key=lambda k: k['name'])
  for i in data:
    item = func_to_item(i)
    if item['type'] == 'action':
      action_functions.append(item)
    if item['type'] == 'patch':
      patch_functions.append(item)

ielib_data['action_functions']['items'] = action_functions
ielib_data['patch_functions']['items'] = patch_functions

### END FUNCTIONS

dump_completion(completion_weidu, ielib_data)
dump_highlight(highlight_weidu, ielib_data)
