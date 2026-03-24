/**
 * External scanner for Fallout SSL grammar.
 *
 * Handles three tokens:
 *
 * NEWLINE / LINE_END: In normal code, newlines are whitespace (NEWLINE extra).
 * Inside #define directives, a bare newline terminates the macro body (LINE_END).
 * Tree-sitter calls the external scanner before processing extras, so the scanner
 * gets first look at newline characters and can decide their role.
 *
 * TOKEN_PASTE: The C preprocessor ## operator used inside SSL macro bodies to
 * concatenate tokens (e.g. animate_##type##_to_tile). This token is emitted ONLY
 * when LINE_END is also a valid symbol (i.e. we are inside a #define body), so ##
 * is context-sensitive: it remains an error everywhere else in SSL code.
 *
 * Note: TREE_SITTER_WASM is NOT defined by the tree-sitter build system, so this
 * scanner runs in both native and WASM builds.
 */

#include "tree_sitter/parser.h"

enum TokenType { NEWLINE, LINE_END, TOKEN_PASTE };

void *tree_sitter_ssl_external_scanner_create(void) { return NULL; }
void tree_sitter_ssl_external_scanner_destroy(void *payload) {}
unsigned tree_sitter_ssl_external_scanner_serialize(void *payload, char *buffer) { return 0; }
void tree_sitter_ssl_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {}

bool tree_sitter_ssl_external_scanner_scan(
    void *payload, TSLexer *lexer, const bool *valid_symbols) {

    /* At EOF, emit LINE_END to terminate any open #define */
    if (lexer->eof(lexer) && valid_symbols[LINE_END]) {
        lexer->result_symbol = LINE_END;
        lexer->mark_end(lexer);
        return true;
    }

    /* TOKEN_PASTE: ## inside a macro body.
     * Only emitted when LINE_END is valid (we are inside a #define body) and
     * TOKEN_PASTE is valid (grammar expects it as part of a token_paste_identifier).
     * Uses mark_end to peek at the second # without committing if it is absent. */
    if (lexer->lookahead == '#' && valid_symbols[TOKEN_PASTE] && valid_symbols[LINE_END]) {
        lexer->advance(lexer, false);
        if (lexer->lookahead == '#') {
            lexer->advance(lexer, false);
            lexer->mark_end(lexer);
            lexer->result_symbol = TOKEN_PASTE;
            return true;
        }
        /* Only one # — not a token-paste operator.
         * mark_end was not called after advancing past the first #, so tree-sitter
         * resets the lexer to the position of the # and re-lexes it normally. */
        return false;
    }

    /* Only handle newline characters below */
    if (lexer->lookahead != '\n' && lexer->lookahead != '\r') {
        return false;
    }

    /* Consume the newline: \r\n, \r, or \n */
    if (lexer->lookahead == '\r') lexer->advance(lexer, false);
    if (lexer->lookahead == '\n') lexer->advance(lexer, false);
    lexer->mark_end(lexer);

    /* Inside a #define: newline is a line terminator (terminal token).
     * Elsewhere: newline is whitespace (extra token). */
    lexer->result_symbol = valid_symbols[LINE_END] ? LINE_END : NEWLINE;
    return true;
}
