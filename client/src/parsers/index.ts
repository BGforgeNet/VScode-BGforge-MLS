export * from "./types";
export { parserRegistry } from "./registry";

// Import and register all parsers
import { proParser } from "./pro";
import { parserRegistry } from "./registry";

parserRegistry.register(proParser);
