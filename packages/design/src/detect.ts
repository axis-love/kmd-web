import { type DetectionOutput, type Signal, scoreCheapSignals } from "./detectCheap.js";
import { EXTRACTORS } from "./extractors.js";
import type { DesignDocument } from "./ir.js";
import { emptyDesignDocument } from "./ir.js";
import { stageMerge } from "./merge.js";
import type { StageFn } from "./pipeline.js";

export { detectDesignDocumentCheap } from "./detectCheap.js";
export type { DetectionOutput, Signal };

function scoreTokenSignals(doc: DesignDocument, signals: Signal[]): void {
  const colorCount = doc.spec.colorTokens?.length ?? 0;
  if (colorCount >= 3) {
    signals.push({
      signal: `>=3 color tokens (${colorCount})`,
      points: 3,
    });
  }

  const typoCount = doc.spec.typographyTokens?.length ?? 0;
  if (typoCount >= 3) {
    signals.push({
      signal: `>=3 typography tokens (${typoCount})`,
      points: 2,
    });
  }
}

const DETECT_STAGES: StageFn[] = [...EXTRACTORS, stageMerge];

function runDetectPipeline(content: string): DesignDocument {
  const doc = emptyDesignDocument(content);

  for (const stage of DETECT_STAGES) {
    try {
      stage(doc);
    } catch {
      // Swallow errors — detection is best-effort.
    }
  }
  return doc;
}

export function detectDesignDocument(content: string, filename?: string): DetectionOutput {
  const signals: Signal[] = [];

  scoreCheapSignals(content, filename, signals);

  const doc = runDetectPipeline(content);
  scoreTokenSignals(doc, signals);

  const score = signals.reduce((sum, s) => sum + s.points, 0);
  return { score, signals, threshold: 5 };
}

export function stageDetectInPipeline(doc: DesignDocument): void {
  const source = doc._sourceContent;
  if (!source) return;

  const signals: Signal[] = [];
  scoreCheapSignals(source, undefined, signals);

  const rawScore = signals.reduce((sum, s) => sum + s.points, 0);

  const normalizedScore = Math.min(rawScore / 10, 1);

  doc.detection = {
    score: normalizedScore,
    signals: signals.map((s) => `${s.signal} (+${s.points})`),
  };

  const firstHeading = source.match(/^#\s+(.+)$/m);
  if (firstHeading) {
    doc.meta.name = firstHeading[1]!.trim();
  }

  const lines = source.split("\n");
  for (const line of lines.slice(1, 10)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    doc.meta.description = trimmed;
    break;
  }
}
