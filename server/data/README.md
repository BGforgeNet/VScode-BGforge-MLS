This directory contains source data for completion and hover tooltip.

Base files are updated manually, others by scripts.

YAML format is chosen for its brevity compared to JSON, as well as possibility to use comments.

The data is then processed into separate hover and completion jsons.

Example items:
```
base-functions:
  type: 3
  items:
    - name: set_npc_stat_min
      detail: void set_npc_stat_min(int stat, int value)
      doc: |-
        The `set_stat_max/min` functions can be used to set the valid ranges on stats. Values returned by `get_current_stat` will be clamped to this range. The `set_pc_` function only affects the player, the `set_npc_` functions only affects other critters, and the `set_` functions affects both.
    - name: set_npc_stat_max
    ...
```
Item types [reference](#https://docs.microsoft.com/en-us/dotnet/api/microsoft.visualstudio.languageserver.protocol.completionitemkind?view=visualstudiosdk-2017).
