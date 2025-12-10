import React from 'react';
import { VOWELS } from '../constants';

interface TileProps {
  char: string;
  isOverlay?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const Tile: React.FC<TileProps> = ({ char, isOverlay, className = '', style }) => {
  const isVowel = VOWELS.has(char);
  
  // Base classes for the tile look
  const baseClasses = "flex items-center justify-center font-bold rounded shadow-sm select-none border-b-4 uppercase";
  
  // Color logic
  // Consonants: Blue (bg-blue-500, border-blue-700)
  // Vowels: Darker Blue (bg-blue-700, border-blue-900)
  const colorClasses = isVowel
    ? "bg-blue-700 border-blue-900 text-white"
    : "bg-blue-500 border-blue-700 text-white";

  // Size is controlled by parent via context or specific classes, but we ensure it fills the wrapper
  const sizeClasses = "w-full h-full text-[1.2em] sm:text-[1.5em]";

  // Overlay specific styles (the one floating under cursor)
  const overlayClasses = isOverlay ? "scale-110 shadow-xl z-50 cursor-grabbing opacity-90" : "cursor-grab active:cursor-grabbing";

  return (
    <div 
      className={`${baseClasses} ${colorClasses} ${sizeClasses} ${overlayClasses} ${className}`}
      style={style}
    >
      {char}
    </div>
  );
};