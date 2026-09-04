import ExcelJS from 'exceljs';

export interface ReportColumn<TRow> {
  header: string;
  key: keyof TRow & string;
  width: number;
}

export interface ReportExport {
  filename: string;
  contentType: string;
  body: Buffer;
}

const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function toRupees(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

function escapeCsv(value: string | number): string {
  const raw = String(value);
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

export function buildCsv<TRow>(
  columns: readonly ReportColumn<TRow>[],
  rows: readonly TRow[],
): Buffer {
  const lines = [
    columns.map((column) => escapeCsv(column.header)).join(','),
    ...rows.map((row) =>
      columns
        .map((column) => escapeCsv(row[column.key] as string | number))
        .join(','),
    ),
  ];

  return Buffer.from(`\ufeff${lines.join('\n')}\n`, 'utf8');
}

export interface XlsxOptions<TRow> {
  sheetName: string;
  title: string;
  subtitle: string[];
  columns: readonly ReportColumn<TRow>[];
  rows: readonly TRow[];
  totalColumns?: readonly (keyof TRow & string)[];
}

export async function buildXlsx<TRow>(
  options: XlsxOptions<TRow>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(options.sheetName);

  sheet.addRow([options.title]);
  sheet.addRow(options.subtitle);
  sheet.addRow([]);

  sheet.columns = options.columns.map((column) => ({
    key: column.key,
    width: column.width,
  }));

  sheet.addRow(options.columns.map((column) => column.header)).font = {
    bold: true,
  };

  for (const row of options.rows) {
    sheet.addRow(options.columns.map((column) => row[column.key]));
  }

  if (options.totalColumns?.length) {
    const totals = options.columns.map((column, index) => {
      if (index === 0) {
        return 'जम्मा (Total)';
      }

      if (!options.totalColumns?.includes(column.key)) {
        return '';
      }

      return Number(
        options.rows
          .reduce((sum, row) => sum + Number(row[column.key] ?? 0), 0)
          .toFixed(2),
      );
    });

    sheet.addRow(totals).font = { bold: true };
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function buildReport<TRow>(
  format: 'xlsx' | 'csv',
  baseName: string,
  options: XlsxOptions<TRow>,
): Promise<ReportExport> {
  if (format === 'csv') {
    return {
      filename: `${baseName}.csv`,
      contentType: 'text/csv; charset=utf-8',
      body: buildCsv(options.columns, options.rows),
    };
  }

  return {
    filename: `${baseName}.xlsx`,
    contentType: XLSX_CONTENT_TYPE,
    body: await buildXlsx(options),
  };
}

export interface DownloadResponse {
  status(code: number): DownloadResponse;
  setHeader(name: string, value: string): DownloadResponse;
  send(body: Buffer): unknown;
}

export function sendReport(
  response: DownloadResponse,
  report: ReportExport,
): void {
  response
    .status(200)
    .setHeader('Content-Type', report.contentType)
    .setHeader(
      'Content-Disposition',
      `attachment; filename="${report.filename.replace(/"/g, '')}"`,
    )
    .send(report.body);
}
