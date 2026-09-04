import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
} from 'class-validator';

export class TransferTableDto {
  @IsString()
  @IsNotEmpty()
  toTableId!: string;
}

export class MergeTablesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  sourceTableIds!: string[];
}

export class TableMoveResultDto {
  tableId: string;
  tableNo: string;
  ordersMoved: number;
  fromTableNos: string[];

  constructor(
    tableId: string,
    tableNo: string,
    ordersMoved: number,
    fromTableNos: string[],
  ) {
    this.tableId = tableId;
    this.tableNo = tableNo;
    this.ordersMoved = ordersMoved;
    this.fromTableNos = fromTableNos;
  }
}
