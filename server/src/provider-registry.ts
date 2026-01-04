/**
 * Provider Registry - manages all language providers and routes requests.
 *
 * This is the central hub for language features. It:
 * 1. Registers providers for each language
 * 2. Initializes them at startup
 * 3. Routes feature requests to the appropriate provider
 */

import {
    DocumentSymbol,
    Location,
    Position,
    Range,
    InlayHint,
    TextEdit,
} from "vscode-languageserver/node";
import { LanguageProvider } from "./language-provider";
import { conlog } from "./common";

class ProviderRegistry {
    private providers: Map<string, LanguageProvider> = new Map();

    /**
     * Register a language provider.
     */
    register(provider: LanguageProvider): void {
        this.providers.set(provider.id, provider);
        conlog(`Registered provider: ${provider.id}`);
    }

    /**
     * Initialize all registered providers.
     */
    async init(): Promise<void> {
        const initPromises = [...this.providers.values()].map(async (provider) => {
            try {
                await provider.init();
            } catch (error) {
                conlog(`Failed to initialize provider ${provider.id}: ${error}`);
            }
        });
        await Promise.all(initPromises);
        conlog(`Initialized ${this.providers.size} providers`);
    }

    /**
     * Get a provider by language ID.
     */
    get(langId: string): LanguageProvider | undefined {
        return this.providers.get(langId);
    }

    /**
     * Check if a provider exists for the language.
     */
    has(langId: string): boolean {
        return this.providers.has(langId);
    }

    // =========================================================================
    // Feature routing - delegates to appropriate provider
    // =========================================================================

    format(langId: string, text: string, uri: string): TextEdit[] {
        const provider = this.providers.get(langId);
        if (provider?.format) {
            return provider.format(text, uri);
        }
        return [];
    }

    symbols(langId: string, text: string): DocumentSymbol[] {
        const provider = this.providers.get(langId);
        if (provider?.symbols) {
            return provider.symbols(text);
        }
        return [];
    }

    definition(langId: string, text: string, position: Position, uri: string): Location | null {
        const provider = this.providers.get(langId);
        if (provider?.definition) {
            return provider.definition(text, position, uri);
        }
        return null;
    }

    inlayHints(langId: string, text: string, uri: string, range: Range): InlayHint[] {
        const provider = this.providers.get(langId);
        if (provider?.inlayHints) {
            return provider.inlayHints(text, uri, range);
        }
        return [];
    }
}

// Singleton instance
export const registry = new ProviderRegistry();
