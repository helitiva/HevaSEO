export interface StaffNavItem { label: string; href: string; icon: string; }
export interface StaffNavSection { title: string; items: StaffNavItem[]; }

export const STAFF_NAV: StaffNavSection[] = [
  { title: 'Work', items: [
    { label: 'My Day', href: '/staff', icon: 'ph-sun-horizon' },
    { label: 'My Tasks', href: '/staff/tasks', icon: 'ph-kanban' },
    { label: 'Calendar', href: '/staff/calendar', icon: 'ph-calendar-dots' },
    { label: 'Deliverables', href: '/staff/deliverables', icon: 'ph-file-arrow-up' },
  ]},
  { title: 'Knowledge', items: [
    { label: 'Docs', href: '/staff/docs', icon: 'ph-books' },
    { label: 'Notes', href: '/staff/notes', icon: 'ph-note-pencil' },
  ]},
  { title: 'Me', items: [
    { label: 'Finance', href: '/staff/finance', icon: 'ph-wallet' },
    { label: 'Performance', href: '/staff/performance', icon: 'ph-chart-line-up' },
    { label: 'Notifications', href: '/staff/notifications', icon: 'ph-bell' },
    { label: 'Settings', href: '/staff/settings', icon: 'ph-gear-six' },
  ]},
];
