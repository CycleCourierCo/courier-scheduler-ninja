
import { useRef, useEffect } from 'react';

interface DroppableOptions<T> {
  accept: string;
  onDrop: (item: T) => void;
}

export function useDroppable<T>({ accept, onDrop }: DroppableOptions<T>) {
  const dropRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const element = dropRef.current;
    if (!element) return;
    
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }
    };
    
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        try {
          const data = JSON.parse(e.dataTransfer.getData('application/json'));
          
          if (data && data.type === accept) {
            onDrop(data.item);
          }
        } catch (error) {
          console.error('Failed to parse dropped data:', error);
        }
      }
    };
    
    element.addEventListener('dragover', handleDragOver);
    element.addEventListener('drop', handleDrop);
    
    return () => {
      element.removeEventListener('dragover', handleDragOver);
      element.removeEventListener('drop', handleDrop);
    };
  }, [accept, onDrop]);
  
  return { dropRef };
}
