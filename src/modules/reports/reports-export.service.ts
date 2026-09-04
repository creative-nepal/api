import { Injectable } from '@nestjs/common';
import {
  buildReport,
  type ReportExport,
  toRupees,
} from '../../common/reporting';
import type { AgingReport } from './ledgers.service';
import type { ProfitReport } from './profit.service';
import type { StockMovementReport } from './stock-movement.service';

type Format = 'xlsx' | 'csv';

interface ProfitRow {
  name: string;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

interface AgingRow {
  name: string;
  phone: string;
  current: number;
  days31To60: number;
  days61To90: number;
  over90: number;
  total: number;
  oldestDays: number;
}

interface MovementRow {
  at: string;
  source: string;
  reference: string;
  note: string;
  quantity: number;
  running: number;
}

const PROFIT_COLUMNS = [
  { header: 'Item', key: 'name' as const, width: 32 },
  { header: 'Qty sold', key: 'quantity' as const, width: 12 },
  { header: 'Revenue', key: 'revenue' as const, width: 14 },
  { header: 'Cost', key: 'cost' as const, width: 14 },
  { header: 'Profit', key: 'profit' as const, width: 14 },
  { header: 'Margin %', key: 'margin' as const, width: 10 },
];

const AGING_COLUMNS = [
  { header: 'Name', key: 'name' as const, width: 28 },
  { header: 'Contact', key: 'phone' as const, width: 16 },
  { header: '0-30 days', key: 'current' as const, width: 14 },
  { header: '31-60 days', key: 'days31To60' as const, width: 14 },
  { header: '61-90 days', key: 'days61To90' as const, width: 14 },
  { header: 'Over 90 days', key: 'over90' as const, width: 14 },
  { header: 'Total', key: 'total' as const, width: 14 },
  { header: 'Oldest (days)', key: 'oldestDays' as const, width: 14 },
];

const MOVEMENT_COLUMNS = [
  { header: 'Date', key: 'at' as const, width: 22 },
  { header: 'Source', key: 'source' as const, width: 14 },
  { header: 'Reference', key: 'reference' as const, width: 28 },
  { header: 'Note', key: 'note' as const, width: 28 },
  { header: 'In / out', key: 'quantity' as const, width: 12 },
  { header: 'Balance', key: 'running' as const, width: 12 },
];

function day(iso: string): string {
  return iso.slice(0, 10);
}

@Injectable()
export class ReportsExportService {
  async profit(
    report: ProfitReport,
    businessName: string,
    format: Format,
  ): Promise<ReportExport> {
    return buildReport<ProfitRow>(format, 'profit-report', {
      sheetName: 'Profit',
      title: `${businessName} — profit report`,
      subtitle: [
        `${day(report.from)} to ${day(report.to)}`,
        `Revenue ${toRupees(report.totals.revenueCents)} · Cost ${toRupees(report.totals.costCents)} · Profit ${toRupees(report.totals.profitCents)} (${report.totals.marginPercent}%)`,
        ...(report.uncosted > 0
          ? [`${report.uncosted} line(s) have no recorded cost`]
          : []),
      ],
      columns: PROFIT_COLUMNS,
      rows: report.lines.map((line) => ({
        name: line.name,
        quantity: line.quantity,
        revenue: toRupees(line.revenueCents),
        cost: toRupees(line.costCents),
        profit: toRupees(line.profitCents),
        margin: line.marginPercent,
      })),
      totalColumns: ['revenue', 'cost', 'profit'],
    });
  }

  async aging(
    report: AgingReport,
    businessName: string,
    kind: 'receivables' | 'payables',
    format: Format,
  ): Promise<ReportExport> {
    return buildReport<AgingRow>(format, `${kind}-aging`, {
      sheetName: kind === 'receivables' ? 'Receivables' : 'Payables',
      title: `${businessName} — ${kind} aging`,
      subtitle: [
        `As of ${day(report.asOf)}`,
        `Outstanding ${toRupees(report.totals.totalCents)}`,
      ],
      columns: AGING_COLUMNS,
      rows: report.parties.map((party) => ({
        name: party.name,
        phone: party.phone ?? '',
        current: toRupees(party.currentCents),
        days31To60: toRupees(party.days31To60Cents),
        days61To90: toRupees(party.days61To90Cents),
        over90: toRupees(party.over90Cents),
        total: toRupees(party.totalCents),
        oldestDays: party.oldestDays,
      })),
      totalColumns: ['current', 'days31To60', 'days61To90', 'over90', 'total'],
    });
  }

  async stockMovement(
    report: StockMovementReport,
    businessName: string,
    format: Format,
  ): Promise<ReportExport> {
    return buildReport<MovementRow>(format, 'stock-movement', {
      sheetName: 'Movement',
      title: `${businessName} — ${report.name} stock movement`,
      subtitle: [
        `${day(report.from)} to ${day(report.to)}`,
        `Opening ${report.openingQty} ${report.unitType} · In ${report.inQty} · Out ${report.outQty} · Closing ${report.closingQty}`,
      ],
      columns: MOVEMENT_COLUMNS,
      rows: report.movements.map((movement) => ({
        at: movement.at.replace('T', ' ').slice(0, 19),
        source: movement.source,
        reference: movement.reference ?? '',
        note: movement.note ?? '',
        quantity: movement.quantity,
        running: movement.runningQty,
      })),
    });
  }
}
