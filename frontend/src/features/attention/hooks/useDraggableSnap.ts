import { useState, useRef, useCallback, useEffect } from 'react';

export type SnapCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface DragPos {
  x: number;
  y: number;
}

interface UseDraggableSnapReturn {
  corner: SnapCorner;
  isDragging: boolean;
  dragPos: DragPos | null;
  widgetRef: React.RefObject<HTMLDivElement | null>;
  onDragHandleMouseDown: (e: React.MouseEvent) => void;
}

function getClosestCorner(x: number, y: number): SnapCorner {
  const midX = window.innerWidth / 2;
  const midY = window.innerHeight / 2;
  if (x >= midX && y >= midY) return 'bottom-right';
  if (x <  midX && y >= midY) return 'bottom-left';
  if (x >= midX && y <  midY) return 'top-right';
  return 'top-left';
}

export function useDraggableSnap(defaultCorner: SnapCorner = 'bottom-right'): UseDraggableSnapReturn {
  const [corner, setCorner] = useState<SnapCorner>(defaultCorner);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPos, setDragPos] = useState<DragPos | null>(null);
  const hasUserDraggedRef = useRef(false);

  const widgetRef = useRef<HTMLDivElement | null>(null);
  const dragOriginRef = useRef<{ mouseX: number; mouseY: number; elemX: number; elemY: number } | null>(null);

  const onDragHandleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!widgetRef.current) return;
    const rect = widgetRef.current.getBoundingClientRect();
    dragOriginRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      elemX: rect.left,
      elemY: rect.top,
    };
    setIsDragging(true);
    setDragPos({ x: rect.left, y: rect.top });
    e.preventDefault();
  }, []);

  useEffect(() => {
    if (!hasUserDraggedRef.current) {
      setCorner(defaultCorner);
    }
  }, [defaultCorner]);

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!dragOriginRef.current) return;
      const dx = e.clientX - dragOriginRef.current.mouseX;
      const dy = e.clientY - dragOriginRef.current.mouseY;
      setDragPos({
        x: dragOriginRef.current.elemX + dx,
        y: dragOriginRef.current.elemY + dy,
      });
    };

    const onMouseUp = (e: MouseEvent) => {
      setIsDragging(false);
      setDragPos(null);
      setCorner(getClosestCorner(e.clientX, e.clientY));
      hasUserDraggedRef.current = true;
      dragOriginRef.current = null;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging]);

  return { corner, isDragging, dragPos, widgetRef, onDragHandleMouseDown };
}
