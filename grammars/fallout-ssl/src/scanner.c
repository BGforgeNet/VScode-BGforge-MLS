/**
 * External scanner for Fallout SSL grammar.
 *
 * Handles newlines: in normal code, newlines are whitespace (NEWLINE extra).
 * Inside #define directives, a bare newline terminates the macro body (LINE_END terminal).
 * Tree-sitter calls the external scanner before processing extras, so the scanner
 * gets first look at newline characters and can decide their role.
 *
 * Note: External scanners are not supported in WASM builds.
 * TODO: Investigate if this scanner is actually needed - all tests pass without it.
 */

#include "tree_sitter/parser.h"

enum TokenType { NEWLINE, LINE_END };

#ifndef TREE_SITTER_WASM

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

    /* Only handle newline characters */
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

#endif
