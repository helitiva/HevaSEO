'use client';
import { useMemo } from 'react';
import { DocsClient } from '@/app/staff/docs/DocsClient';
import { useDocs } from '@/data/docsStore';
import { docsForCustomer, docsForManager, docsForStaff, type StaffDoc } from '@/data/staffDocs';
import { SKILL_META } from '@/data/adminMock';

type Audience = 'customer' | 'manager' | 'staff';

// One audience-aware docs list, shared by the customer / staff / manager docs pages. When `docs` is
// passed (Lane C inc-C1: real DB docs, already array-RLS-scoped server-side) it's used as-is; otherwise
// it falls back to the mock store funneled through the data-layer audience gate.
export function DocsLibrary({ audience, skills = [], docs: realDocs }: { audience: Audience; skills?: string[]; docs?: StaffDoc[] }) {
  const { docs } = useDocs();
  const visible = useMemo(() => {
    if (realDocs) return realDocs; // RLS already scoped to this viewer's role (+ skills) server-side
    if (audience === 'customer') return docsForCustomer(docs);
    if (audience === 'manager') return docsForManager(docs);
    return docsForStaff(docs, skills);
  }, [realDocs, docs, audience, skills]);
  const skillChips = audience === 'staff'
    ? skills.filter((k) => SKILL_META[k]).map((k) => ({ key: k, ...SKILL_META[k] }))
    : [];
  // The "you can read docs for …" scope banner only makes sense for staff (skill-gated visibility);
  // customer/manager see everything distributed to their audience, so nothing "stays hidden" by skill.
  return <DocsClient docs={visible} skillChips={skillChips} showScopeBanner={audience === 'staff'} />;
}
