export function getSource(): string {
    const stack = new Error().stack;
    if (stack) {
        const lines = stack.split("\n");
        for (let i = 2; i < lines.length; i++) {
            const line = lines[i];
            if (
                line &&
                !line.includes("node_modules") &&
                !line.includes("pino") &&
                !line.includes("sentry") &&
                !line.includes("source.ts") &&
                !line.includes("helpers.ts") &&
                line.includes("at ")
            ) {
                const match = line.match(/at .* \((.+):(\d+):(\d+)\)/) || line.match(/at (.+):(\d+):(\d+)/);
                if (match) {
                    const [, filePath, lineNumber] = match;
                    if (filePath && lineNumber) {
                        const relativePath = filePath
                            .replace(/^file:\/\/\//, "")
                            .replace(process.cwd(), "")
                            .replace(/\\/g, "/")
                            .replace(/^\//, "");
                        return `${relativePath}:${lineNumber}`;
                    }
                }
            }
        }
    }
    return "unknown";
}
