export const platforms = [
  "Instagram",
  "Facebook",
  "TikTok",
  "LinkedIn",
  "X",
] as const;
export type Platform = (typeof platforms)[number];
export type Product = {
  id: string;
  name: string;
  description: string;
  audience: string;
  language: string;
  tone: string;
  cta: string;
  url: string;
  status: "preparation" | "available" | "paused";
};
export type Account = {
  id: string;
  name: string;
  platform: Platform;
  url: string;
  productIds: string[];
  timezone: string;
  language: string;
};
export type Source = {
  id: string;
  productId: string;
  title: string;
  text: string;
  declaredDate: string;
  createdAt: string;
};
export type Campaign = {
  id: string;
  productId: string;
  title: string;
  objective: string;
  audience: string;
  sourceIds: string[];
  kind: "organic" | "paid";
  currency: string;
  budget: string;
  status: "draft" | "paused";
  createdAt: string;
};
export type Post = {
  id: string;
  campaignId: string;
  accountId: string;
  text: string;
  scheduledAt: string;
  status: "draft" | "ready" | "scheduled" | "published";
  formatConfirmed: boolean;
  externalUrl: string;
};
export type Workspace = {
  version: 1;
  revision: number;
  products: Product[];
  accounts: Account[];
  sources: Source[];
  campaigns: Campaign[];
  posts: Post[];
};
export type Command = { type: string; data: Record<string, unknown> };
export class DomainError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export function emptyWorkspace(): Workspace {
  return {
    version: 1,
    revision: 0,
    products: [],
    accounts: [],
    sources: [],
    campaigns: [],
    posts: [],
  };
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new DomainError("Solicitud inválida.");
  return value as Record<string, unknown>;
}
function text(
  data: Record<string, unknown>,
  key: string,
  max = 1000,
  required = false,
  trim = true,
): string {
  const value = data[key] ?? "";
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    throw new DomainError(`Revisa el campo ${key} (máximo ${max}).`);
  if (value.includes("\0"))
    throw new DomainError("No se admite contenido binario.");
  return trim ? value.trim() : value;
}
function ids(data: Record<string, unknown>, key: string): string[] {
  const value = data[key];
  if (
    !Array.isArray(value) ||
    value.length > 100 ||
    value.some((id) => typeof id !== "string")
  )
    throw new DomainError(`Selección inválida: ${key}.`);
  return [...new Set(value as string[])];
}
function choice<T extends string>(
  data: Record<string, unknown>,
  key: string,
  values: readonly T[],
): T {
  const value = data[key];
  if (!values.includes(value as T))
    throw new DomainError(`Valor inválido: ${key}.`);
  return value as T;
}
export function safeUrl(value: string): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:")
      throw new Error();
    if (url.username || url.password) throw new Error();
    return url.href;
  } catch {
    throw new DomainError("Usa una URL http/https sin credenciales.");
  }
}
function find<T extends { id: string }>(items: T[], id: string): T {
  const item = items.find((entry) => entry.id === id);
  if (!item)
    throw new DomainError("El registro ya no existe. Recarga la vista.", 404);
  return item;
}
function upsert<T extends { id: string }>(
  items: T[],
  item: T,
  editing: boolean,
) {
  if (editing) Object.assign(find(items, item.id), item);
  else {
    if (items.length >= 1000)
      throw new DomainError("Límite local de 1.000 registros por colección.");
    items.push(item);
  }
}
export function sourceInUse(state: Workspace, id: string): boolean {
  return state.campaigns.some((campaign) => campaign.sourceIds.includes(id));
}
export function applyCommand(
  previous: Workspace,
  command: Command,
  now = new Date().toISOString(),
  newId = () => crypto.randomUUID(),
): Workspace {
  const state = structuredClone(previous),
    data = object(command.data);
  const editingId = text(data, "id", 100),
    id = editingId || newId();
  switch (command.type) {
    case "product.save": {
      const product: Product = {
        id,
        name: text(data, "name", 120, true),
        description: text(data, "description", 5000),
        audience: text(data, "audience"),
        language: text(data, "language", 80),
        tone: text(data, "tone"),
        cta: text(data, "cta"),
        url: safeUrl(text(data, "url", 2000)),
        status: choice(data, "status", ["preparation", "available", "paused"]),
      };
      upsert(state.products, product, !!editingId);
      break;
    }
    case "product.delete": {
      find(state.products, id);
      if (
        state.accounts.some((a) => a.productIds.includes(id)) ||
        state.sources.some((s) => s.productId === id) ||
        state.campaigns.some((c) => c.productId === id)
      )
        throw new DomainError(
          "El producto tiene cuentas, materiales o campañas vinculados.",
          409,
        );
      state.products = state.products.filter((p) => p.id !== id);
      break;
    }
    case "account.save": {
      const productIds = ids(data, "productIds");
      if (!productIds.length)
        throw new DomainError("Vincula al menos un producto.");
      productIds.forEach((productId) => find(state.products, productId));
      const timezone = text(data, "timezone", 100, true);
      try {
        new Intl.DateTimeFormat("es", { timeZone: timezone }).format();
      } catch {
        throw new DomainError("Zona horaria inválida.");
      }
      const account: Account = {
        id,
        name: text(data, "name", 120, true),
        platform: choice(data, "platform", platforms),
        url: safeUrl(text(data, "url", 2000, true)),
        productIds,
        timezone,
        language: text(data, "language", 80),
      };
      if (
        editingId &&
        state.posts.some(
          (p) =>
            p.accountId === id &&
            !productIds.includes(find(state.campaigns, p.campaignId).productId),
        )
      )
        throw new DomainError(
          "La cuenta tiene publicaciones del producto que intentas desvincular.",
          409,
        );
      if (
        editingId &&
        find(state.accounts, id).platform !== account.platform &&
        state.posts.some((p) => p.accountId === id)
      )
        throw new DomainError(
          "No cambies la red de una cuenta con publicaciones.",
          409,
        );
      upsert(state.accounts, account, !!editingId);
      break;
    }
    case "account.delete": {
      find(state.accounts, id);
      if (state.posts.some((p) => p.accountId === id))
        throw new DomainError("La cuenta tiene publicaciones vinculadas.", 409);
      state.accounts = state.accounts.filter((a) => a.id !== id);
      break;
    }
    case "source.save": {
      const productId = text(data, "productId", 100, true);
      find(state.products, productId);
      if (editingId && sourceInUse(state, id))
        throw new DomainError(
          "El material está asociado a una campaña. Conserva la fuente de revisión.",
          409,
        );
      const declaredDate = text(data, "declaredDate", 10);
      if (
        declaredDate &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(declaredDate) ||
          !Number.isFinite(Date.parse(declaredDate)) ||
          new Date(declaredDate).toISOString().slice(0, 10) !== declaredDate)
      )
        throw new DomainError("Fecha del material inválida.");
      upsert(
        state.sources,
        {
          id,
          productId,
          title: text(data, "title", 160, true),
          text: text(data, "text", 64_000, true, false),
          declaredDate,
          createdAt: editingId ? find(state.sources, id).createdAt : now,
        },
        !!editingId,
      );
      break;
    }
    case "source.delete": {
      find(state.sources, id);
      if (sourceInUse(state, id))
        throw new DomainError(
          "Hay campañas que necesitan esta fuente. Elimina sus dependencias primero.",
          409,
        );
      state.sources = state.sources.filter((s) => s.id !== id);
      break;
    }
    case "campaign.create": {
      if (editingId)
        throw new DomainError(
          "Una nueva campaña no admite un identificador previo.",
        );
      const productId = text(data, "productId", 100, true);
      find(state.products, productId);
      const sourceIds = ids(data, "sourceIds"),
        accountIds = ids(data, "accountIds");
      if (!sourceIds.length || !accountIds.length)
        throw new DomainError("Selecciona material y al menos una cuenta.");
      sourceIds.forEach((sourceId) => {
        if (find(state.sources, sourceId).productId !== productId)
          throw new DomainError("El material pertenece a otro producto.");
      });
      accountIds.forEach((accountId) => {
        if (!find(state.accounts, accountId).productIds.includes(productId))
          throw new DomainError("La cuenta no admite este producto.");
      });
      const kind = choice(data, "kind", ["organic", "paid"]);
      const currency = text(data, "currency", 3),
        budget = text(data, "budget", 30);
      if (
        kind === "paid" &&
        (!/^[A-Z]{3}$/.test(currency) ||
          !/^\d+(\.\d{1,2})?$/.test(budget) ||
          Number(budget) <= 0)
      )
        throw new DomainError(
          "La propuesta paga requiere moneda ISO y presupuesto positivo; no autoriza gasto.",
        );
      if (state.posts.length + accountIds.length > 1000)
        throw new DomainError("Límite local de publicaciones alcanzado.");
      upsert(
        state.campaigns,
        {
          id,
          productId,
          title: text(data, "title", 160, true),
          objective: text(data, "objective", 2000, true),
          audience: text(data, "audience"),
          sourceIds,
          kind,
          currency: kind === "paid" ? currency : "",
          budget: kind === "paid" ? budget : "",
          status: kind === "paid" ? "paused" : "draft",
          createdAt: now,
        },
        false,
      );
      // Explicit manual drafts. No model is called and no commercial copy is invented.
      for (const accountId of accountIds)
        state.posts.push({
          id: newId(),
          campaignId: id,
          accountId,
          text: "",
          scheduledAt: "",
          status: "draft",
          formatConfirmed: false,
          externalUrl: "",
        });
      break;
    }
    case "campaign.delete": {
      find(state.campaigns, id);
      if (state.posts.some((p) => p.campaignId === id))
        throw new DomainError(
          "Retira primero las publicaciones de la campaña.",
          409,
        );
      state.campaigns = state.campaigns.filter((c) => c.id !== id);
      break;
    }
    case "post.save": {
      const post = find(state.posts, id);
      if (post.status === "published" || post.status === "scheduled")
        throw new DomainError(
          "La salida ya fue confirmada; conserva su evidencia.",
          409,
        );
      const scheduledAt = text(data, "scheduledAt", 40);
      if (scheduledAt && !Number.isFinite(Date.parse(scheduledAt)))
        throw new DomainError("Fecha de publicación inválida.");
      const instant = scheduledAt ? new Date(scheduledAt).toISOString() : "";
      if (
        instant &&
        state.posts.some(
          (p) =>
            p.id !== id &&
            p.accountId === post.accountId &&
            p.scheduledAt === instant,
        )
      )
        throw new DomainError(
          "Esta cuenta ya tiene una publicación en ese horario, incluso desde otro producto.",
          409,
        );
      const status = choice(data, "status", ["draft", "ready"]);
      const copy = text(data, "text", 20_000, status === "ready", false);
      if (status === "ready" && data.formatConfirmed !== true)
        throw new DomainError(
          "Confirma la revisión del formato en el destino antes de marcar listo.",
        );
      const account = find(state.accounts, post.accountId);
      if (
        status === "ready" &&
        (account.platform === "Instagram" || account.platform === "TikTok")
      )
        throw new DomainError(
          "Este destino requiere una pieza multimedia. Este incremento admite borradores de texto; conserva el estado borrador.",
        );
      Object.assign(post, {
        text: copy,
        scheduledAt: instant,
        status,
        formatConfirmed: data.formatConfirmed === true,
      });
      break;
    }
    case "post.confirm": {
      const post = find(state.posts, id);
      if (post.status !== "ready")
        throw new DomainError(
          "Revisa y marca la publicación como lista antes de confirmar su salida.",
          409,
        );
      if (find(state.campaigns, post.campaignId).kind === "paid")
        throw new DomainError(
          "La propuesta paga permanece pausada. Este incremento no activa ni confirma gasto.",
          409,
        );
      const status = choice(data, "status", ["scheduled", "published"]);
      const externalUrl = safeUrl(text(data, "externalUrl", 2000, true));
      if (data.confirmed !== true)
        throw new DomainError(
          "La entrega requiere confirmación humana explícita.",
        );
      Object.assign(post, { status, externalUrl });
      break;
    }
    case "post.delete": {
      find(state.posts, id);
      // Explicit erasure only. Copy/download, a clock or a status change never purge content.
      if (data.confirmed !== true)
        throw new DomainError("Confirma el borrado del texto y del registro.");
      state.posts = state.posts.filter((p) => p.id !== id);
      break;
    }
    default:
      throw new DomainError("Operación no admitida.");
  }
  state.revision++;
  if (
    new TextEncoder().encode(JSON.stringify(state)).byteLength >
    4 * 1024 * 1024
  )
    throw new DomainError(
      "El espacio supera el límite de este incremento (4 MB de texto).",
    );
  return state;
}
