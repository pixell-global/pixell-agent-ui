export type AuthUser = {
  id: string;
  email: string;
  displayName?: string;
};

export type Session = {
  uid: string;
  email: string;
  orgId?: string;
};
