import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { normalizeProducers } from './normalize-producers';

const EXPECTED_HEADER = ['year', 'title', 'studios', 'producers', 'winner'] as const;

const movieRecordSchema = z.object({
  year: z
    .string()
    .regex(/^\d{4}$/, 'must be a four-digit year')
    .transform(Number),
  title: z.string().min(1, 'must not be empty'),
  studios: z.string().min(1, 'must not be empty'),
  producers: z
    .string()
    .min(1, 'must not be empty')
    .transform(normalizeProducers)
    .pipe(z.array(z.string().min(1)).min(1, 'must contain at least one producer')),
  winner: z.enum(['', 'yes']).transform((value) => value === 'yes'),
});

interface CsvRecordWithInfo {
  record: string[];
  info: {
    lines: number;
  };
}

export interface ParsedMovie {
  year: number;
  title: string;
  studios: string;
  producers: string[];
  winner: boolean;
}

function validationError(
  csvPath: string,
  line: number,
  field: string,
  message: string,
  cause?: unknown,
): Error {
  return new Error(
    `Invalid CSV file "${csvPath}" at line ${line}, field "${field}": ${message}`,
    { cause },
  );
}

function getCsvErrorLine(error: unknown): number {
  if (
    typeof error === 'object' &&
    error !== null &&
    'lines' in error &&
    typeof error.lines === 'number'
  ) {
    return error.lines;
  }

  return 1;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function parseMoviesCsv(csvPath: string): ParsedMovie[] {
  let content: string;

  try {
    content = readFileSync(csvPath, 'utf8');
  } catch (error: unknown) {
    throw new Error(`Unable to read CSV file "${csvPath}": ${getErrorMessage(error)}`, {
      cause: error,
    });
  }

  let rows: CsvRecordWithInfo[];

  try {
    rows = parse(content, {
      bom: true,
      delimiter: ';',
      info: true,
      skip_empty_lines: true,
      trim: true,
    }) as unknown as CsvRecordWithInfo[];
  } catch (error: unknown) {
    throw validationError(
      csvPath,
      getCsvErrorLine(error),
      'record',
      getErrorMessage(error),
      error,
    );
  }

  const [headerRow, ...movieRows] = rows;

  if (headerRow === undefined || !isExpectedHeader(headerRow.record)) {
    const receivedHeader = headerRow?.record.join(';') ?? '<empty file>';
    throw validationError(
      csvPath,
      1,
      'header',
      `expected "${EXPECTED_HEADER.join(';')}", received "${receivedHeader}"`,
    );
  }

  return movieRows.map(({ record, info }) => {
    const [year, title, studios, producers, winner] = record;
    const result = movieRecordSchema.safeParse({
      year,
      title,
      studios,
      producers,
      winner,
    });

    if (!result.success) {
      const issue = result.error.issues[0];
      const field = String(issue?.path[0] ?? 'record');
      throw validationError(
        csvPath,
        info.lines,
        field,
        issue?.message ?? 'invalid record',
        result.error,
      );
    }

    return result.data;
  });
}

function isExpectedHeader(header: string[]): boolean {
  return (
    header.length === EXPECTED_HEADER.length &&
    header.every((field, index) => field === EXPECTED_HEADER[index])
  );
}
