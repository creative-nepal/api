import type { DatabaseExecutor } from '../../../database';
import type {
  Branch,
  Business,
  BusinessInvoice,
  Customer,
  MenuItem,
  Order,
  OrderItem,
  Product,
  Sector,
  SelectedModifier,
  ServiceItem,
} from '../../../database/schema';
import type { CheckoutItemDto, CreateOrderDto } from '../dto/order-request.dto';

export interface CheckoutLine {
  product: Product | null;
  menuItem?: MenuItem | null;
  serviceItem?: ServiceItem | null;
  modifiers?: SelectedModifier[];
  note?: string | null;
  quantity: number;
  unitPriceCents: number;
  unitCostCents?: number;
  lineTotalCents: number;
  discountCents?: number;
  batchId: string | null;
}

export interface CheckoutContext {
  executor: DatabaseExecutor;
  business: Business;
  branch: Branch;
  dto: CreateOrderDto;
  actorUserId: string | null;
  headers: Record<string, string | string[] | undefined>;
}

export interface CheckoutCommitted {
  order: Order;
  items: OrderItem[];
  invoice: BusinessInvoice | null;
  lines: CheckoutLine[];
  customer: Customer | null;
}

export interface SectorPlugin {
  readonly sector: Sector;

  billsOnCreate(dto: CreateOrderDto): boolean;

  beforeCreate(business: Business): void;

  onLineItemAdd(
    context: CheckoutContext,
    item: CheckoutItemDto,
  ): Promise<CheckoutLine[]>;

  beforeCheckout(
    context: CheckoutContext,
    lines: CheckoutLine[],
    customer: Customer | null,
  ): Promise<void>;

  afterCheckout(
    context: CheckoutContext,
    committed: CheckoutCommitted,
  ): Promise<void>;
}
