import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

export function NotFoundPage() {
  return (
    <Card>
      <EmptyState
        icon={<Compass className="h-7 w-7" aria-hidden />}
        title="No encontramos esa página"
        description="El enlace puede estar mal escrito o la sección ya no existe."
        action={
          <Link to="/">
            <Button>Volver al inicio</Button>
          </Link>
        }
      />
    </Card>
  );
}
