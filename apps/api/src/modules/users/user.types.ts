export interface PublicUser {
  id: string;
  name: string;
  email: string;
  status: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
