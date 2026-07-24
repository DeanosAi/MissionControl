import { requireAdminSession } from '@/lib/auth/session';

import { Sprint16ConceptLab } from './sprint-16-concept-lab';

export default async function Sprint16DesignPage() {
  await requireAdminSession();
  return <Sprint16ConceptLab />;
}

