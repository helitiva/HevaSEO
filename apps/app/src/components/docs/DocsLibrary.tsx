'use client';
import { useMemo } from 'react';
import { DocsClient } from '@/app/staff/docs/DocsClient';
import { useDocs } from '@/data/docsStore';
import { docsForCustomer, docsForManager, docsForStaff } from '@/data/staffDocs';
import { SKILL_META } from '@/data/adminMock';

type Audience = 'customer' | 'manager' | 'staff';

// One audience-aware docs list, shared by the customer / staff / manager docs pages. Reads
// the live docs store (seeds + admin-published docs) and funnels through the data-layer
// audience gate, so a doc only ever appears to an audience it was distributed to.
export function DocsLibrary({ audience, skills = [] }: { audience: Audience; skills?: string[] }) {
  const { docs } = useDocs();
  const visible = useMemo(() => {
    if (audience === 'customer') return docsForCustomer(docs);
    if (audience === 'manager') return docsForManager(docs);
    return docsForStaff(docs, skills);
  }, [docs, audience, skills]);
  const skillChips = audience === 'staff'
    ? skills.filter((k) => SKILL_META[k]).map((k) => ({ key: k, ...SKILL_META[k] }))
    : [];
  return <DocsClient docs={visible} skillChips={skillChips} />;
}
