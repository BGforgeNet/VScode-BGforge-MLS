'use strict';

import * as path from 'path';
import { CompletionItem, Hover } from 'vscode-languageserver/node';
import { connection } from './server';
import { Server } from 'http';
export const diag_src = "BGforge MLS";

export function fname(uri: string) {
	return path.basename(uri);
}

export async function conlog(item: any) {
	switch (typeof (item)) {
		case "number":
			connection.console.log(item.toString());
			break;
		case "boolean":
			connection.console.log(item.toString());
			break;
		case "undefined":
			connection.console.log(item);
			break;
		case "string":
			connection.console.log(item);
			break;
		default:
			if (item.size && item.size > 0 && JSON.stringify(item) == "{}") {
				connection.console.log(JSON.stringify([...item]));
			} else {
				connection.console.log(JSON.stringify(item));
			}
			break;
	}
}

// get word under cursor
export function get_word_at(str: string, pos: number) {
	// Search for the word's beginning and end.
	const left = str.slice(0, pos + 1).search(/\w+$/), right = str.slice(pos).search(/\W/);
	// The last word in the string is a special case.
	if (right < 0) {
		return str.slice(left);
	}
	// Return the word, using the located bounds to extract it from the string.
	return str.slice(left, right + pos);
}

// get word before cursor's position (for signature)
export function get_signature_word(str: string, pos: number) {
	// cut off last character and search for words
	const sliced = str.slice(0, pos);
	const lpos = sliced.indexOf(')');
	const matches = str.slice(lpos > 0 ? lpos : 0, pos).match(/(\w+)\(/g);
	if (matches) {
		const word = matches.pop().slice(0, -1);
		return word;
	}
}

// /** return a list of files with given extension in a directory */
// export function find_files(directoryName: string, ext: string) {
// 	const fs = require("fs");
// 	const path = require("path")
// 	const files = fs.readdirSync(directoryName);
// 	const result: string[] = [];
// 	files.forEach(function (file: string) {
// 		const subfile = fs.statSync(path.join(directoryName, file));
// 		if (subfile.isDirectory()) {
// 			for (let subfileName of find_files(path.join(directoryName, file), ext)) {
// 				if (path.extname(subfileName) == '.h') {
// 					result.push(path.join(file, subfileName));
// 				}
// 			}
// 		} else {
// 			if (path.extname(file) == '.h') {
// 				result.push(file);
// 			}
// 		}

// 	})
// 	return result;
// }

/** Save item source for defines */
export interface CompletionItemEx extends CompletionItem {
	source: string
}

export interface HoverEx extends Hover {
	source: string
}

export interface DynamicData {
	completion: Array<CompletionItemEx>
	hover: Map<string, HoverEx>
}

// single language
export interface CompletionList extends Array<CompletionItem> {}
export interface CompletionListEx extends Array<CompletionItemEx> {}
export interface HoverMap extends Map<string, Hover> {}
export interface HoverMapEx extends Map<string, HoverEx> {}
// all languages
export interface CompletionData extends Map<string, CompletionList | CompletionListEx> {}
export interface CompletionDataEx extends Map<string, CompletionListEx> {}
export interface HoverData extends Map<string, HoverMap | HoverMapEx> {}
export interface HoverDataEx extends Map<string, HoverMapEx> {}
