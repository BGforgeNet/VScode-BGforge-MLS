## BGforge multi-language server

[![VScode marketplace](https://img.shields.io/visual-studio-marketplace/i/bgforge.bgforge-mls)](https://marketplace.visualstudio.com/items?itemName=BGforge.bgforge-mls)
[![Patreon](https://img.shields.io/badge/Patreon-donate-FF424D?logo=Patreon&labelColor=141518)](https://www.patreon.com/BGforge)
[![Telegram](https://img.shields.io/badge/telegram-join%20%20%20%20%E2%9D%B1%E2%9D%B1%E2%9D%B1-darkorange?logo=telegram)](https://t.me/bgforge)
[![Discord](https://img.shields.io/discord/420268540700917760?logo=discord&label=discord&color=blue&logoColor=FEE75C)](https://discord.gg/4Yqfggm)
[![IRC](https://img.shields.io/badge/%23IRC-join%20%20%20%20%E2%9D%B1%E2%9D%B1%E2%9D%B1-darkorange)](https://bgforge.net/irc)

[**Features**](#features)
| [**Feature Matrix**](#feature-matrix)
| [**Screenshots**](#screenshots)
| [**Install**](#installation)
| [**Forum**](https://forums.bgforge.net/viewforum.php?f=35)

BGforge MLS is a VScode extension adding support for [Star-Trek Scripting Language](https://falloutmods.fandom.com/wiki/Fallout_1_and_Fallout_2_scripting_-_commands,_reference,_tutorials) (`ssl`) used in Fallout 1 and 2 games, and several file formats (`d`, `baf`, `tp2`, `tra`, `2da`) used by [WeiDU](https://weidu.org/~thebigg/README-WeiDU.html) and [Infinity Engine](https://iesdp.bgforge.net), as well as [Sword Coast Stratagems Scripting Language](https://www.gibberlings3.net/forums/topic/13725-coding-scripts-in-ssl-some-lessons/) (`ssl`/`slb`), and TypeScript-based transpilers: [TSSL](https://forums.bgforge.net/viewtopic.php?p=2574), [TBAF](https://forums.bgforge.net/viewtopic.php?t=448), and [TD](https://forums.bgforge.net/viewtopic.php?t=1333).

It can also be used with non-VScode editors, see setup guides:
[Sublime](docs/editors/sublime-text.md) | [Neovim](docs/editors/neovim.md) | [Emacs](docs/editors/emacs.md) | [JetBrains](docs/editors/jetbrains.md) | [Helix](docs/editors/helix.md) | [Zed](docs/editors/zed.md) | [Kate](docs/editors/kate.md) | [Notepad++](docs/editors/notepadpp.md)

### Features

- [Syntax highlighting](#screenshots)
- [Completion](#infinity-engine-highlighting-and-completion)
- [Hovers](#fallout-highlighting-and-hovers)
- [Error reporting](#error-reporting)
- Signature help, diagnostics, docstrings, etc. See the [forum](https://forums.bgforge.net/viewforum.php?f=35).
- [Dialog tree preview](#dialog-tree-preview) for SSL, TSSL, D, and TD files

### Feature Matrix

#### LSP Providers

| Language         | Extensions          | Completion | Hover | Signature | Definition | Format | Symbols | Workspace Symbols |  Rename   | Inlay Hints | Compile | JSDoc | Folding |
| ---------------- | ------------------- | :--------: | :---: | :-------: | :--------: | :----: | :-----: | :---------------: | :-------: | :---------: | :-----: | :---: | :-----: |
| Fallout SSL      | .ssl, .h            |     +      |   +   |     +     |     +      |   +    |    +    |         +         |     +     |    .msg     |  sslc   |   +   |    +    |
| Fallout worldmap | worldmap.txt        |     +      |   +   |           |            |        |         |                   |           |             |         |       |         |
| WeiDU BAF        | .baf                |     +      |   +   |           |            |   +    |         |                   |           |    .tra     |  weidu  |       |    +    |
| WeiDU D          | .d                  |     +      |   +   |           |     +      |   +    |    +    |                   | same file |    .tra     |  weidu  |   +   |    +    |
| WeiDU TP2        | .tp2/.tpa/.tph/.tpp |     +      |   +   |           |     +      |   +    |    +    |         +         | same file |    .tra     |  weidu  |   +   |    +    |

Aliases: .slb and .ssl (Infinity Engine) are treated as WeiDU BAF.

#### Transpilers

TypeScript-like languages (Typescript subsets) that compile to the scripting formats above.

Transpilers allow to use Typescript type system in modding, as well as a number of Typescript features and its superior tooling.

| Transpiler | Extension | Target | Inlay Hints | Dialog Preview |
| ---------- | --------- | ------ | :---------: | :------------: |
| TSSL       | .tssl     | .ssl   |    .msg     |       +        |
| TBAF       | .tbaf     | .baf   |    .tra     |                |
| TD         | .td       | .d     |    .tra     |       +        |

**[TSSL](transpilers/tssl/README.md)** (.tssl) compiles to Fallout SSL. Companion project: [FOlib](https://github.com/BGforgeNet/folib).

**[TBAF](transpilers/tbaf/README.md)** (.tbaf) compiles to WeiDU BAF. Important additions include functions, loops, variables, arrays, enums. Companion project: [IETS](https://github.com/BGforgeNet/iets).

**[TD](transpilers/td/README.md)** (.td) compiles to WeiDU D. Same features as TBAF, but has different structure. Also uses IETS.

#### Other Formats

| Format              | Extensions  | Support               |
| ------------------- | ----------- | --------------------- |
| Fallout MSG         | .msg        | TextMate highlighting |
| Fallout scripts.lst | scripts.lst | TextMate highlighting |
| Fallout PRO         | .pro        | Binary viewer         |
| WeiDU TRA           | .tra        | TextMate highlighting |
| Infinity 2DA        | .2da        | TextMate highlighting |

### Installation

1. Search for BGforge in VScode marketplace, like any other extension.
   (Alternatively, download the package from [Github releases](https://github.com/BGforgeNet/VScode-BGforge-MLS/releases) tab and install it manually.)
1. Check [general settings](docs/settings.md).
1. Check [file associations](docs/file_associations.md).
1. Check [hotkeys](#hotkeys).
1. Enable [custom theme](docs/theme.md) and [icon theme](docs/icon-theme.md).
1. (Infinity Engine) Install [IElib](https://ielib.bgforge.net).

#### Hotkeys

- `CTRL+R`: compile (Fallout `ssl`) or parse (WeiDU `tp2`) file, [reporting errors](#error-reporting) if any.
- `CTRL+SHIFT+V`: open [dialog tree preview](#dialog-tree-preview) (SSL, TSSL, D, TD files).

### Screenshots

#### Infinity Engine highlighting and completion

![infinity highlighting and completion example](docs/infinity.png)

#### Fallout highlighting and hovers

![fallout highlighting and hover example](docs/fallout.png)

#### Dialog tree preview

Visual dialog tree for SSL, TSSL, D, and TD files. Open with `CTRL+SHIFT+V` or the command palette. Shows states, transitions, and resolved translation strings.

#### Error reporting

![error reporting example](docs/error_reporting.png)
