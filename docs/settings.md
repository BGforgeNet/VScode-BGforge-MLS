## Settings

BGforge MLS contributes a number of settings.

_([How to change settings in VScode](https://code.visualstudio.com/docs/getstarted/settings).)_

### WeiDU
- `bgforge.weidu.path`: Path to WeiDU binary. (Used for hotkey-based [error reporting](https://github.com/BGforgeNet/VScode-BGforge-MLS/#error-reporting).) If WeiDU is in system `PATH`, no changes necessary.
- `bgforge.weidu.game_path`: Full path to IE game. Needed to parse `BAF` and `D`. (Requires WeiDU v247+).

### Fallout SSL
- `bgforge.fallout-ssl.compile`: Path to Fallout SSL `compile.exe` plus compilation options. (Used for hotkey-based [error reporting](https://github.com/BGforgeNet/VScode-BGforge-MLS/#error-reporting).)
- `bgforge.fallout-ssl.output_directory`: Where to put the compiled Fallout SSL scripts. Absolute path or relative to source directory.
- `bgforge.fallout-ssl.headers_directory`: Absolute path to directory containing Fallout headers, searched recursively.
