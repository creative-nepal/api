import { Exclude, Expose } from 'class-transformer';
import type { StockTake, StockTakeLine } from '../../../database/schema';

@Exclude()
export class StockTakeLineResponseDto {
  @Expose() id: string;
  @Expose() productId: string;
  @Expose() productName: string;
  @Expose() batchId: string | null;
  @Expose() batchNo: string | null;
  @Expose() systemQty: number;
  @Expose() countedQty: number | null;
  @Expose() varianceQty: number | null;
  @Expose() countedAt: Date | null;

  constructor(line: StockTakeLine) {
    this.id = line.id;
    this.productId = line.productId;
    this.productName = line.productName;
    this.batchId = line.batchId;
    this.batchNo = line.batchNo;
    this.systemQty = Number(line.systemQty);
    this.countedQty = line.countedQty === null ? null : Number(line.countedQty);
    this.varianceQty =
      this.countedQty === null ? null : this.countedQty - this.systemQty;
    this.countedAt = line.countedAt;
  }
}

@Exclude()
export class StockTakeResponseDto {
  @Expose() id: string;
  @Expose() businessId: string;
  @Expose() branchId: string;
  @Expose() reference: string;
  @Expose() status: string;
  @Expose() note: string | null;
  @Expose() closedAt: Date | null;
  @Expose() createdAt: Date;

  constructor(stockTake: StockTake) {
    this.id = stockTake.id;
    this.businessId = stockTake.businessId;
    this.branchId = stockTake.branchId;
    this.reference = stockTake.reference;
    this.status = stockTake.status;
    this.note = stockTake.note;
    this.closedAt = stockTake.closedAt;
    this.createdAt = stockTake.createdAt;
  }
}

@Exclude()
export class StockTakeDetailResponseDto extends StockTakeResponseDto {
  @Expose() lines: StockTakeLineResponseDto[];
  @Expose() countedLines: number;
  @Expose() varianceLines: number;

  constructor(stockTake: StockTake, lines: StockTakeLine[]) {
    super(stockTake);
    this.lines = lines.map((line) => new StockTakeLineResponseDto(line));
    this.countedLines = this.lines.filter(
      (line) => line.countedQty !== null,
    ).length;
    this.varianceLines = this.lines.filter(
      (line) => line.varianceQty !== null && line.varianceQty !== 0,
    ).length;
  }
}
