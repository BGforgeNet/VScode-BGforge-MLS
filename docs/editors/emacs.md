# Emacs

Setup guide for using BGforge MLS with Emacs 29+.

## Prerequisites

```bash
npm install -g @bgforge/mls-server
```

## File Type Detection

Define major modes first. The mode names match the server's language IDs (`fallout-ssl`, `weidu-baf`, etc.) -- eglot derives the language ID by stripping `-mode` from the major mode name.

```elisp
(define-derived-mode fallout-ssl-mode prog-mode "Fallout-SSL"
  "Major mode for Fallout SSL files.")

(define-derived-mode weidu-baf-mode prog-mode "WeiDU-BAF"
  "Major mode for WeiDU BAF files.")

(define-derived-mode weidu-d-mode prog-mode "WeiDU-D"
  "Major mode for WeiDU D dialog files.")

(define-derived-mode weidu-tp2-mode prog-mode "WeiDU-TP2"
  "Major mode for WeiDU TP2 installer files.")

(define-derived-mode fallout-worldmap-txt-mode prog-mode "Fallout-Worldmap"
  "Major mode for Fallout worldmap.txt files.")

(add-to-list 'auto-mode-alist '("\\.ssl\\'" . fallout-ssl-mode))
(add-to-list 'auto-mode-alist '("\\.h\\'" . fallout-ssl-mode))  ;; or keep c-mode; set per-project
(add-to-list 'auto-mode-alist '("\\.baf\\'" . weidu-baf-mode))
(add-to-list 'auto-mode-alist '("\\.d\\'" . weidu-d-mode))
(add-to-list 'auto-mode-alist '("\\.tp2\\'" . weidu-tp2-mode))
(add-to-list 'auto-mode-alist '("\\.tp[ahp]\\'" . weidu-tp2-mode))
(add-to-list 'auto-mode-alist '("worldmap\\.txt\\'" . fallout-worldmap-txt-mode))
```

Note: `.h` files default to `c-mode` in Emacs. The override above sets them to `fallout-ssl-mode` globally. For per-project control, use directory-local variables (`.dir-locals.el`) instead.

## Language Server

### eglot (built-in, Emacs 29+)

```elisp
(add-to-list 'eglot-server-programs
             '((fallout-ssl-mode weidu-baf-mode weidu-tp2-mode weidu-d-mode
                fallout-worldmap-txt-mode)
               "bgforge-mls-server" "--stdio"))
```

### lsp-mode

```elisp
(require 'lsp-mode)

(lsp-register-client
 (make-lsp-client
  :new-connection (lsp-stdio-connection '("bgforge-mls-server" "--stdio"))
  :major-modes '(fallout-ssl-mode weidu-baf-mode weidu-tp2-mode weidu-d-mode
                 fallout-worldmap-txt-mode)
  :server-id 'bgforge-mls))
```

## TypeScript Plugins (TSSL/TD)

If you write `.tssl` or `.td` transpiler files, the server package includes TypeScript plugins that run inside tsserver. See [TypeScript Plugins](typescript-plugins.md) for setup.

## Settings

### eglot

```elisp
(setq-default eglot-workspace-configuration
              '(:bgforge
                (:validateOnSave t
                 :validateOnChange :json-false
                 :falloutSSL (:compilePath "compile"
                              :useBuiltInCompiler :json-false
                              :compileOptions "-q -p -l -O2 -d -s -n"
                              :outputDirectory ""
                              :headersDirectory "")
                 :weidu (:path "weidu"
                         :gamePath ""))))
```

### lsp-mode

The server reads settings via `workspace/configuration`. Use `lsp-register-custom-settings` to map variables to configuration paths:

```elisp
(defcustom lsp-bgforge-validate-on-save t
  "Validate on save." :type 'boolean :group 'lsp-bgforge)
(defcustom lsp-bgforge-validate-on-change nil
  "Validate on change." :type 'boolean :group 'lsp-bgforge)
(defcustom lsp-bgforge-ssl-compile-path "compile"
  "SSL compile path." :type 'string :group 'lsp-bgforge)
(defcustom lsp-bgforge-ssl-use-built-in-compiler nil
  "Use built-in compiler." :type 'boolean :group 'lsp-bgforge)
(defcustom lsp-bgforge-ssl-compile-options "-q -p -l -O2 -d -s -n"
  "SSL compile options." :type 'string :group 'lsp-bgforge)
(defcustom lsp-bgforge-ssl-output-directory ""
  "SSL output directory." :type 'string :group 'lsp-bgforge)
(defcustom lsp-bgforge-ssl-headers-directory ""
  "SSL headers directory." :type 'string :group 'lsp-bgforge)
(defcustom lsp-bgforge-weidu-path "weidu"
  "WeiDU executable path." :type 'string :group 'lsp-bgforge)
(defcustom lsp-bgforge-weidu-game-path ""
  "WeiDU game path." :type 'string :group 'lsp-bgforge)

(lsp-register-custom-settings
 '(("bgforge.validateOnSave" lsp-bgforge-validate-on-save)
   ("bgforge.validateOnChange" lsp-bgforge-validate-on-change)
   ("bgforge.falloutSSL.compilePath" lsp-bgforge-ssl-compile-path)
   ("bgforge.falloutSSL.useBuiltInCompiler" lsp-bgforge-ssl-use-built-in-compiler)
   ("bgforge.falloutSSL.compileOptions" lsp-bgforge-ssl-compile-options)
   ("bgforge.falloutSSL.outputDirectory" lsp-bgforge-ssl-output-directory)
   ("bgforge.falloutSSL.headersDirectory" lsp-bgforge-ssl-headers-directory)
   ("bgforge.weidu.path" lsp-bgforge-weidu-path)
   ("bgforge.weidu.gamePath" lsp-bgforge-weidu-game-path)))
```

See [Settings Reference](../settings.md) for all available options.
