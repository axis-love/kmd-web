import { extractComponents } from "./extract/components.js";
import { extractCss } from "./extract/css.js";
import { extractGradient } from "./extract/gradient.js";
import { extractLayout } from "./extract/layout.js";
import { extractProse } from "./extract/prose.js";
import { extractShadow } from "./extract/shadow.js";
import { extractSurface } from "./extract/surface.js";
import { extractTables } from "./extract/tables.js";
import { extractYaml } from "./extract/yaml.js";
import type { StageFn } from "./pipeline.js";

export const EXTRACTORS: StageFn[] = [
  extractYaml,
  extractTables,
  extractProse,
  extractCss,
  extractComponents,
  extractShadow,
  extractGradient,
  extractSurface,
  extractLayout,
];
