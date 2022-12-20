'use strict';

import * as path from 'path';
import { connection } from './server';
export const diag_src = "BGforge MLS";

export function fname(uri: string) {
	return path.basename(uri);
}

export function conlog(item: any) {
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
