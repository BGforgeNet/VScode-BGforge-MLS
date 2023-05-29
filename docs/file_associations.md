## File associations

### SSL

Both Star-Trek Scripting Language and Sword Coast Stratagems Scripting Language use files with extension `ssl`. BGforge MLS defaults to Star-Trek Scripting Language (Fallout). If you need SCS Scripting Language instead, you can [set file associations](https://code.visualstudio.com/docs/languages/overview#_changing-the-language-for-the-selected-file) in VScode settings:

```json
"files.associations": {
  "*.ssl": "weidu-ssl"
}
```

This can be set globally, or per project, so you can work on both types of projects simultaneously.

### H

The same method goes for `.h` headers of C++, if you use those:
```json
"files.associations": {
    "*.h": "cpp"
}
```
