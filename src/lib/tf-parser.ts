/**
 * Parse Terraform .tf file content to extract modules, resources, providers, and dependencies.
 * Uses brace-aware scanning for block extraction so nested blocks are handled.
 */

export interface ParsedModule {
  name: string;
  source?: string;
  version?: string;
  env?: string;
  path?: string;
  /** References like module.xyz.output */
  refs: string[];
}

export interface ParsedResource {
  type: string;
  name: string;
  path?: string;
  refs: string[];
}

export interface ParsedProvider {
  name: string;
  alias?: string;
  path?: string;
}

export interface ParsedDataSource {
  type: string;
  name: string;
  path?: string;
  refs: string[];
}

export interface ParsedTerraform {
  modules: ParsedModule[];
  resources: ParsedResource[];
  providers: ParsedProvider[];
  dataSources: ParsedDataSource[];
  /** All refs found in the file (e.g. module.x.y, aws_db_instance.main.id) */
  allRefs: string[];
}

const MODULE_START_RE = /\bmodule\s+"([^"]+)"\s*\{/g;
const RESOURCE_START_RE = /\bresource\s+"([^"]+)"\s+"([^"]+)"\s*\{/g;
const PROVIDER_START_RE = /\bprovider\s+"([^"]+)"\s*\{/g;
const DATA_START_RE = /\bdata\s+"([^"]+)"\s+"([^"]+)"\s*\{/g;
const RESOURCE_REF_RE = /\b(data\.)?([a-zA-Z][a-zA-Z0-9_]*)\.([a-zA-Z][a-zA-Z0-9_-]*)(?:\[[^\]]+\])?(?:\.[a-zA-Z0-9_-]+)+/g;
const MODULE_REF_RE = /\bmodule\.([a-zA-Z0-9_-]+)\b/g;

interface BlockMatch {
  labels: string[];
  body: string;
}

const IGNORED_REF_TYPES = new Set([
  "var",
  "local",
  "path",
  "count",
  "each",
  "self",
  "terraform",
]);

function findMatchingBrace(content: string, openBraceIndex: number): number {
  let depth = 0;
  let inString: '"' | "'" | null = null;
  let inLineComment = false;
  let inBlockComment = false;
  let escapeNext = false;

  for (let i = openBraceIndex; i < content.length; i++) {
    const c = content[i];
    const n = content[i + 1];

    if (inLineComment) {
      if (c === "\n") inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (c === "*" && n === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inString) {
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (c === "\\") {
        escapeNext = true;
        continue;
      }
      if (c === inString) {
        inString = null;
      }
      continue;
    }

    if (c === "/" && n === "/") {
      inLineComment = true;
      i++;
      continue;
    }

    if (c === "#") {
      inLineComment = true;
      continue;
    }

    if (c === "/" && n === "*") {
      inBlockComment = true;
      i++;
      continue;
    }

    if (c === "'" || c === '"') {
      inString = c;
      continue;
    }

    if (c === "{") {
      depth++;
      continue;
    }

    if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function extractBlocks(content: string, startRe: RegExp): BlockMatch[] {
  const blocks: BlockMatch[] = [];
  const re = new RegExp(startRe.source, "g");
  let m: RegExpExecArray | null;

  while ((m = re.exec(content)) !== null) {
    const matchText = m[0] ?? "";
    const openOffset = matchText.lastIndexOf("{");
    if (openOffset === -1) continue;

    const openIndex = m.index + openOffset;
    const closeIndex = findMatchingBrace(content, openIndex);
    if (closeIndex === -1) continue;

    blocks.push({
      labels: m.slice(1).filter((label): label is string => Boolean(label)),
      body: content.slice(openIndex + 1, closeIndex),
    });

    re.lastIndex = closeIndex + 1;
  }

  return blocks;
}

function extractRefs(blockBody: string): string[] {
  const refs: string[] = [];

  let moduleMatch: RegExpExecArray | null;
  const moduleRe = new RegExp(MODULE_REF_RE.source, "g");
  while ((moduleMatch = moduleRe.exec(blockBody)) !== null) {
    refs.push(`module.${moduleMatch[1]}`);
  }

  let resourceMatch: RegExpExecArray | null;
  const resourceRe = new RegExp(RESOURCE_REF_RE.source, "g");
  while ((resourceMatch = resourceRe.exec(blockBody)) !== null) {
    const isData = Boolean(resourceMatch[1]);
    const type = resourceMatch[2];
    const name = resourceMatch[3];
    if (!type || !name || IGNORED_REF_TYPES.has(type)) continue;
    refs.push(isData ? `data.${type}.${name}` : `${type}.${name}`);
  }

  return [...new Set(refs)];
}

function extractSource(body: string): string | undefined {
  const match = body.match(/source\s*=\s*["']([^"']+)["']/);
  return match?.[1];
}

function extractVersion(body: string): string | undefined {
  const match = body.match(/version\s*=\s*["']([^"']+)["']/);
  return match?.[1];
}

function extractLiteralAssignment(body: string, key: string): string | undefined {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escaped}\\s*=\\s*["']([^"']+)["']`);
  const match = body.match(re);
  return match?.[1];
}

export function parseTerraformContent(content: string, path?: string): ParsedTerraform {
  const modules: ParsedModule[] = [];
  const resources: ParsedResource[] = [];
  const providers: ParsedProvider[] = [];
  const dataSources: ParsedDataSource[] = [];
  const allRefs: string[] = [];

  for (const block of extractBlocks(content, MODULE_START_RE)) {
    const [name] = block.labels;
    if (!name) continue;
    const refs = extractRefs(block.body);
    refs.forEach((r) => allRefs.push(r));
    modules.push({
      name,
      source: extractSource(block.body),
      version: extractVersion(block.body),
      env: extractLiteralAssignment(block.body, "env"),
      path,
      refs,
    });
  }

  for (const block of extractBlocks(content, RESOURCE_START_RE)) {
    const [type, name] = block.labels;
    if (!type || !name) continue;
    const refs = extractRefs(block.body);
    refs.forEach((r) => allRefs.push(r));
    resources.push({
      type,
      name,
      path,
      refs,
    });
  }

  for (const block of extractBlocks(content, DATA_START_RE)) {
    const [type, name] = block.labels;
    if (!type || !name) continue;
    const refs = extractRefs(block.body);
    refs.forEach((r) => allRefs.push(r));
    dataSources.push({
      type,
      name,
      path,
      refs,
    });
  }

  for (const block of extractBlocks(content, PROVIDER_START_RE)) {
    const [name] = block.labels;
    if (!name) continue;
    providers.push({ name, path });
  }

  return {
    modules,
    resources,
    providers,
    dataSources,
    allRefs: [...new Set(allRefs)],
  };
}

export function parseTerraformFiles(files: { path: string; content: string }[]): ParsedTerraform {
  const acc: ParsedTerraform = {
    modules: [],
    resources: [],
    providers: [],
    dataSources: [],
    allRefs: [],
  };
  for (const f of files) {
    const p = parseTerraformContent(f.content, f.path);
    acc.modules.push(...p.modules);
    acc.resources.push(...p.resources);
    acc.providers.push(...p.providers);
    acc.dataSources.push(...p.dataSources);
    acc.allRefs.push(...p.allRefs);
  }
  acc.allRefs = [...new Set(acc.allRefs)];
  return acc;
}
