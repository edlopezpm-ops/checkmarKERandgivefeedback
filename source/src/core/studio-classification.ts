import type { MaterialCategory, MaterialRole, StudioAsset, StudioMaterial } from './studio.ts';

/** Missing labels only. Names are declared hints, never evidence of media content. */
export function classifyStudioMaterial(material: StudioMaterial, asset?: StudioAsset): Pick<StudioMaterial, 'categories' | 'roles'> {
  const name = `${material.title} ${asset?.name ?? ''}`.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const hint = (pattern: string) => new RegExp(`(?:^|[^a-z0-9])(?:${pattern})(?:$|[^a-z0-9])`).test(name);
  let categories: MaterialCategory[] = [], roles: MaterialRole[] = [];
  switch (material.kind) {
    case 'image': categories = ['photo']; roles = ['background']; break;
    case 'idea': categories = ['idea']; roles = ['message']; break;
    case 'text': categories = ['ready-text']; roles = ['message']; break;
    case 'video':
      if (hint('b[-_ ]?roll')) categories.push('broll');
      if (hint('demo')) categories.push('demo');
      if (hint('talking|hablando')) categories.push('talking');
      if (hint('testimonial|testimonio')) categories.push('testimonial');
      roles = ['background'];
      break;
    case 'audio':
      if (hint('voice|voz|narration|narracion|locucion') || material.categories.includes('voice')) { categories = ['voice']; roles = ['narration']; }
      break;
  }
  return { categories: [...(material.categories.length ? material.categories : categories)], roles: [...(material.roles.length ? material.roles : roles)] };
}
