import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

// Header "Create" menu links to e.g. /leads?new=1 — open the page's create drawer, then drop the param.
export function useOpenOnNewParam(open) {
  const [params, setParams] = useSearchParams();
  const wantsNew = params.get('new') === '1';

  useEffect(() => {
    if (!wantsNew) return;
    open();
    params.delete('new');
    setParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsNew]);
}
