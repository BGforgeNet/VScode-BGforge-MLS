## Settings

BGforge MLS contributes a number of settings.

_([How to change settings in VScode](https://code.visualstudio.com/docs/getstarted/settings).)_

### General

- `bgforge.validateOnSave`: Run and show diagnostics when saving files.
- `bgforge.validateOnChange`: Run and show diagnostics repeatedly as you edit the files. This can be disk intensive, as validation requires files to be saved to disk.

### WeiDU

- `bgforge.weidu.path`: Path to WeiDU binary. Alternatively, you can add WeiDU to system PATH and leave default here.
- `bgforge.weidu.gamePath`: Absolute path to an IE game. Needed to use parse feature on BAF and D files.

### Fallout SSL

- `bgforge.falloutSSL.compilePath`: Path to compile.exe from sfall modders pack. Alternatively, you can add compile.exe to system PATH and leave default here.
- `bgforge.falloutSSL.compileOptions`: Compilation options for compile.exe from sfall modders pack.
- `bgforge.falloutSSL.outputDirectory`: Where to put the compiled Fallout SSL scripts, absolute path. Default is to put compiled scripts next to the source file. You'll probably want to set this to data/scripts of your Fallout 2 game directory."
- `bgforge.falloutSSL.headersDirectory`: Path to an additional directory with Fallout headers to scan for defines.\nLeave empty if all your headers are inside workspace directory. Workspace is always scanned.
