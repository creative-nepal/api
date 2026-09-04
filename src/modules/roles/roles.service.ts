import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { roles as builtInRoles, statement } from '../../auth/access-control';
import { type Database, InjectDatabase, schema } from '../../database';
import type { Business } from '../../database/schema';
import { AccessContextService } from '../../common/access/access-context.service';
import { composePermissions } from './permissions';

export type PermissionMap = Record<string, string[]>;

export interface RoleView {
  role: string;
  permission: PermissionMap;
  isBuiltIn: boolean;
  granted?: PermissionMap;
}

export interface RoleCatalogue {
  statements: Record<string, string[]>;
  roles: RoleView[];
}

const RESERVED_ROLES = new Set(['admin', 'member']);

@Injectable()
export class RolesService {
  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly accessContext: AccessContextService,
  ) {}

  statements(): Record<string, string[]> {
    return Object.fromEntries(
      Object.entries(statement).map(([resource, actions]) => [
        resource,
        [...(actions as readonly string[])],
      ]),
    );
  }

  private assertKnown(permission: Record<string, unknown>): PermissionMap {
    const catalogue = this.statements();
    const clean: PermissionMap = {};

    for (const [resource, actions] of Object.entries(permission)) {
      const allowed = catalogue[resource];

      if (!allowed) {
        throw new BadRequestException({
          message: 'i18n:errors.role.unknownResource',
          resource,
        });
      }

      if (!Array.isArray(actions) || actions.length === 0) {
        throw new BadRequestException({
          message: 'i18n:errors.role.emptyActions',
          resource,
        });
      }

      for (const action of actions) {
        if (typeof action !== 'string' || !allowed.includes(action)) {
          throw new BadRequestException({
            message: 'i18n:errors.role.unknownAction',
            resource,
            action: String(action),
          });
        }
      }

      clean[resource] = [...new Set(actions as string[])];
    }

    if (Object.keys(clean).length === 0) {
      throw new BadRequestException('i18n:errors.role.emptyPermission');
    }

    return clean;
  }

  private builtIn(): RoleView[] {
    return Object.entries(builtInRoles)
      .filter(([role]) => !RESERVED_ROLES.has(role))
      .map(([role, definition]) => ({
        role,
        permission: Object.fromEntries(
          Object.entries(
            definition.statements as Record<string, readonly string[]>,
          ).map(([resource, actions]) => [resource, [...actions]]),
        ),
        isBuiltIn: true,
      }));
  }

  private async stored(organizationId: string) {
    return this.db
      .select()
      .from(schema.organizationRole)
      .where(eq(schema.organizationRole.organizationId, organizationId));
  }

  async list(business: Business): Promise<RoleCatalogue> {
    const rows = await this.stored(business.organizationId);
    const views = new Map(this.builtIn().map((view) => [view.role, view]));

    for (const row of rows) {
      if (RESERVED_ROLES.has(row.role)) {
        continue;
      }

      const granted = this.parse(row.permission);
      const base = views.get(row.role);

      const merged: PermissionMap = { ...(base?.permission ?? {}) };
      for (const [resource, actions] of Object.entries(granted)) {
        merged[resource] = [
          ...new Set([...(merged[resource] ?? []), ...actions]),
        ];
      }

      views.set(row.role, {
        role: row.role,
        permission: merged,
        isBuiltIn: base?.isBuiltIn ?? false,
        granted,
      });
    }

    return { statements: this.statements(), roles: [...views.values()] };
  }

  async assertAssignable(organizationId: string, role: string): Promise<void> {
    if (RESERVED_ROLES.has(role)) {
      throw new BadRequestException({
        message: 'i18n:errors.role.reserved',
        role,
      });
    }

    const known =
      role in builtInRoles ||
      (await this.stored(organizationId)).some((row) => row.role === role);

    if (!known) {
      throw new BadRequestException({
        message: 'i18n:errors.role.unknown',
        role,
      });
    }
  }

  async create(
    business: Business,
    role: string,
    permission: Record<string, unknown>,
  ): Promise<RoleView> {
    if (RESERVED_ROLES.has(role)) {
      throw new BadRequestException({
        message: 'i18n:errors.role.reserved',
        role,
      });
    }

    const clean = this.assertKnown(permission);

    const [existing] = await this.db
      .select()
      .from(schema.organizationRole)
      .where(
        and(
          eq(schema.organizationRole.organizationId, business.organizationId),
          eq(schema.organizationRole.role, role),
        ),
      )
      .limit(1);

    if (existing) {
      throw new BadRequestException({
        message: 'i18n:errors.role.alreadyExists',
        role,
      });
    }

    await this.db.insert(schema.organizationRole).values({
      id: crypto.randomUUID(),
      organizationId: business.organizationId,
      role,
      permission: JSON.stringify(clean),
      createdAt: new Date(),
    });

    this.accessContext.invalidateOrganization(business.organizationId);

    return this.get(business, role);
  }

  async update(
    business: Business,
    role: string,
    permission: Record<string, unknown>,
  ): Promise<RoleView> {
    const clean = this.assertKnown(permission);

    const [row] = await this.db
      .update(schema.organizationRole)
      .set({ permission: JSON.stringify(clean), updatedAt: new Date() })
      .where(
        and(
          eq(schema.organizationRole.organizationId, business.organizationId),
          eq(schema.organizationRole.role, role),
        ),
      )
      .returning();

    if (!row) {
      throw new NotFoundException({
        message: 'i18n:errors.role.notFound',
        role,
      });
    }

    this.accessContext.invalidateOrganization(business.organizationId);

    return this.get(business, role);
  }

  async remove(business: Business, role: string): Promise<{ role: string }> {
    const [row] = await this.db
      .delete(schema.organizationRole)
      .where(
        and(
          eq(schema.organizationRole.organizationId, business.organizationId),
          eq(schema.organizationRole.role, role),
        ),
      )
      .returning();

    if (!row) {
      throw new NotFoundException({
        message: 'i18n:errors.role.notFound',
        role,
      });
    }

    this.accessContext.invalidateOrganization(business.organizationId);

    return { role };
  }

  async get(business: Business, role: string): Promise<RoleView> {
    const { roles } = await this.list(business);
    const found = roles.find((view) => view.role === role);

    if (!found) {
      throw new NotFoundException({
        message: 'i18n:errors.role.notFound',
        role,
      });
    }

    return found;
  }

  async permissionsFor(
    organizationId: string,
    memberRole: string,
  ): Promise<PermissionMap> {
    return composePermissions(memberRole, await this.stored(organizationId));
  }

  private parse(raw: string): PermissionMap {
    try {
      const parsed: unknown = JSON.parse(raw);
      return parsed && typeof parsed === 'object'
        ? (parsed as PermissionMap)
        : {};
    } catch {
      return {};
    }
  }
}
