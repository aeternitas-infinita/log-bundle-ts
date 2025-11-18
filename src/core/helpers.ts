// Cache process.cwd() as it doesn't change during runtime
const CWD = process.cwd();
const CWD_LENGTH = CWD.length;

// Regex patterns compiled once for better performance
const STACK_PATTERN_WITH_PARENS = /at .* \((.+):(\d+):(\d+)\)/;
const STACK_PATTERN_WITHOUT_PARENS = /at (.+):(\d+):(\d+)/;

// Files to skip when parsing stack trace - use regex for faster matching
const SKIP_PATTERN = /node_modules|pino|sentry|source\.ts|helpers\.ts/;

// Cache for parsed stack traces to avoid repeated parsing
const stackCache = new Map<string, string>();
const MAX_CACHE_SIZE = 100;

export function getSource(): string {
    const stack = new Error().stack;
    if (!stack) {
        return "unknown";
    }

    // Use first 200 chars of stack as cache key (captures call site)
    const cacheKey = stack.slice(0, 200);
    const cached = stackCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const lines = stack.split("\n");
    let result = "unknown";

    // Start from index 2 to skip Error constructor and getSource itself
    for (let i = 2; i < lines.length; i++) {
        const line = lines[i];

        // Skip invalid lines or lines from excluded files
        if (!line?.includes("at ")) {
            continue;
        }

        // Check if line contains any skip patterns (single regex test is faster)
        if (SKIP_PATTERN.test(line)) {
            continue;
        }

        const match = STACK_PATTERN_WITH_PARENS.exec(line) ?? STACK_PATTERN_WITHOUT_PARENS.exec(line);
        if (match) {
            const [, filePath, lineNumber] = match;
            if (filePath && lineNumber) {
                // Optimize string replacements with single pass
                let relativePath = filePath;

                // Remove file:/// prefix if present
                if (relativePath.startsWith("file:///")) {
                    relativePath = relativePath.slice(8);
                }

                // Remove CWD prefix if present
                if (relativePath.startsWith(CWD)) {
                    relativePath = relativePath.slice(CWD_LENGTH);
                }

                // Normalize path separators and remove leading slash
                if (relativePath.startsWith("\\") || relativePath.startsWith("/")) {
                    relativePath = relativePath.slice(1);
                }
                relativePath = relativePath.replace(/\\/g, "/");

                result = `${relativePath}:${lineNumber}`;
                break;
            }
        }
    }

    // Maintain cache size to prevent memory leaks
    if (stackCache.size >= MAX_CACHE_SIZE) {
        const firstKey = stackCache.keys().next().value;
        if (firstKey) {
            stackCache.delete(firstKey);
        }
    }
    stackCache.set(cacheKey, result);

    return result;
}
