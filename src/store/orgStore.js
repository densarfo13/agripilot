import { create } from 'zustand';

/**
 * Organization context store for super_admin org switching.
 *
 * - super_admin can optionally filter to a specific org via selectedOrgId.
 * - All other roles see only their own org (set from user.organization on login).
 * - When selectedOrgId is set, API calls include ?orgId= for backend scoping.
 * - When null, super_admin sees cross-org (all data).
 */
export const useOrgStore = create((set) => ({
  // The org currently selected for filtering (super_admin only)
  selectedOrgId: null,
  selectedOrgName: null,

  // Available organizations (loaded for super_admin)
  organizations: [],

  setSelectedOrg: (orgId, orgName) => set({ selectedOrgId: orgId || null, selectedOrgName: orgName || null }),

  clearSelectedOrg: () => set({ selectedOrgId: null, selectedOrgName: null }),

  setOrganizations: (orgs) => set({ organizations: orgs }),
}));
