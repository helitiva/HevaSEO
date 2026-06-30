import type { DocAudience } from '@/data/staffDocs';

// Lane C inc-C3 — bridge between the composer's audience model and the DB's. The composer/UI conflates
// role + staff-skill into one DocAudience list (e.g. ['customer','keyword'] = customers + keyword staff,
// 'general' = all staff ungated). The DB splits them: `audiences` = role audiences (customer/staff/manager)
// and `required_skills` = the staff skill-gate. These two functions are the single source for the round-trip.

const ROLE_AUDIENCES = new Set<DocAudience>(['customer', 'manager']);

// composer audiences → DB columns. 'general' or any skill tag implies the staff audience; 'general'
// (all staff) wins over skill gating, so it clears required_skills.
export function composerToDb(composer: DocAudience[]): { audiences: string[]; requiredSkills: string[] } {
  const audiences = new Set<string>();
  const skills = new Set<string>();
  let ungatedStaff = false;
  for (const a of composer) {
    if (a === 'customer' || a === 'manager') audiences.add(a);
    else if (a === 'general') { audiences.add('staff'); ungatedStaff = true; }
    else { audiences.add('staff'); skills.add(a); } // a skill tag (keyword/backlink/content/optimize)
  }
  return { audiences: [...audiences], requiredSkills: ungatedStaff ? [] : [...skills] };
}

// DB columns → composer audiences (for the list badges + edit round-trip). The staff audience expands
// to its skill tags, or to 'general' when ungated.
export function dbToComposer(audiences: string[], requiredSkills: string[]): DocAudience[] {
  const out: DocAudience[] = [];
  if (audiences.includes('customer')) out.push('customer');
  if (audiences.includes('manager')) out.push('manager');
  if (audiences.includes('staff')) {
    if (requiredSkills.length) out.push(...(requiredSkills as DocAudience[]));
    else out.push('general');
  }
  return out;
}
