This directory contains source data for completion and hover tooltip.

Base files are updated manually, others by scripts.

YAML format is chosen for its brevity compared to JSON, as well as possibility to use comments.

The data is then processed into separate hover and completion jsons.

Example items:

```yaml
base-functions:
  type: 3 # see type reference link below
  items:
    - name: critter_mod_skill
      type: int
      args:
        - name: who
          type: ObjectPtr
          doc: Must be `dude_obj`. Will not work on other critters.
        - name: skill
          type: int
          doc: "`SKILL_*` from `define.h`"
        - name: amount
          type: int
          doc: Can be negative.
      doc: |-
        Modifies a given skill in a given critter object by a given amount.

        Note that for tagged skills, the amount will be rounded down to the closest even number.

    - name: set_npc_stat_min
      detail: void set_npc_stat_min(int stat, int value) # this field is deprecated. It still works, but is is preferable to define type and args list as above.
      doc: |-
        The `set_stat_max/min` functions can be used to set the valid ranges on stats. Values returned by `get_current_stat` will be clamped to this range. The `set_pc_` function only affects the player, the `set_npc_` functions only affects other critters, and the `set_` functions affects both.

    - name: set_npc_stat_max
    ...
```

Item types [reference](#https://docs.microsoft.com/en-us/dotnet/api/microsoft.visualstudio.languageserver.protocol.completionitemkind?view=visualstudiosdk-2017).
