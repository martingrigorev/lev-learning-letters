import React from 'react';
import { useDroppable } from '@dnd-kit/core';

interface DroppableCellProps {
  index: number;
  children?: React.ReactNode;
}

export const DroppableCell: React.FC<DroppableCellProps> = ({ index, children }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `cell-${index}`,
    data: { index, type: 'cell' },
  });

  return (
    <div
      ref={setNodeRef}
      className={`relative aspect-square border border-gray-700 rounded-sm transition-colors duration-200 ${
        isOver ? 'bg-gray-500/50' : 'bg-gray-800/30'
      }`}
    >
      {children}
    </div>
  );
};