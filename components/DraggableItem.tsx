import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Tile } from './Tile';
import { DragData } from '../types';

interface DraggableItemProps {
  id: string;
  char: string;
  origin: 'keyboard' | 'grid';
  index?: number; // Needed if origin is grid
  disabled?: boolean;
  onGridClick?: (index: number, char: string) => void;
}

export const DraggableItem: React.FC<DraggableItemProps> = ({ 
  id, 
  char, 
  origin, 
  index, 
  disabled,
  onGridClick 
}) => {
  const dragData: DragData = { origin, char, id, index };
  
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: id,
    data: dragData,
    disabled
  });

  const handleClick = () => {
    // Only speak if it's on the grid (placed)
    // dnd-kit normally absorbs clicks during drags, so this fires on clean clicks
    if (origin === 'grid' && onGridClick && index !== undefined) {
      onGridClick(index, char);
    }
  };

  if (isDragging) {
    // When dragging, we leave a "ghost" or empty space depending on requirements.
    // For keyboard: key stays visible (cloning).
    // For grid: key disappears from original spot (moving).
    if (origin === 'grid') {
        return <div ref={setNodeRef} className="w-full h-full opacity-0" />; 
    }
    // For keyboard, we keep the original visible, so we render it normally but maybe slightly dimmed or just static
    // Actually, dnd-kit handles the overlay separately. We just render the static one here.
    return (
        <div ref={setNodeRef} className="w-full h-full opacity-50">
             <Tile char={char} />
        </div>
    );
  }

  return (
    <div 
      ref={setNodeRef} 
      {...listeners} 
      {...attributes} 
      onClick={handleClick}
      className="w-full h-full"
    >
      <Tile char={char} />
    </div>
  );
};