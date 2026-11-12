import { useEffect, useMemo, useRef, useState } from 'react';
import { ScreenRecorder } from './ScreenRecorder.js';

export function useScreenRecorder() {
  const controllerRef = useRef(null);
  if (!controllerRef.current) controllerRef.current = new ScreenRecorder();
  const controller = controllerRef.current;
  const [snapshot, setSnapshot] = useState(() => controller.snapshot());
  useEffect(() => {
    const unsubscribe = controller.subscribe(setSnapshot);
    setSnapshot(controller.snapshot());
    return () => { unsubscribe(); controller.dispose(); };
  }, [controller]);
  const actions = useMemo(() => ({ start: () => controller.start(), stop: () => controller.stop(), reset: () => controller.reset() }), [controller]);
  return { ...snapshot, ...actions };
}
