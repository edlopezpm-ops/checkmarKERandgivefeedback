import { DomainError, emptyWorkspace, type Workspace } from '../src/core/domain.ts';
import type { Repository } from './api.ts';
export class D1Repository implements Repository {
  private db: D1Database;
  private studio: boolean;
  constructor(db: D1Database, studio = false) { this.db = db; this.studio = studio; }
  async read(): Promise<Workspace> {
    const row = await this.db.prepare('SELECT revision, document FROM marker_workspace WHERE id = 1').first<{ revision: number; document: string }>();
    return row ? { ...JSON.parse(row.document), revision: row.revision } : emptyWorkspace();
  }
  async save(state: Workspace, expectedRevision: number): Promise<void> {
    const document = JSON.stringify(state);
    if (new TextEncoder().encode(document).byteLength > 1_048_576) throw new DomainError('El espacio alojado supera el límite inicial de 1 MB de texto.');
    const result = this.studio && expectedRevision > 0
      ? await this.db.prepare(`UPDATE marker_workspace SET revision = ?, document = ? WHERE id = 1 AND revision = ?
          AND NOT EXISTS (SELECT 1 FROM marker_studio_campaigns WHERE product_id NOT IN (SELECT value FROM json_each(?)))
          AND NOT EXISTS (SELECT 1 FROM marker_studio_materials, json_each(marker_studio_materials.document,'$.productIds') product WHERE product.value NOT IN (SELECT value FROM json_each(?)))`)
          .bind(state.revision, document, expectedRevision, JSON.stringify(state.products.map(product => product.id)), JSON.stringify(state.products.map(product => product.id))).run()
      : expectedRevision === 0
      ? await this.db.prepare('INSERT INTO marker_workspace(id, revision, document) VALUES(1, 1, ?) ON CONFLICT(id) DO NOTHING').bind(document).run()
      : await this.db.prepare('UPDATE marker_workspace SET revision = ?, document = ? WHERE id = 1 AND revision = ?').bind(state.revision, document, expectedRevision).run();
    if (result.meta.changes !== 1) throw new DomainError('El espacio cambió. Recarga antes de volver a guardar.', 409);
  }
}
