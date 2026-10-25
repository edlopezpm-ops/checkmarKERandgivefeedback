import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  emptyWorkspace,
  DomainError,
  type Workspace,
} from "../src/core/domain.ts";
import type { Repository } from "./api.ts";

/** Loopback engineering storage only. Production uses PostgreSQL/Auth. */
export class LocalRepository implements Repository {
  private path: string;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(path: string) {
    this.path = path;
  }
  async read(): Promise<Workspace> {
    try {
      const state: Workspace = JSON.parse(await readFile(this.path, "utf8"));
      if (
        state.version !== 1 ||
        !Number.isInteger(state.revision) ||
        !["products", "accounts", "sources", "campaigns", "posts"].every(
          (key) => Array.isArray(state[key as keyof Workspace]),
        )
      )
        throw new Error("Invalid workspace");
      return state;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return emptyWorkspace();
      throw error;
    }
  }
  save(state: Workspace, expectedRevision: number): Promise<void> {
    const write = async () => {
      if ((await this.read()).revision !== expectedRevision)
        throw new DomainError(
          "Conflicto de edición. Recarga antes de guardar.",
          409,
        );
      await mkdir(dirname(this.path), { recursive: true });
      const temp = `${this.path}.${crypto.randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify(state), {
        encoding: "utf8",
        mode: 0o600,
      });
      await rename(temp, this.path);
    };
    const result = this.queue.then(write, write);
    this.queue = result.catch(() => {});
    return result;
  }
}
