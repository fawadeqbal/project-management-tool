import { create } from 'zustand';

/** Lets the "Invite people" command and the Home checklist open the invite dialog. */
export const useInviteDialogStore = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
