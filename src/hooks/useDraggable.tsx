
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
    
    element.setAttribute('draggable', 'true');
    element.addEventListener('dragstart', handleDragStart);
    element.addEventListener('dragend', handleDragEnd);
    
    return () => {
      element.removeAttribute('draggable');
      element.removeEventListener('dragstart', handleDragStart);
      element.removeEventListener('dragend', handleDragEnd);
    };
  }, [type, item]);
  
  return { dragRef, isDragging };
}
