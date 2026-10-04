
import { useRef, useEffect, useState } from 'react';

interface DraggableOptions<T> {
  type: string;
  item: T;
}

export function useDraggable<T>({ type, item }: DraggableOptions<T>) {
  const dragRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  useEffect(() => {
    const element = dragRef.current;
    if (!element) return;
    
    const handleDragStart = (e: DragEvent) => {
      if (e.dataTransfer) {
        setIsDragging(true);
        e.dataTransfer.setData('application/json', JSON.stringify({
          type,
          item
        }));
        e.dataTransfer.effectAllowed = 'move';
      }
    };
    
    const handleDragEnd = () => {
      setIsDragging(false);
    };
    
    // Let text marked data-nodrag (e.g. addresses) be selected/copied:
    // pause dragging while the press starts on such an element.
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[data-nodrag]')) {
        element.setAttribute('draggable', 'false');
      }
    };
    const restoreDraggable = () => {
      element.setAttribute('draggable', 'true');
    };

    element.setAttribute('draggable', 'true');
    element.addEventListener('dragstart', handleDragStart);
    element.addEventListener('dragend', handleDragEnd);
    element.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', restoreDraggable);

    return () => {
      element.removeAttribute('draggable');
      element.removeEventListener('dragstart', handleDragStart);
      element.removeEventListener('dragend', handleDragEnd);
      element.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', restoreDraggable);
    };
  }, [type, item]);
  
  return { dragRef, isDragging };
}
