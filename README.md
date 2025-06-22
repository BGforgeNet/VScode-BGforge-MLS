## BGforge multi-language server

[![VScode marketplace](https://img.shields.io/visual-studio-marketplace/i/bgforge.bgforge-mls)](https://marketplace.visualstudio.com/items?itemName=BGforge.bgforge-mls)
[![Patreon](https://img.shields.io/badge/Patreon-donate-FF424D?logo=Patreon&labelColor=141518)](https://www.patreon.com/BGforge)
[![Telegram](https://img.shields.io/badge/telegram-join%20%20%20%20%E2%9D%B1%E2%9D%B1%E2%9D%B1-darkorange?logo=telegram)](https://t.me/bgforge)
[![Discord](https://img.shields.io/discord/420268540700917760?logo=discord&label=discord&color=blue&logoColor=FEE75C)](https://discord.gg/4Yqfggm)
[![IRC](https://img.shields.io/badge/%23IRC-join%20%20%20%20%E2%9D%B1%E2%9D%B1%E2%9D%B1-darkorange)](https://bgforge.net/irc)

[**Features**](#features)
| [**Screenshots**](#screenshots)
| [**Install**](#installation)
| [**Forum**](https://forums.bgforge.net/viewforum.php?f=35)

BGforge MLS is a VScode extension adding support for [Star-Trek Scripting Language](https://falloutmods.fandom.com/wiki/Fallout_1_and_Fallout_2_scripting_-_commands,_reference,_tutorials) (`ssl`) used in Fallout 1 and 2 games, and several file formats (`d`, `baf`, `tp2`, `tra`, `2da`) used by [WeiDU](https://weidu.org/~thebigg/README-WeiDU.html) and [Infinity Engine](https://iesdp.bgforge.net), as well as [Sword Coast Stratagems Scripting Language](https://www.gibberlings3.net/forums/topic/13725-coding-scripts-in-ssl-some-lessons/) (`ssl`/`slb`), and [TBAF](https://forums.bgforge.net/viewtopic.php?t=448).

### Features

- [Syntax highlighting](#screenshots)
- [Completion](#infinity-engine-highlighting-and-completion)
- [Hovers](#fallout-highlighting-and-hovers)
- [Error reporting](#error-reporting)
- Signature help, diagnostics, docstrings, etc. See the [forum](https://forums.bgforge.net/viewforum.php?f=35).
- Embedded cross-platform .ssl compiler (check `falloutSSL.useBuiltInCompiler` option) 

### Installation

1. Search for BGforge in VScode marketplace, like any other extension.
   (Alternatively, download the package from [Github releases](https://github.com/BGforgeNet/vscode-bgforge-mls/releases) tab and install it manually.)
1. Check [general settings](docs/settings.md).
1. Check [file associations](docs/file_associations.md).
1. Check [hotkeys](#hotkeys).
1. Enable [custom theme](docs/theme.md) and [icon theme](docs/icon-theme.md).
1. (Infinity Engine) Install [IElib](https://ielib.bgforge.net).

#### Hotkeys

- `CTRL+R`: compile (Fallout `ssl`) or parse (WeiDU `tp2`) file, [reporting errors](#error-reporting) if any.

### Screenshots

#### Infinity Engine highlighting and completion

![infinity highlighting and completion example](docs/infinity.png)

#### Fallout highlighting and hovers

![fallout highlighting and hover example](docs/fallout.png)

#### Error reporting

![error reporting example](docs/error_reporting.png)


