const fields = ['description','outcome','outcomes','goal','level','hours','prerequisites','audience','capstone','assessment','assessment_policy','tools','costs','format','lesson_type','minutes']
const safeValue = value => typeof value === 'string' || typeof value === 'number' || (Array.isArray(value) && value.every(v => typeof v === 'string'))

/** A small, explicit public schema, even when the input includes authored content. */
export function publicAcademyCatalog(catalog) {
  return { entities: catalog.entities.filter(n => ['direction','course','module','lesson'].includes(n.kind) && ['outline','published'].includes(n.state)).map(n => ({
    code: n.code, kind: n.kind, parent_code: n.parent_code, title: n.title, position: n.position,
    state: 'outline', version: 1, seed_managed: true,
    data: Object.fromEntries(fields.filter(key => safeValue(n.data[key])).map(key => [key, n.data[key]])),
  })) }
}
