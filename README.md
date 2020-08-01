## BGforge multilanguage server
[![VScode marketplace](https://img.shields.io/visual-studio-marketplace/i/bgforge.bgforge-mls)](https://marketplace.visualstudio.com/items?itemName=BGforge.bgforge-mls)
[![Support us on Patreon](https://img.shields.io/badge/support%20us-patreon-purple)](https://www.patreon.com/BGforge)
[![Discord chat](https://img.shields.io/discord/420268540700917760?logo=discord)](https://discord.gg/4Yqfggm)

[__Features__](#features)
| [__Screenshots__](#screenshots)
| [__Install__](#installation)
| [__Configure__](#settings)
| [__Discuss__](https://forums.bgforge.net/viewforum.php?f=35)

BGforge MLS is a VScode extension adding support for [Star-Trek Scripting Language](https://falloutmods.fandom.com/wiki/Fallout_1_and_Fallout_2_scripting_-_commands,_reference,_tutorials) (`ssl`) used in Fallout 1 and 2 games, and several file formats (`d`, `baf`, `tp2`, `tra`, `2da`) used by [WeiDU](https://weidu.org/~thebigg/README-WeiDU.html) and [Infinity Engine](https://iesdp.bgforge.net), as well as [Sword Coast Stratagems Scripting Language](https://www.gibberlings3.net/forums/topic/13725-coding-scripts-in-ssl-some-lessons/) (`ssl`/`slb`).

[Roadmap](https://forums.bgforge.net/viewtopic.php?f=35&t=174&p=506), [changelog](docs/changelog.md).

**IE modders:** consider also installing MLS companion library - [IElib](https://github.com/BGforgeNet/BGforge-MLS-IElib).

### Features
- [Syntax highlighting](#screenshots)
- [Completion](#infinity-engine-highlighting-and-completion)
- [Hovers](#fallout-highlighting-and-hovers)
- Signature help
- Diagnostics
- [Error reporting](#error-reporting)
- [More coming](https://forums.bgforge.net/viewtopic.php?f=35&t=174&p=506).

### Installation
1. Search for BGforge in VScode marketplace, like any other extension.
  (Alternatively, download the package from [Github releases](https://github.com/BGforgeNet/vscode-bgforge-mls/releases) tab and install it manually.)
1. Review [general settings](docs/settings.md).
1. Review [tooltip width](docs/tooltip_width.md).
1. Review [file associations](docs/file_associations.md).
1. See [hotkeys](#hotkeys).
1. (Infinity Engine) Enable [custom theme](docs/theme.md).
1. (Infinity Engine) Install [IElib](https://ielib.bgforge.net).

#### Hotkeys
- `CTRL+R`: compile (Fallout `ssl`) or parse (WeiDU `tp2`) file, [reporting errors](#error-reporting) if any.

### Screenshots
#### Infinity Engine highlighting and completion
![infinity highlighting and completion example](resources/infinity.png)

#### Fallout highlighting and hovers
![fallout highlighting and hover example](resources/fallout.png)

#### Error reporting
![error reporting example](resources/error_reporting.png)
