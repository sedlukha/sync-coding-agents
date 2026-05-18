#!/usr/bin/env node
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, symlinkSync, unlinkSync, writeFileSync, } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
const root = process.argv[2] ? resolve(process.argv[2]) : process.cwd();
const CONFIG = [
    {
        source: join(root, ".agents", "skills"),
        target: join(root, ".claude", "skills"),
        /** Skills are directories — symlink the whole directory */
        type: "dir",
    },
    {
        source: join(root, ".agents", "agents"),
        target: join(root, ".claude", "agents"),
        /** Agents are .md files — symlink each file */
        type: "file",
    },
];
/** Frontmatter fields that are internal to Claude Code and must not appear in GitHub Copilot agent copies */
const GITHUB_AGENTS_STRIP_FIELDS = [
    "color",
    "skills",
    "permissionMode",
    "model",
];
const syncSymlinks = (source, target, type) => {
    if (!existsSync(source)) {
        console.warn(`[skip] source does not exist: ${source}`);
        return;
    }
    mkdirSync(target, { recursive: true });
    // 1. Delete all existing symlinks in target
    for (const name of readdirSync(target)) {
        const fullPath = join(target, name);
        if (lstatSync(fullPath).isSymbolicLink()) {
            unlinkSync(fullPath);
            console.info(`  [del] ${name}`);
        }
    }
    // 2. Create fresh symlinks for each entry in source
    const relativePrefix = relative(target, source);
    let created = 0;
    for (const name of readdirSync(source)) {
        const stat = lstatSync(join(source, name));
        const matches = type === "dir" ? stat.isDirectory() : stat.isFile();
        if (matches) {
            symlinkSync(`${relativePrefix}/${name}`, join(target, name), type);
            console.info(`  [add] ${name}`);
            created += 1;
        }
    }
    console.info(`\n✓ ${relative(root, target)}: ${created} symlinks created\n`);
};
const stripFrontmatterFields = (content, fieldsToStrip) => {
    const lines = content.split("\n");
    if (lines[0] !== "---") {
        return content;
    }
    const result = [];
    let insideFrontmatter = false;
    let closingFound = false;
    let skippingContinuation = false;
    for (const [i, line] of lines.entries()) {
        if (i === 0 && line === "---") {
            insideFrontmatter = true;
            result.push(line);
        }
        else if (insideFrontmatter && !closingFound) {
            if (line === "---") {
                closingFound = true;
                insideFrontmatter = false;
                skippingContinuation = false;
                result.push(line);
            }
            else if (skippingContinuation &&
                line.length > 0 &&
                (line.startsWith(" ") || line.startsWith("\t"))) {
                // Skip continuation line of a stripped field
            }
            else {
                skippingContinuation = false;
                // Check if this line matches a field to strip
                const colonIndex = line.indexOf(":");
                if (colonIndex > 0) {
                    const key = line.slice(0, colonIndex).trim();
                    if (fieldsToStrip.includes(key)) {
                        skippingContinuation = true;
                    }
                    else {
                        result.push(line);
                    }
                }
                else {
                    result.push(line);
                }
            }
        }
        else {
            result.push(line);
        }
    }
    return result.join("\n");
};
const syncCopies = (source, target, fieldsToStrip) => {
    if (!existsSync(source)) {
        console.warn(`[skip] source does not exist: ${source}`);
        return;
    }
    mkdirSync(target, { recursive: true });
    // 1. Delete all existing *.agent.md files in target (including symlinks)
    for (const name of readdirSync(target)) {
        if (name.endsWith(".agent.md")) {
            const fullPath = join(target, name);
            unlinkSync(fullPath);
            console.info(`  [del] ${name}`);
        }
    }
    // 2. Copy each .md file from source with stripped frontmatter
    let created = 0;
    for (const name of readdirSync(source)) {
        if (name.endsWith(".md")) {
            const sourcePath = join(source, name);
            const stat = lstatSync(sourcePath);
            if (stat.isFile()) {
                const content = readFileSync(sourcePath, "utf8");
                const stripped = stripFrontmatterFields(content, fieldsToStrip);
                const baseName = basename(name, extname(name));
                const targetName = `${baseName}.agent.md`;
                const targetPath = join(target, targetName);
                writeFileSync(targetPath, stripped, "utf8");
                console.info(`  [add] ${targetName}`);
                created += 1;
            }
        }
    }
    console.info(`\n✓ ${relative(root, target)}: ${created} copies created\n`);
};
const syncRootSymlinks = (root) => {
    const agentsFile = join(root, "AGENTS.md");
    if (!existsSync(agentsFile)) {
        console.warn(`[skip] AGENTS.md does not exist: ${agentsFile}`);
        return;
    }
    const symlinks = [
        { absolutePath: join(root, ".github", "copilot-instructions.md") },
        { absolutePath: join(root, "CLAUDE.md") },
    ];
    for (const { absolutePath } of symlinks) {
        const relativePath = relative(dirname(absolutePath), agentsFile);
        mkdirSync(dirname(absolutePath), { recursive: true });
        if (existsSync(absolutePath)) {
            unlinkSync(absolutePath);
        }
        symlinkSync(relativePath, absolutePath);
        console.info(`  [add] ${relative(root, absolutePath)} → ${relativePath}`);
    }
};
for (const { source, target, type } of CONFIG) {
    syncSymlinks(source, target, type);
}
// .github/agents/ — copies with stripped frontmatter
syncCopies(join(root, ".agents", "agents"), join(root, ".github", "agents"), GITHUB_AGENTS_STRIP_FIELDS);
// .github/copilot-instructions.md and CLAUDE.md — root symlinks
syncRootSymlinks(root);
